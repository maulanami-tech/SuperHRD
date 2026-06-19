type GenerateUploadPromptParams = {
  posisi: string;
  context?: string;
  mode: "single" | "batch";
};

export type GeneratedUploadPrompt = {
  kriteria: string;
  prompt: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getTimeoutMs(): number {
  const configured = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }
  return 20_000;
}

function trimToLimit(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Generated output is invalid");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Generated output is empty");
  }
  return trimmed.slice(0, 5000);
}

function parseGeneratedContent(content: string): GeneratedUploadPrompt {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI provider returned non-JSON content");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  return {
    kriteria: trimToLimit(parsed.kriteria),
    prompt: trimToLimit(parsed.prompt),
  };
}

function extractContentFromChatCompletion(data: ChatCompletionResponse): string | null {
  return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.delta?.content ?? null;
}

function parseProviderResponseText(text: string): ChatCompletionResponse {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AI provider returned empty response");
  }

  if (!trimmed.startsWith("data:")) {
    return JSON.parse(trimmed) as ChatCompletionResponse;
  }

  let streamedContent = "";
  let lastMessageContent: string | null = null;

  for (const line of trimmed.split(/\r?\n/)) {
    const value = line.trim();
    if (!value.startsWith("data:")) continue;

    const payload = value.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;

    const chunk = JSON.parse(payload) as ChatCompletionResponse;
    const messageContent = chunk.choices?.[0]?.message?.content;
    const deltaContent = chunk.choices?.[0]?.delta?.content;
    if (messageContent) {
      lastMessageContent = messageContent;
    }
    if (deltaContent) {
      streamedContent += deltaContent;
    }
  }

  const content = streamedContent || lastMessageContent;
  if (!content) {
    throw new Error("AI provider returned empty streaming content");
  }

  return { choices: [{ message: { content } }] };
}

export function getAiProviderModel(): string {
  return requiredEnv("AI_PROVIDER_MODEL");
}

export async function generateUploadPrompt(
  params: GenerateUploadPromptParams,
): Promise<GeneratedUploadPrompt> {
  const baseUrl = requiredEnv("AI_PROVIDER_BASE_URL").replace(/\/$/, "");
  const apiKey = requiredEnv("AI_PROVIDER_API_KEY");
  const model = getAiProviderModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You generate hiring screening criteria and CV evaluation prompts. Follow the user's language. Return only JSON with string fields kriteria and prompt.",
          },
          {
            role: "user",
            content: [
              `Role: ${params.posisi}`,
              `Mode: ${params.mode}`,
              params.context ? `Additional context: ${params.context}` : "",
              "Create practical evaluation criteria and a concise prompt for CV screening. Criteria should be measurable and role-specific.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI provider failed: ${response.status}`);
    }

    const data = parseProviderResponseText(await response.text());
    const content = extractContentFromChatCompletion(data);
    if (!content) {
      throw new Error("AI provider returned empty content");
    }

    return parseGeneratedContent(content);
  } finally {
    clearTimeout(timeout);
  }
}
