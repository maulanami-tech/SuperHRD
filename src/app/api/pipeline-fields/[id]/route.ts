import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { candidateFieldDefinitionUpdateSchema } from "@/lib/validations";

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
  const validation = candidateFieldDefinitionUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const field = await prisma.candidateFieldDefinition.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  const updated = await prisma.candidateFieldDefinition.update({
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

  const field = await prisma.candidateFieldDefinition.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  await prisma.candidateFieldDefinition.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
