import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { candidateFieldDefinitionSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fields = await prisma.candidateFieldDefinition.findMany({
    where: { ownerId: session.user.id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = candidateFieldDefinitionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const last = await prisma.candidateFieldDefinition.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { order: "desc" },
  });

  const field = await prisma.candidateFieldDefinition.create({
    data: {
      ownerId: session.user.id,
      label: validation.data.label,
      type: validation.data.type,
      order: last ? last.order + 1 : 0,
    },
  });

  return NextResponse.json(field, { status: 201 });
}
