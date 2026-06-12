const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const DOCX_MAGIC = [0x50, 0x4B, 0x03, 0x04];
const DOC_MAGIC = [0xD0, 0xCF, 0x11, 0xE0];

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
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return { valid: matchesMagic(buffer, DOCX_MAGIC), expected: "DOCX (PK\\x03\\x04)" };
  }
  if (mimeType === "application/msword") {
    return { valid: matchesMagic(buffer, DOC_MAGIC), expected: "DOC (\\xD0\\xCF\\x11\\xE0)" };
  }
  return { valid: false, expected: "PDF, DOC, or DOCX" };
}
