import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/candidate-status";
import { expireTimedOutCandidateById } from "@/lib/candidate-timeouts";
import fs from "fs/promises";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await expireTimedOutCandidateById(id, session.user.id);

  const candidate = await prisma.candidate.findUnique({
    where: {
      id,
      submittedById: session.user.id,
    },
    include: { screeningResult: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...candidate,
    status: getEffectiveStatus(candidate),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: {
      id,
      submittedById: session.user.id,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // ScreeningResult is cascade-deleted by Prisma (onDelete: Cascade)
  await prisma.candidate.delete({ where: { id: candidate.id } });

  try {
    await fs.unlink(candidate.filePath);
  } catch {
    // File may already be missing — not a blocking error
  }

  return NextResponse.json({ success: true });
}
