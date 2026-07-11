import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createJobPositionSchema } from "@/lib/validations";
import { defaultLocale } from "@/lib/i18n/config";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search");

  const positions = await prisma.jobPosition.findMany({
    where: {
      ownerId: session.user.id,
      ...(statusParam && ["open", "closed", "archived"].includes(statusParam) && {
        status: statusParam as "open" | "closed" | "archived",
      }),
      ...(search && {
        title: { contains: search, mode: "insensitive" },
      }),
    },
    include: { _count: { select: { candidates: true } } },
    orderBy: { updatedAt: "desc" },
  });

  // Get avg scores
  const positionIds = positions.map((p) => p.id);
  const avgScores = await prisma.candidate.groupBy({
    by: ["jobPositionId"],
    where: {
      jobPositionId: { in: positionIds },
      overallScore: { not: null },
    },
    _avg: { overallScore: true },
  });

  const avgScoreMap = new Map(
    avgScores.map((s) => [s.jobPositionId, s._avg.overallScore])
  );

  const result = positions.map((p) => ({
    ...p,
    candidateCount: p._count.candidates,
    avgScore: avgScoreMap.get(p.id) ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const schema = createJobPositionSchema(defaultLocale);
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const position = await prisma.jobPosition.create({
    data: {
      ...result.data,
      ownerId: session.user.id,
      description: result.data.description || null,
    },
  });

  return NextResponse.json(position, { status: 201 });
}
