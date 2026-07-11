import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/candidate-status";

interface FieldFilter {
  fieldId: string;
  min?: number;
  max?: number;
  text?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scoreMin = searchParams.get("scoreMin");
  const scoreMax = searchParams.get("scoreMax");
  const fieldFiltersRaw = searchParams.get("fieldFilters");

  let fieldFilters: FieldFilter[] = [];
  if (fieldFiltersRaw) {
    try {
      const parsed = JSON.parse(fieldFiltersRaw);
      if (Array.isArray(parsed)) fieldFilters = parsed;
    } catch {
      // Ignore malformed filter payloads.
    }
  }

  const [stages, fields] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { ownerId: session.user.id },
      orderBy: { order: "asc" },
    }),
    prisma.candidateFieldDefinition.findMany({
      where: { ownerId: session.user.id },
      orderBy: { order: "asc" },
    }),
  ]);

  const scoreWhere: { gte?: number; lte?: number } = {};
  if (scoreMin) scoreWhere.gte = Number(scoreMin);
  if (scoreMax) scoreWhere.lte = Number(scoreMax);

  const fieldFilterClauses = fieldFilters
    .filter((f) => f.fieldId)
    .map((f) => {
      if (f.text !== undefined) {
        return {
          fieldValues: {
            some: {
              fieldDefinitionId: f.fieldId,
              valueText: { contains: f.text, mode: "insensitive" as const },
            },
          },
        };
      }
      const range: { gte?: number; lte?: number } = {};
      if (f.min !== undefined) range.gte = f.min;
      if (f.max !== undefined) range.lte = f.max;
      return {
        fieldValues: {
          some: { fieldDefinitionId: f.fieldId, valueNumber: range },
        },
      };
    });

  const candidates = await prisma.candidate.findMany({
    where: {
      submittedById: session.user.id,
      ...(Object.keys(scoreWhere).length > 0 && { overallScore: scoreWhere }),
      ...(fieldFilterClauses.length > 0 && { AND: fieldFilterClauses }),
    },
    include: {
      screeningResult: true,
      fieldValues: true,
      jobPosition: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = candidates.map((c) => ({
    ...c,
    status: getEffectiveStatus(c),
  }));

  return NextResponse.json({ stages, fields, candidates: result });
}
