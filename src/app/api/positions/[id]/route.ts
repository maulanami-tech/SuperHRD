import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJobPositionUpdateSchema } from "@/lib/validations";
import { defaultLocale } from "@/lib/i18n/config";
import { getEffectiveStatus } from "@/lib/candidate-status";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const position = await prisma.jobPosition.findFirst({
    where: { id, ownerId: session.user.id },
  });

  if (!position) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const candidates = await prisma.candidate.findMany({
    where: { jobPositionId: id },
    include: {
      screeningResult: true,
      batch: { select: { id: true, createdAt: true } },
    },
    orderBy: { overallScore: { sort: "desc", nulls: "last" } },
  });

  const enrichedCandidates = candidates.map((c) => ({
    ...c,
    status: getEffectiveStatus(c),
  }));

  return NextResponse.json({
    ...position,
    candidates: enrichedCandidates,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const position = await prisma.jobPosition.findFirst({
    where: { id, ownerId: session.user.id },
  });

  if (!position) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const schema = createJobPositionUpdateSchema(defaultLocale);
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.jobPosition.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}
