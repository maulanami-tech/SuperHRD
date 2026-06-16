export function getUploadIdempotencyKey(headers: Headers): string | null {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  return idempotencyKey || null;
}
