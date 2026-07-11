import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/candidate-status";
import { expireTimedOutCandidateById } from "@/lib/candidate-timeouts";
import { candidatePatchSchema } from "@/lib/validations";
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
    include: { screeningResult: true, pipelineStage: true, fieldValues: true },
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
  const validation = candidatePatchSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: {
      id,
      submittedById: session.user.id,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const { pipelineStageId, notes, fieldValues } = validation.data;

  if (pipelineStageId) {
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: pipelineStageId, ownerId: session.user.id },
    });
    if (!stage) {
      return NextResponse.json({ error: "Pipeline stage not found" }, { status: 400 });
    }
  }

  if (fieldValues && fieldValues.length > 0) {
    const definitions = await prisma.candidateFieldDefinition.findMany({
      where: {
        id: { in: fieldValues.map((f) => f.fieldDefinitionId) },
        ownerId: session.user.id,
      },
    });
    const definitionMap = new Map(definitions.map((d) => [d.id, d]));

    for (const item of fieldValues) {
      const definition = definitionMap.get(item.fieldDefinitionId);
      if (!definition) continue;

      const data: {
        valueNumber?: number | null;
        valueText?: string | null;
        valueDate?: Date | null;
      } = {};
      if (definition.type === "number" || definition.type === "currency") {
        data.valueNumber = item.value === null || item.value === "" ? null : Number(item.value);
      } else if (definition.type === "text") {
        data.valueText = item.value === null ? null : String(item.value);
      } else if (definition.type === "date") {
        data.valueDate = item.value === null || item.value === "" ? null : new Date(String(item.value));
      }

      await prisma.candidateFieldValue.upsert({
        where: {
          candidateId_fieldDefinitionId: {
            candidateId: id,
            fieldDefinitionId: item.fieldDefinitionId,
          },
        },
        create: { candidateId: id, fieldDefinitionId: item.fieldDefinitionId, ...data },
        update: data,
      });
    }
  }

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      ...(pipelineStageId !== undefined && { pipelineStageId }),
      ...(notes !== undefined && { notes }),
    },
    include: { screeningResult: true, pipelineStage: true, fieldValues: true },
  });

  return NextResponse.json({
    ...updated,
    status: getEffectiveStatus(updated),
  });
}
