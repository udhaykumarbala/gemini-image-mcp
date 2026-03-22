import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function detectMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) {
    throw new Error(`Unsupported image format: ${ext}`);
  }
  return mime;
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

export async function imageToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return bufferToBase64(buffer);
}
