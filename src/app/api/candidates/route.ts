import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveStatus,
  buildStatusFilter,
} from "@/lib/candidate-status";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  const candidates = await prisma.candidate.findMany({
    where: {
      submittedById: session.user.id,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }),
      ...(status && buildStatusFilter(status)),
    },
    include: { screeningResult: true },
    orderBy: { createdAt: "desc" },
  });

  const result = candidates.map((c) => ({
    ...c,
    status: getEffectiveStatus(c),
  }));

  return NextResponse.json(result);
}
