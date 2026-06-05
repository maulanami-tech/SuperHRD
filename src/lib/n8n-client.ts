interface SendToN8nParams {
  runId: string;
  cvText: string;
  candidateName: string;
  candidateEmail?: string;
  callbackUrl: string;
}

export async function sendToN8n({
  runId,
  cvText,
  candidateName,
  candidateEmail,
  callbackUrl,
}: SendToN8nParams) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("N8N_WEBHOOK_URL is not configured");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId,
      cvText,
      candidateName,
      candidateEmail: candidateEmail ?? null,
      callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `N8N webhook failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json().catch(() => null);
}
