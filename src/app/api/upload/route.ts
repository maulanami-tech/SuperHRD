import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, addRateLimitHeaders } from "@/lib/rate-limit";
import { uploadSchema, fileSchema } from "@/lib/validations";
import { sendToN8n } from "@/lib/n8n-client";
import { validateFileMagicBytes } from "@/lib/file-validator";
import { canUserScreen, deductCredit, DAILY_QUOTA_LIMIT, getCurrentDateWIB, refundScreeningCredit } from "@/lib/credits";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getClientIpFromRequest } from "@/lib/ip-utils";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIpFromRequest(req);
  const uploadKey = `upload:ip:${ip}`;
  const uploadCheck = await checkRateLimit(uploadKey, { windowMs: 60 * 1000, maxRequests: 10 });
  if (!uploadCheck.allowed) {
    const response = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    addRateLimitHeaders(response.headers, uploadCheck.remaining, uploadCheck.resetMs);
    return response;
  }

  // Parse formData early — need file content for idempotency hash
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) ?? "";
  const email = (formData.get("email") as string | null) ?? undefined;
  const posisi = (formData.get("posisi") as string) ?? "";
  const kriteria = (formData.get("kriteria") as string) ?? "";
  const prompt = (formData.get("prompt") as string) ?? "";

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const fileValidation = fileSchema.safeParse({ type: file.type, size: file.size });
  if (!fileValidation.success) {
    return NextResponse.json(
      { error: fileValidation.error.issues[0].message },
      { status: 400 }
    );
  }

  // Read file content for idempotency hash (first 1KB for speed)
  const fileBytes = await file.arrayBuffer();
  const fileBuffer = Buffer.from(fileBytes);
  const contentHash = createHash('sha256')
    .update(session.user.id)
    .update(fileBuffer.subarray(0, 1024))
    .update(getCurrentDateWIB())
    .digest('hex');

  // Generate or extract idempotency key
  const idempotencyKey = req.headers.get('idempotency-key') || `content-${contentHash}`;

  // Check for existing request with this idempotency key (scoped to current user)
  const existingCandidate = await prisma.candidate.findFirst({
    where: {
      idempotencyKey,
      submittedById: session.user.id,
    },
  });

  if (existingCandidate) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dailyQuotaUsed: true, lastQuotaDate: true },
    });

    const today = getCurrentDateWIB();
    const quotaUsed = user?.lastQuotaDate === today ? user.dailyQuotaUsed : 0;

    return NextResponse.json({
      candidateId: existingCandidate.id,
      status: existingCandidate.status,
      cached: true,
      creditUsed: existingCandidate.creditSource || 'unknown',
      remainingQuota: Math.max(0, DAILY_QUOTA_LIMIT - quotaUsed),
    });
  }

  // Add credit check
  const creditCheck = await canUserScreen(session.user.id);
  if (!creditCheck.canScreen) {
    return NextResponse.json(
      {
        error: "Insufficient credit. Please top up your account.",
        reason: creditCheck.reason
      },
      { status: 402 }
    );
  }

  const candidateValidation = uploadSchema.safeParse({ name, email, posisi, kriteria, prompt });
  if (!candidateValidation.success) {
    return NextResponse.json(
      { error: candidateValidation.error.issues[0].message },
      { status: 400 }
    );
  }

  const magicCheck = validateFileMagicBytes(fileBuffer, file.type);
  if (!magicCheck.valid) {
    return NextResponse.json(
      { error: `Invalid file content: file does not match expected ${magicCheck.expected} format. The file may be corrupted or have an incorrect extension.` },
      { status: 400 }
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
  const fileExtension = (file.name.split(".").pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = path.join(uploadsDir, fileName);

  await fs.writeFile(filePath, fileBuffer);

  const n8nRunId = uuidv4();
  // Generate candidate ID before deduction to ensure consistent audit trail
  const candidateId = uuidv4();

  // Deduct credit FIRST before creating candidate
  let deductionResult;
  try {
    deductionResult = await deductCredit(session.user.id, candidateId);
  } catch (error) {
    console.error('Credit deduction failed:', error);
    // Clean up file on deduction failure
    await fs.unlink(filePath);
    return NextResponse.json(
      { error: "Credit deduction failed. Please try again." },
      { status: 500 }
    );
  }

  // Only create candidate AFTER successful credit deduction
  const candidate = await prisma.candidate.create({
    data: {
      id: candidateId,
      name: candidateValidation.data.name,
      email: candidateValidation.data.email ?? null,
      posisi: candidateValidation.data.posisi,
      kriteria: candidateValidation.data.kriteria,
      prompt: candidateValidation.data.prompt,
      fileName: file.name,
      filePath,
      status: "pending",
      n8nRunId,
      idempotencyKey,
      creditSource: deductionResult.source,
      submittedBy: session.user.name ?? session.user.email ?? "Unknown",
      submittedById: session.user.id,
    },
  });

  // Try n8n
  try {
    await sendToN8n({
      candidateId: candidate.id,
      fileBuffer,
      fileName: file.name,
      posisi: candidateValidation.data.posisi,
      kriteria: candidateValidation.data.kriteria,
      prompt: candidateValidation.data.prompt,
      runId: n8nRunId,
    });

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "processing" },
    });
  } catch (error) {
    console.error("Failed to send to n8n:", error);

    // Clean up file on n8n failure
    await fs.unlink(filePath);

    await refundScreeningCredit(session.user.id, candidate.id, deductionResult.source);

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "failed" },
    });

    return NextResponse.json(
      { error: "Screening service unavailable. Credit refunded." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    candidateId: candidate.id,
    status: "processing",
    creditUsed: deductionResult.source,
    remainingQuota: deductionResult.quotaRemaining,
  });
}
