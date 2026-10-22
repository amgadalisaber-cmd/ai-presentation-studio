import fs from "fs/promises";
import path from "path";

export interface FontFile { family: string; weight: number; file: string }
export const FONT_FILES: FontFile[] = [
  { family: "Cairo", weight: 400, file: "Cairo-Regular.ttf" },
  { family: "Cairo", weight: 700, file: "Cairo-Bold.ttf" },
  { family: "Inter", weight: 400, file: "Inter-Regular.ttf" },
];

let cache: string | null = null;
/** @font-face CSS with embedded base64 fonts (for server-side PDF rendering). */
export async function embeddedFontCss() {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "public", "fonts");
  const rules: string[] = [];
  for (const f of FONT_FILES) {
    try {
      const b = await fs.readFile(path.join(dir, f.file));
      rules.push(`@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/ttf;base64,${b.toString("base64")}) format('truetype');}`);
    } catch { /* missing font: browser fallback */ }
  }
  cache = rules.join("\n");
  return cache;
}

export function publicFontCss() {
  return FONT_FILES.map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(/fonts/${f.file}) format('truetype');font-display:block;}`).join("\n");
}

export async function availableFonts() {
  const dir = path.join(process.cwd(), "public", "fonts");
  const out: { family: string; weight: number; present: boolean }[] = [];
  for (const f of FONT_FILES) { let present = true; try { await fs.access(path.join(dir, f.file)); } catch { present = false; } out.push({ family: f.family, weight: f.weight, present }); }
  return out;
}
