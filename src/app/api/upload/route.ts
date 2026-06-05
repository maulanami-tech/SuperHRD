import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadSchema, fileSchema } from "@/lib/validations";
import { sendToN8n } from "@/lib/n8n-client";
import { validateFileMagicBytes } from "@/lib/file-validator";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const fileExtension = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = path.join(uploadsDir, fileName);

  await fs.writeFile(filePath, fileBuffer);

  const n8nRunId = uuidv4();

  const candidate = await prisma.candidate.create({
    data: {
      name: candidateValidation.data.name,
      email: candidateValidation.data.email ?? null,
      posisi: candidateValidation.data.posisi,
      kriteria: candidateValidation.data.kriteria,
      prompt: candidateValidation.data.prompt,
      fileName: file.name,
      filePath,
      status: "pending",
      n8nRunId,
      submittedBy: session.user.name ?? session.user.email ?? "Unknown",
      submittedById: session.user.id,
    },
  });

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
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "failed" },
    });

    return NextResponse.json(
      { error: "File uploaded but failed to send to screening service" },
      { status: 502 }
    );
  }

  return NextResponse.json({ candidateId: candidate.id, status: "processing" });
}
