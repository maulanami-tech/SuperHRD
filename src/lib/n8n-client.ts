interface SendToN8nParams {
  fileBuffer: Buffer;
  fileName: string;
  posisi: string;
  kriteria: string;
  prompt: string;
}

export async function sendToN8n({
  fileBuffer,
  fileName,
  posisi,
  kriteria,
  prompt,
}: SendToN8nParams) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("N8N_WEBHOOK_URL is not configured");
  }

  const formData = new FormData();
  formData.append(
    "data",
    new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" }),
    fileName
  );
  formData.append("posisi", posisi);
  formData.append("kriteria", kriteria);
  formData.append("prompt", prompt);

  const response = await fetch(webhookUrl, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type — fetch sets multipart boundary automatically
  });

  if (!response.ok) {
    throw new Error(
      `N8N webhook failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json().catch(() => null);
}
