import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { FONT_MIME, fontOptions } from "@/lib/fonts";

export const GET = handler(async (_req, _p, userId) => ({ options: await fontOptions(userId), uploaded: await prisma.userFont.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }) }));

export const POST = handler(async (req, _p, userId) => {
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "A font file (.ttf, .otf, .woff, .woff2) is required");
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (!FONT_MIME[ext]) throw new ApiError(415, "Unsupported font format. Use .ttf, .otf, .woff or .woff2");
  if (file.size > 20 * 1024 * 1024) throw new ApiError(413, "Font exceeds 20 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = buf.subarray(0, 4).toString("latin1");
  const ok = sig === "\x00\x01\x00\x00" || sig === "OTTO" || sig === "true" || sig === "wOFF" || sig === "wOF2";
  if (!ok) throw new ApiError(415, "The file does not look like a valid font");
  const family = String(form.get("family") || file.name.replace(/\.[^.]+$/, "").replace(/[-_](regular|bold|light|medium|semibold|black|italic)/gi, "")).trim();
  if (!family) throw new ApiError(400, "Font family name is required");
  const weight = Math.min(900, Math.max(100, Number(form.get("weight") || 400)));
  const style = String(form.get("style") || "normal") === "italic" ? "italic" : "normal";
  const storagePath = await saveFile("uploads", buf, file.name);
  return prisma.userFont.create({ data: { userId, family, weight, style, fileName: file.name, mimeType: FONT_MIME[ext], storagePath, size: buf.length, supportsArabic: form.get("supportsArabic") === "true" } });
});
