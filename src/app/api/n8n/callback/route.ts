import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n8nCallbackSchema } from "@/lib/validations";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { isProcessingTimedOut } from "@/lib/candidate-status";
import { refundScreeningCredit } from "@/lib/credits";

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

  const { runId, overallScore, summary, criteria, rawResponse, status, error: errorMsg } = validation.data;

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

      if (isProcessingTimedOut(lockedCandidate)) {
        return { error: "Candidate processing has timed out", status: 409 };
      }

      if (lockedCandidate.status === "failed") {
        return { error: "Candidate has already failed", status: 409 };
      }

      // Handle error callback from n8n
      if (status === "error") {
        await tx.candidate.update({
          where: { id: lockedCandidate.id },
          data: { status: "failed" },
        });
        return { success: true, failed: true, reason: errorMsg ?? "n8n processing error" };
      }

      // Validate required fields for success callback
      if (overallScore === undefined || !summary || !criteria) {
        return { error: "Missing required fields for success callback", status: 400 };
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

    // Refund credit if candidate failed
    if ("failed" in result && result.failed) {
      const candidate = await prisma.candidate.findUnique({
        where: { n8nRunId: runId },
        select: { submittedById: true, id: true, creditSource: true },
      });
      if (candidate?.creditSource) {
        await refundScreeningCredit(candidate.submittedById, candidate.id, candidate.creditSource);
      }
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
