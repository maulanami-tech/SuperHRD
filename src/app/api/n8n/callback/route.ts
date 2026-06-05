import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { n8nCallbackSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-callback-secret");
  if (secret !== process.env.N8N_CALLBACK_SECRET) {
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
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  try {
    await prisma.screeningResult.create({
      data: {
        candidateId: candidate.id,
        overallScore,
        summary,
        criteria: JSON.stringify(criteria),
        rawResponse: rawResponse ?? null,
      },
    });

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
