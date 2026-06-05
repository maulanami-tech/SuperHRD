const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

function matchesMagic(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

export function validateFileMagicBytes(
  buffer: Buffer,
  mimeType: string
): { valid: boolean; expected: string } {
  if (mimeType === "application/pdf") {
    return { valid: matchesMagic(buffer, PDF_MAGIC), expected: "PDF (%PDF)" };
  }
  return { valid: false, expected: "PDF" };
}
