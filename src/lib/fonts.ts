import { prisma } from "./db";
import { FONT_FILES } from "./render/fonts";
import { toDataUri } from "./storage";

export const SYSTEM_FONTS = ["Georgia", "Arial", "Helvetica", "Times New Roman", "Verdana", "Tahoma"];
export const FONT_MIME: Record<string, string> = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" };

export interface FontOption { family: string; source: "bundled" | "uploaded" | "system"; weights: number[]; supportsArabic: boolean; ids?: string[] }

/** All font families available to a user: bundled, uploaded, and common system fonts (not embedded in PDF). */
export async function fontOptions(userId: string): Promise<FontOption[]> {
  const out = new Map<string, FontOption>();
  for (const f of FONT_FILES) { const o = out.get(f.family) || { family: f.family, source: "bundled" as const, weights: [], supportsArabic: f.family === "Cairo" }; o.weights.push(f.weight); out.set(f.family, o); }
  const user = await prisma.userFont.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  for (const f of user) { const o = out.get(f.family) || { family: f.family, source: "uploaded" as const, weights: [], supportsArabic: f.supportsArabic, ids: [] }; o.weights.push(f.weight); o.supportsArabic = o.supportsArabic || f.supportsArabic; o.ids?.push(f.id); out.set(f.family, o); }
  for (const f of SYSTEM_FONTS) if (!out.has(f)) out.set(f, { family: f, source: "system", weights: [400, 700], supportsArabic: false });
  return [...out.values()];
}

/** @font-face CSS for a user's uploaded fonts, served by URL (browser) or embedded as base64 (PDF). */
export async function userFontCss(userId: string, embed: boolean) {
  const fonts = await prisma.userFont.findMany({ where: { userId } });
  const rules: string[] = [];
  for (const f of fonts) {
    const fmt = f.mimeType.includes("woff2") ? "woff2" : f.mimeType.includes("woff") ? "woff" : f.mimeType.includes("otf") ? "opentype" : "truetype";
    const src = embed ? await toDataUri(f.storagePath, f.mimeType) : `/api/files/font/${f.id}`;
    rules.push(`@font-face{font-family:'${f.family.replace(/'/g, "")}';font-weight:${f.weight};font-style:${f.style};src:url(${src}) format('${fmt}');font-display:block;}`);
  }
  return rules.join("\n");
}
