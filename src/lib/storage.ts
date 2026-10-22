import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

/**
 * File storage with two backends:
 *  - local disk (default): STORAGE_DIR (falls back to the OS temp dir on read-only hosts)
 *  - Vercel Blob: automatically used when BLOB_READ_WRITE_TOKEN is set (serverless deployments). Paths are stored as "blob:<url>".
 */
export const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN;
export const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "studio-storage") : "./storage"));
export const STORAGE_BACKEND = BLOB_ENABLED ? "vercel-blob" : "local";

export async function ensureDirs() {
  if (BLOB_ENABLED) return;
  try { for (const d of ["uploads", "generated", "exports"]) await fs.mkdir(path.join(STORAGE_DIR, d), { recursive: true }); }
  catch (e) { console.error(`[storage] Cannot create ${STORAGE_DIR}: ${(e as Error).message}. Set STORAGE_DIR to a writable directory.`); throw e; }
}

export function safeExt(fileName: string) {
  const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length <= 8 ? ext : "";
}

export async function saveFile(bucket: "uploads" | "generated" | "exports", data: Buffer, originalName: string) {
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt(originalName)}`;
  if (BLOB_ENABLED) {
    const { put } = await import("@vercel/blob");
    const res = await put(`${bucket}/${name}`, data, { access: "public", addRandomSuffix: false, contentType: mimeFromExt(originalName) });
    return `blob:${res.url}`;
  }
  await ensureDirs();
  const rel = path.join(bucket, name);
  await fs.writeFile(path.join(STORAGE_DIR, rel), data);
  return rel;
}

export async function readFile(rel: string): Promise<Buffer> {
  if (rel.startsWith("blob:")) {
    const res = await fetch(rel.slice(5), { cache: "no-store" });
    if (!res.ok) throw new Error(`Stored file not found (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
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
  try {
    if (rel.startsWith("blob:")) { const { del } = await import("@vercel/blob"); await del(rel.slice(5)); return; }
    await fs.unlink(absPath(rel));
  } catch { /* ignore */ }
}

export async function toDataUri(rel: string, mime: string) {
  const buf = await readFile(rel);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function mimeFromExt(name: string) {
  const e = safeExt(name).slice(1);
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" } as Record<string, string>)[e] || "application/octet-stream";
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
