import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadSchema, fileSchema } from "@/lib/validations";
import { sendToN8n } from "@/lib/n8n-client";
import { validateFileMagicBytes } from "@/lib/file-validator";
import { canUserScreen, deductCredit } from "@/lib/credits";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate or extract idempotency key
  const idempotencyKey = req.headers.get('idempotency-key') || `auto-${uuidv4()}`;

  // Check for existing request with this idempotency key
  const existingCandidate = await prisma.candidate.findUnique({
    where: { idempotencyKey },
    include: { screeningResult: true },
  });

  if (existingCandidate) {
    // Return cached response - determine credit source from user's current state
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dailyQuotaUsed: true },
    });

    return NextResponse.json({
      candidateId: existingCandidate.id,
      status: existingCandidate.status,
      cached: true,
      creditUsed: user && user.dailyQuotaUsed > 0 ? 'quota' : 'paid',
      remainingQuota: user ? Math.max(0, 10 - user.dailyQuotaUsed) : 0,
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

  const candidateValidation = uploadSchema.safeParse({ name, email, posisi, kriteria, prompt });
  if (!candidateValidation.success) {
    return NextResponse.json(
      { error: candidateValidation.error.issues[0].message },
      { status: 400 }
    );
  }

  const fileValidation = fileSchema.safeParse({ type: file.type, size: file.size });
  if (!fileValidation.success) {
    return NextResponse.json(
      { error: fileValidation.error.issues[0].message },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const fileBuffer = Buffer.from(bytes);

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
      submittedBy: session.user.name ?? session.user.email ?? "Unknown",
      submittedById: session.user.id,
    },
  });

  // Try n8n
  try {
    await sendToN8n({
      fileBuffer,
      fileName: file.name,
      posisi: candidateValidation.data.posisi,
      kriteria: candidateValidation.data.kriteria,
      prompt: candidateValidation.data.prompt,
    });

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "processing" },
    });
  } catch (error) {
    console.error("Failed to send to n8n:", error);

    // Clean up file on n8n failure
    await fs.unlink(filePath);

    // Refund credit since n8n failed - use atomic transactions
    if (deductionResult.source === 'paid') {
      await prisma.$transaction(async (tx) => {
        const refundedUser = await tx.user.update({
          where: { id: session.user.id },
          data: { creditBalance: { increment: 1 } },
        });

        await tx.transaction.create({
          data: {
            userId: session.user.id,
            type: 'refund',
            creditDelta: 1,
            balanceAfter: refundedUser.creditBalance,
            amountIdr: null,
            description: 'Refund: screening service unavailable',
            metadata: JSON.stringify({ candidateId: candidate.id, reason: 'n8n_failed' }),
          },
        });
      });
    } else {
      // Was free quota - restore it atomically with floor check
      await prisma.$transaction(async (tx) => {
        const restoreResult = await tx.user.updateMany({
          where: {
            id: session.user.id,
            dailyQuotaUsed: { gt: 0 },
          },
          data: { dailyQuotaUsed: { decrement: 1 } },
        });

        const restoredUser = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { creditBalance: true },
        });

        if (restoreResult.count > 0 && restoredUser) {
          await tx.transaction.create({
            data: {
              userId: session.user.id,
              type: 'refund',
              creditDelta: 0,
              balanceAfter: restoredUser.creditBalance,
              amountIdr: null,
              description: 'Quota restored: screening service unavailable',
              metadata: JSON.stringify({ candidateId: candidate.id, reason: 'n8n_failed' }),
            },
          });
        }
      });
    }

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
