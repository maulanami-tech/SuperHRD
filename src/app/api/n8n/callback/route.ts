import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n8nCallbackSchema } from "@/lib/validations";
import { timingSafeEqual } from "@/lib/crypto-utils";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-callback-secret");
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;

  if (!secret || !expectedSecret || !timingSafeEqual(secret, expectedSecret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await req.json();

  const validation = n8nCallbackSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { runId, overallScore, summary, criteria, rawResponse } = validation.data;

  const candidate = await prisma.candidate.findUnique({
    where: { n8nRunId: runId },
    include: { screeningResult: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (candidate.status === "completed" && candidate.screeningResult) {
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }

  try {
    if (!candidate.screeningResult) {
      await prisma.screeningResult.create({
        data: {
          candidateId: candidate.id,
          overallScore,
          summary,
          criteria: JSON.stringify(criteria),
          rawResponse: rawResponse ?? null,
        },
      });
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        status: "completed",
        overallScore,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Callback processing error:", error);

    const refreshed = await prisma.candidate.findUnique({
      where: { id: candidate.id },
      include: { screeningResult: true },
    });

    if (refreshed?.status === "completed" && refreshed.screeningResult) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { status: "failed" },
    }).catch(console.error);

    return NextResponse.json(
      { error: "Failed to process callback" },
      { status: 500 }
    );
  }
}
