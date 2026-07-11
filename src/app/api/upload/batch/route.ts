import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, addRateLimitHeaders } from "@/lib/rate-limit";
import { batchUploadSchema } from "@/lib/validations";
import { validateFileMagicBytes } from "@/lib/file-validator";
import {
  deductCredit,
  getAvailableScreeningCredits,
  getCurrentDateWIB,
  refundScreeningCredit,
} from "@/lib/credits";
import { sendToN8n } from "@/lib/n8n-client";
import { readZipEntries, type ZipReadIssue } from "@/lib/zip-reader";
import { getClientIpFromRequest } from "@/lib/ip-utils";

const MAX_ZIP_SIZE = 50 * 1024 * 1024;
const MAX_VALID_CV_COUNT = 50;
const MAX_ZIP_ENTRIES = 200;
const MAX_CV_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_SIZE = 100 * 1024 * 1024;

type ValidCv = {
  buffer: Buffer;
  extension: "pdf" | "doc" | "docx";
  fileName: string;
  mimeType: string;
};

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getMimeType(extension: string): string | null {
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

function buildCandidateName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).replace(/[_-]+/g, " ").trim() || fileName;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIpFromRequest(req);
  const uploadKey = `upload-batch:ip:${ip}`;
  const uploadCheck = await checkRateLimit(uploadKey, {
    windowMs: 60 * 1000,
    maxRequests: 5,
  });
  if (!uploadCheck.allowed) {
    const response = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    addRateLimitHeaders(response.headers, uploadCheck.remaining, uploadCheck.resetMs);
    return response;
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const jobPositionId = (formData.get("jobPositionId") as string | null) || null;
  let posisi = (formData.get("posisi") as string) ?? "";
  let kriteria = (formData.get("kriteria") as string) ?? "";
  let prompt = (formData.get("prompt") as string) ?? "";
  let resolvedJobPositionId: string | null = null;

  if (!file) {
    return NextResponse.json({ error: "ZIP file is required" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".zip") || file.size > MAX_ZIP_SIZE) {
    return NextResponse.json(
      { error: "Only ZIP files up to 50MB are allowed" },
      { status: 400 }
    );
  }

  // Handle jobPositionId if provided
  if (jobPositionId) {
    const position = await prisma.jobPosition.findFirst({
      where: { id: jobPositionId, ownerId: session.user.id, status: "open" },
    });

    if (!position) {
      return NextResponse.json(
        { error: "Position not found or not open" },
        { status: 400 }
      );
    }

    // Override with position values
    resolvedJobPositionId = position.id;
    posisi = position.title;
    kriteria = position.kriteria;
    prompt = position.prompt;
  }

  const validation = batchUploadSchema.safeParse({ posisi, kriteria, prompt });
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const zipBuffer = Buffer.from(await file.arrayBuffer());
  const { entries, issues } = readZipEntries(zipBuffer, {
    maxEntries: MAX_ZIP_ENTRIES,
    maxFileSize: MAX_CV_SIZE,
    maxTotalSize: MAX_EXTRACTED_SIZE,
  });
  const invalidFiles: ZipReadIssue[] = [...issues];
  const validFiles: ValidCv[] = [];

  for (const entry of entries) {
    const extension = getExtension(entry.fileName);
    const mimeType = getMimeType(extension);
    if (!mimeType) {
      invalidFiles.push({
        fileName: entry.fileName,
        reason: "Only PDF, DOC, and DOCX files are supported",
      });
      continue;
    }

    const magicCheck = validateFileMagicBytes(entry.buffer, mimeType);
    if (!magicCheck.valid) {
      invalidFiles.push({
        fileName: entry.fileName,
        reason: `Invalid file content: expected ${magicCheck.expected}`,
      });
      continue;
    }

    validFiles.push({
      buffer: entry.buffer,
      extension: extension as "pdf" | "doc" | "docx",
      fileName: entry.fileName,
      mimeType,
    });
  }

  if (validFiles.length === 0) {
    return NextResponse.json(
      {
        error: "No valid CV files found in this ZIP",
        invalidFiles,
      },
      { status: 400 }
    );
  }

  if (validFiles.length > MAX_VALID_CV_COUNT) {
    return NextResponse.json(
      {
        error: `Batch can process up to ${MAX_VALID_CV_COUNT} valid CV files`,
        acceptedFiles: validFiles.length,
        invalidFiles,
      },
      { status: 400 }
    );
  }

  const creditAvailability = await getAvailableScreeningCredits(session.user.id);
  if (creditAvailability.available < validFiles.length) {
    return NextResponse.json(
      {
        error: `Batch needs ${validFiles.length} screening credits. You currently have ${creditAvailability.available} available. Top up ${validFiles.length - creditAvailability.available} credits to process this ZIP.`,
        requiredCredits: validFiles.length,
        availableCredits: creditAvailability.available,
        creditGap: validFiles.length - creditAvailability.available,
        invalidFiles,
      },
      { status: 402 }
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const batch = await prisma.uploadBatch.create({
    data: {
      submittedById: session.user.id,
      posisi: validation.data.posisi,
      kriteria: validation.data.kriteria,
      prompt: validation.data.prompt,
      jobPositionId: resolvedJobPositionId,
      totalFiles: validFiles.length + invalidFiles.length,
      acceptedFiles: validFiles.length,
      rejectedFiles: invalidFiles.length,
      status: "processing",
    },
  });

  const candidateIds: string[] = [];
  const processedFiles: string[] = [];
  const failedFiles: ZipReadIssue[] = [];

  for (const cv of validFiles) {
    const candidateId = uuidv4();
    const n8nRunId = uuidv4();
    const storedFileName = `${uuidv4()}.${cv.extension}`;
    const filePath = path.join(uploadsDir, storedFileName);
    const idempotencyKey = `batch-${batch.id}-${candidateId}-${getCurrentDateWIB()}`;

    await fs.writeFile(filePath, cv.buffer);

    const deductionResult = await deductCredit(session.user.id, candidateId);
    if (!deductionResult.success) {
      await fs.unlink(filePath).catch(() => undefined);
      failedFiles.push({
        fileName: cv.fileName,
        reason: "Credit deduction failed",
      });
      continue;
    }

    const candidate = await prisma.candidate.create({
      data: {
        id: candidateId,
        name: buildCandidateName(cv.fileName),
        email: null,
        posisi: validation.data.posisi,
        kriteria: validation.data.kriteria,
        prompt: validation.data.prompt,
        jobPositionId: resolvedJobPositionId,
        fileName: cv.fileName,
        filePath,
        status: "pending",
        n8nRunId,
        idempotencyKey: `batch-${idempotencyKey}`,
        creditSource: deductionResult.source,
        batchId: batch.id,
        submittedBy: session.user.name ?? session.user.email ?? "Unknown",
        submittedById: session.user.id,
      },
    });

    try {
      await sendToN8n({
        batchId: batch.id,
        candidateId: candidate.id,
        fileBuffer: cv.buffer,
        fileName: cv.fileName,
        posisi: validation.data.posisi,
        kriteria: validation.data.kriteria,
        prompt: validation.data.prompt,
        runId: n8nRunId,
      });

      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { status: "processing" },
      });
      candidateIds.push(candidate.id);
      processedFiles.push(cv.fileName);
    } catch (error) {
      console.error("Failed to send batch CV to n8n:", error);
      await fs.unlink(filePath).catch(() => undefined);
      await refundScreeningCredit(session.user.id, candidate.id, deductionResult.source);
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { status: "failed" },
      });
      failedFiles.push({
        fileName: cv.fileName,
        reason: "Screening service unavailable. Credit refunded.",
      });
    }
  }

  if (candidateIds.length === 0) {
    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      {
        error: "Batch could not be sent to screening service",
        batchId: batch.id,
        invalidFiles: [...invalidFiles, ...failedFiles],
      },
      { status: 503 }
    );
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: {
      acceptedFiles: candidateIds.length,
      rejectedFiles: invalidFiles.length + failedFiles.length,
      status: failedFiles.length > 0 ? "completed_with_failures" : "processing",
    },
  });

  return NextResponse.json({
    batchId: batch.id,
    totalFiles: validFiles.length + invalidFiles.length,
    acceptedFiles: candidateIds.length,
    rejectedFiles: invalidFiles.length + failedFiles.length,
    processedFiles,
    invalidFiles: [...invalidFiles, ...failedFiles],
    candidateIds,
  });
}
