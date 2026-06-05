import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractText(
  filePath: string,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
