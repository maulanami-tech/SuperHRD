import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deductPromptGenerationCredit,
  refundPromptGenerationCredit,
} from "@/lib/credits";
import {
  generateUploadPrompt,
  type GeneratedUploadPrompt,
} from "@/lib/ai-prompt-generator";

const generatePromptSchema = z.object({
  posisi: z.string().min(1, "Position is required").max(200, "Position is too long"),
  context: z.string().max(2000, "Context is too long").optional(),
  mode: z.enum(["single", "batch"]),
});

function getTestGeneratedPrompt(req: NextRequest): GeneratedUploadPrompt | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const raw = req.headers.get("x-superhrd-test-ai-response");
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as GeneratedUploadPrompt;
  return {
    kriteria: parsed.kriteria,
    prompt: parsed.prompt,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validation = generatePromptSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 },
    );
  }

  const { posisi, context, mode } = validation.data;
  const provider = "openai-compatible";
  const model =
    process.env.NODE_ENV === "production" || !req.headers.get("x-superhrd-test-ai-response")
      ? process.env.AI_PROVIDER_MODEL ?? "unconfigured"
      : "e2e-test-model";

  const deduction = await deductPromptGenerationCredit(session.user.id, {
    mode,
    posisi,
    provider,
    model,
  });

  if (!deduction.success) {
    return NextResponse.json(
      { error: deduction.reason ?? "Insufficient paid credits" },
      { status: 402 },
    );
  }

  try {
    const generated =
      getTestGeneratedPrompt(req) ?? (await generateUploadPrompt({ posisi, context, mode }));

    return NextResponse.json({
      ...generated,
      balanceAfter: deduction.newBalance,
    });
  } catch (error) {
    console.error("Failed to generate upload prompt:", error);
    await refundPromptGenerationCredit(session.user.id, {
      mode,
      posisi,
      reason: error instanceof Error ? error.message : "provider_error",
    });
    return NextResponse.json(
      { error: "Failed to generate prompt" },
      { status: 500 },
    );
  }
}
