import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pipelineStageUpdateSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const validation = pipelineStageUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const stage = await prisma.pipelineStage.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const updated = await prisma.pipelineStage.update({
    where: { id },
    data: validation.data,
  });

  return NextResponse.json(updated);
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

  const stage = await prisma.pipelineStage.findFirst({
    where: { id, ownerId: session.user.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  if (stage._count.candidates > 0) {
    return NextResponse.json(
      { error: "Move candidates out of this stage before deleting it." },
      { status: 400 }
    );
  }

  await prisma.pipelineStage.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
