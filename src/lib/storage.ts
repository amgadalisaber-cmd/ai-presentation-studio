import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

export async function ensureDirs() {
  try { for (const d of ["uploads", "generated", "exports"]) await fs.mkdir(path.join(STORAGE_DIR, d), { recursive: true }); }
  catch (e) { console.error(`[storage] Cannot create ${STORAGE_DIR}: ${(e as Error).message}. Set STORAGE_DIR to a writable directory.`); throw e; }
}

export function safeExt(fileName: string) {
  const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length <= 8 ? ext : "";
}

export async function saveFile(bucket: "uploads" | "generated" | "exports", data: Buffer, originalName: string) {
  await ensureDirs();
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt(originalName)}`;
  const rel = path.join(bucket, name);
  await fs.writeFile(path.join(STORAGE_DIR, rel), data);
  return rel;
}

export async function readFile(rel: string) {
  const abs = path.join(STORAGE_DIR, rel);
  if (!abs.startsWith(STORAGE_DIR)) throw new Error("Invalid path");
  return fs.readFile(abs);
}

export function absPath(rel: string) {
  const abs = path.join(STORAGE_DIR, rel);
  if (!abs.startsWith(STORAGE_DIR)) throw new Error("Invalid path");
  return abs;
}

export async function deleteFile(rel: string) {
  try { await fs.unlink(absPath(rel)); } catch { /* ignore */ }
}

export async function toDataUri(rel: string, mime: string) {
  const buf = await readFile(rel);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
export const ALLOWED_DOC_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "font/ttf", "font/otf", "application/font-sfnt", "application/x-font-ttf", "application/octet-stream"];

export function imageDimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === "image/png" && buf.length > 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (mime === "image/webp" && buf.length > 30) {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (chunk === "VP8X") return { width: (buf.readUIntLE(24, 3)) + 1, height: (buf.readUIntLE(27, 3)) + 1 };
    }
  } catch { /* ignore */ }
  return null;
}
