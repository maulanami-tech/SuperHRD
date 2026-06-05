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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lockedCandidate = await tx.candidate.findUnique({
        where: { n8nRunId: runId },
        include: { screeningResult: true },
      });

      if (!lockedCandidate) {
        return { error: "Candidate not found", status: 404 };
      }

      if (lockedCandidate.status === "completed" && lockedCandidate.screeningResult) {
        return { success: true, alreadyProcessed: true };
      }

      if (!lockedCandidate.screeningResult) {
        await tx.screeningResult.create({
          data: {
            candidateId: lockedCandidate.id,
            overallScore,
            summary,
            criteria: JSON.stringify(criteria),
            rawResponse: rawResponse ?? null,
          },
        });
      }

      await tx.candidate.update({
        where: { id: lockedCandidate.id },
        data: { status: "completed", overallScore },
      });

      return { success: true };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Callback processing error:", error);
    return NextResponse.json(
      { error: "Failed to process callback" },
      { status: 500 }
    );
  }
}
