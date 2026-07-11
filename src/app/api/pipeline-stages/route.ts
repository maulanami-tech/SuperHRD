import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pipelineStageSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { ownerId: session.user.id },
    include: { _count: { select: { candidates: true } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(
    stages.map((s) => ({ ...s, candidateCount: s._count.candidates }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = pipelineStageSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const last = await prisma.pipelineStage.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { order: "desc" },
  });

  const stage = await prisma.pipelineStage.create({
    data: {
      ownerId: session.user.id,
      name: validation.data.name,
      color: validation.data.color,
      order: last ? last.order + 1 : 0,
    },
  });

  return NextResponse.json(stage, { status: 201 });
}
