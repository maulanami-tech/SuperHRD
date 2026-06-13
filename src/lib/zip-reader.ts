import path from "path";
import { inflateRawSync } from "zlib";

export interface ZipEntry {
  fileName: string;
  buffer: Buffer;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ZipReadIssue {
  fileName: string;
  reason: string;
}

interface ReadZipOptions {
  maxEntries: number;
  maxFileSize: number;
  maxTotalSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

function isIgnoredEntry(fileName: string): boolean {
  const normalized = fileName.replace(/\\/g, "/");
  const baseName = path.posix.basename(normalized);
  return (
    normalized.endsWith("/") ||
    normalized.startsWith("__MACOSX/") ||
    baseName.startsWith(".") ||
    baseName === ""
  );
}

function inflateEntry(
  method: number,
  compressed: Buffer,
  fileName: string
): Buffer | ZipReadIssue {
  if (method === 0) return compressed;
  if (method === 8) return inflateRawSync(compressed);
  return {
    fileName,
    reason: `Unsupported ZIP compression method ${method}`,
  };
}

export function readZipEntries(
  buffer: Buffer,
  options: ReadZipOptions
): { entries: ZipEntry[]; issues: ZipReadIssue[] } {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    return {
      entries: [],
      issues: [{ fileName: "archive.zip", reason: "Invalid ZIP archive" }],
    };
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  const issues: ZipReadIssue[] = [];
  let totalUncompressed = 0;
  let cursor = centralDirectoryOffset;

  if (totalEntries > options.maxEntries) {
    return {
      entries: [],
      issues: [
        {
          fileName: "archive.zip",
          reason: `ZIP contains more than ${options.maxEntries} entries`,
        },
      ],
    };
  }

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > buffer.length) {
      issues.push({ fileName: "archive.zip", reason: "Corrupted ZIP index" });
      break;
    }

    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      issues.push({ fileName: "archive.zip", reason: "Corrupted ZIP index" });
      break;
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const rawFileName = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");
    const displayName = rawFileName.replace(/\\/g, "/");
    const baseName = path.posix.basename(displayName);

    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (isIgnoredEntry(displayName)) continue;

    if ((flags & 0x1) === 0x1) {
      issues.push({ fileName: displayName, reason: "Encrypted files are not supported" });
      continue;
    }

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      issues.push({ fileName: displayName, reason: "ZIP64 entries are not supported" });
      continue;
    }

    if (uncompressedSize > options.maxFileSize) {
      issues.push({ fileName: displayName, reason: "File is larger than 10MB" });
      continue;
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > options.maxTotalSize) {
      issues.push({
        fileName: displayName,
        reason: "Extracted ZIP content is too large",
      });
      continue;
    }

    if (
      localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE
    ) {
      issues.push({ fileName: displayName, reason: "Corrupted ZIP file entry" });
      continue;
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length) {
      issues.push({ fileName: displayName, reason: "Corrupted ZIP file data" });
      continue;
    }

    const inflated = inflateEntry(
      method,
      buffer.subarray(dataStart, dataEnd),
      displayName
    );

    if ("reason" in inflated) {
      issues.push(inflated);
      continue;
    }

    entries.push({
      fileName: baseName,
      buffer: inflated,
      compressedSize,
      uncompressedSize,
    });
  }

  return { entries, issues };
}
