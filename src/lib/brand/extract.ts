import { extractText } from "../content/extract";
import { generateJson } from "../images/nanobanana";

export interface BrandKit {
  name?: string; description?: string; website?: string; positioning?: string; personality?: string; targetAudience?: string; industry?: string;
  colors: { name?: string; hex: string; role?: string; source: string }[];
  fonts: { heading?: string; body?: string; arabicHeading?: string; arabicBody?: string };
  rules: { category: string; rule: string; source: string }[];
  logos: { url?: string; fileName: string; data?: Buffer; mime: string; source: string }[];
  notes: string[];
}

const HEX_RE = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
const RGB_WORDS_RE = /\bR\s*:?\s*(\d{1,3})\s*[,/ ]\s*G\s*:?\s*(\d{1,3})\s*[,/ ]\s*B\s*:?\s*(\d{1,3})\b/gi;
const FONT_HINT_RE = /\b(?:typeface|typography|font(?:\s*family)?|headline font|heading font|body font|primary font|secondary font)\b\s*[:\-–—]?\s*([A-Z][A-Za-z0-9 ]{2,40}?)(?=[\n,.;(]|$)/gm;
const KNOWN_FONTS = ["Helvetica", "Helvetica Neue", "Arial", "Inter", "Roboto", "Montserrat", "Poppins", "Lato", "Open Sans", "Futura", "Gotham", "Proxima Nova", "Avenir", "Garamond", "Georgia", "Times New Roman", "Playfair Display", "DM Sans", "Manrope", "Source Sans", "Raleway", "Nunito", "Work Sans", "Cairo", "Tajawal", "Almarai", "Noto Sans Arabic", "Noto Kufi Arabic", "IBM Plex Sans Arabic", "Dubai", "Frutiger", "Univers", "Gill Sans", "Circular", "Graphik", "Sora", "Space Grotesk", "Bebas Neue", "Oswald", "Merriweather", "Lora"];
const ARABIC_FONTS = ["Cairo", "Tajawal", "Almarai", "Noto Sans Arabic", "Noto Kufi Arabic", "IBM Plex Sans Arabic", "Dubai", "Amiri", "Changa", "El Messiri", "Harmattan", "Lateef", "Markazi Text", "Readex Pro", "Rubik", "Vazirmatn"];
const RULE_HINTS: [RegExp, string][] = [[/clear\s*space|exclusion zone|safe area/i, "clear_space"], [/minimum size|logo size|proportion|scale the logo/i, "logo_proportions"], [/logo (placement|position)|place the logo|position the logo/i, "logo_placement"], [/colou?r (usage|palette|application)|use (the )?colou?rs|primary colou?r|secondary colou?r/i, "color_usage"], [/typograph|typeface|font/i, "typography"], [/photograph|imagery|image style|illustration/i, "image_treatment"], [/do not|don't|never|avoid|must not|prohibited/i, "dos_donts"], [/composition|layout|grid|white ?space/i, "composition"]];

function toHex(r: number, g: number, b: number) { return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join(""); }
function normHex(h: string) { const x = h.replace("#", "").toLowerCase(); return "#" + (x.length === 3 ? x.split("").map((c) => c + c).join("") : x); }

/** Colors, fonts and rules from brand-guideline text (deterministic). */
export function kitFromText(text: string, source: string): Partial<BrandKit> {
  const colors = new Map<string, BrandKit["colors"][number]>();
  for (const m of text.matchAll(HEX_RE)) { const hex = normHex(m[0]); if (!colors.has(hex)) colors.set(hex, { hex, source }); }
  for (const m of text.matchAll(RGB_RE)) { const hex = toHex(+m[1], +m[2], +m[3]); if (!colors.has(hex)) colors.set(hex, { hex, source }); }
  for (const m of text.matchAll(RGB_WORDS_RE)) { const hex = toHex(+m[1], +m[2], +m[3]); if (!colors.has(hex)) colors.set(hex, { hex, source }); }
  // names next to hex codes, e.g. "Midnight #0E1B2E" / "#0E1B2E Midnight"
  for (const line of text.split("\n")) { const m = line.match(/([A-Z][A-Za-z ]{2,24}?)\s*[:\-–—]?\s*(#[0-9a-f]{6}\b)/i) || line.match(/(#[0-9a-f]{6}\b)\s*[:\-–—]?\s*([A-Z][A-Za-z ]{2,24})\b/i); if (m) { const hex = normHex(m[1].startsWith("#") ? m[1] : m[2]); const name = (m[1].startsWith("#") ? m[2] : m[1]).trim(); const c = colors.get(hex); if (c && !c.name) c.name = name; } }
  const fonts: BrandKit["fonts"] = {};
  const found: string[] = [];
  for (const f of KNOWN_FONTS) if (new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "i").test(text)) found.push(f);
  for (const m of text.matchAll(FONT_HINT_RE)) { const name = m[1].trim(); if (name.length < 40 && !found.includes(name) && /^[A-Z]/.test(name)) found.push(name); }
  const arabic = found.filter((f) => ARABIC_FONTS.includes(f)); const latin = found.filter((f) => !ARABIC_FONTS.includes(f));
  if (latin[0]) fonts.heading = latin[0]; if (latin[1]) fonts.body = latin[1]; else if (latin[0]) fonts.body = latin[0];
  if (arabic[0]) { fonts.arabicHeading = arabic[0]; fonts.arabicBody = arabic[1] || arabic[0]; }
  const rules: BrandKit["rules"] = [];
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?؟])\s+/);
  for (const s of sentences) { if (s.length < 25 || s.length > 240) continue; const hit = RULE_HINTS.find(([re]) => re.test(s)); if (hit && /\b(must|should|always|never|do not|don't|avoid|keep|use|minimum|at least|only)\b|يجب|لا |دائماً|تجنب/i.test(s)) rules.push({ category: hit[1], rule: s.trim(), source }); if (rules.length >= 20) break; }
  return { colors: [...colors.values()].slice(0, 12), fonts, rules };
}

/** Dominant colors of a logo/image (PNG/JPEG/WEBP/BMP/GIF). Transparent and near-white pixels are ignored. */
export async function colorsFromImage(buf: Buffer, source: string): Promise<BrandKit["colors"]> {
  const { Jimp } = await import("jimp");
  const img = await Jimp.read(buf);
  img.resize({ w: 120 });
  const counts = new Map<string, number>();
  const { width, height, data } = img.bitmap;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue; // background white
    const q = (n: number) => Math.round(n / 24) * 24; // quantize
    const key = toHex(Math.min(255, q(r)), Math.min(255, q(g)), Math.min(255, q(b)));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n / total > 0.03).slice(0, 5);
  return sorted.map(([hex, n], i) => ({ hex, source, role: i === 0 ? "primary" : i === 1 ? "secondary" : "accent", name: `${Math.round((n / total) * 100)}% of logo` }));
}

/** Brand signals from a website: name, description, theme colors, fonts, logo candidates. */
export async function kitFromWebsite(url: string): Promise<Partial<BrandKit>> {
  const cheerio = await import("cheerio");
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const res = await fetch(full, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AIPresentationStudio/1.0)" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Website returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const base = new URL(res.url || full);
  const abs = (u?: string) => { try { return u ? new URL(u, base).toString() : undefined; } catch { return undefined; } };
  const kit: Partial<BrandKit> = { colors: [], fonts: {}, rules: [], logos: [], notes: [] };
  kit.name = $('meta[property="og:site_name"]').attr("content") || $("title").first().text().split(/[|\-–—]/)[0].trim() || undefined;
  kit.description = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || undefined;
  kit.website = base.origin;
  const theme = $('meta[name="theme-color"]').attr("content"); if (theme && /^#/.test(theme)) kit.colors!.push({ hex: normHex(theme), role: "primary", name: "theme-color", source: "website" });
  // inline + linked CSS (first 3 stylesheets)
  let css = $("style").map((_, el) => $(el).text()).get().join("\n");
  const links = $('link[rel="stylesheet"]').map((_, el) => abs($(el).attr("href"))).get().filter(Boolean).slice(0, 3) as string[];
  for (const l of links) { try { const r = await fetch(l, { headers: { "User-Agent": "Mozilla/5.0" } }); if (r.ok) css += "\n" + (await r.text()).slice(0, 400_000); } catch { /* skip */ } }
  const counts = new Map<string, number>();
  for (const m of css.matchAll(HEX_RE)) { const hex = normHex(m[0]); if (/^#(fff|ffffff|000|000000)$/i.test(hex)) continue; counts.set(hex, (counts.get(hex) || 0) + 1); }
  for (const [hex] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) if (!kit.colors!.some((c) => c.hex === hex)) kit.colors!.push({ hex, source: "website css", role: kit.colors!.length === 0 ? "primary" : undefined });
  const fontCounts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) { const first = m[1].split(",")[0].replace(/["']/g, "").trim(); if (first && !/inherit|initial|sans-serif|serif|monospace|system-ui|var\(/i.test(first)) fontCounts.set(first, (fontCounts.get(first) || 0) + 1); }
  const fonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  if (fonts[0]) kit.fonts!.heading = fonts[0]; if (fonts[1] || fonts[0]) kit.fonts!.body = fonts[1] || fonts[0];
  const ar = fonts.find((f) => ARABIC_FONTS.some((a) => f.toLowerCase().includes(a.toLowerCase()))); if (ar) { kit.fonts!.arabicHeading = ar; kit.fonts!.arabicBody = ar; }
  const logoCandidates = [$('link[rel="apple-touch-icon"]').attr("href"), $('meta[property="og:logo"]').attr("content"), ...$('img[src*="logo" i], img[alt*="logo" i], img[class*="logo" i], header img, nav img').map((_, el) => $(el).attr("src") || $(el).attr("data-src")).get(), $('meta[property="og:image"]').attr("content")].map(abs).filter(Boolean) as string[];
  for (const u of [...new Set(logoCandidates)].slice(0, 4)) {
    try { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } }); const mime = r.headers.get("content-type") || ""; if (!r.ok || !mime.startsWith("image/")) continue; const data = Buffer.from(await r.arrayBuffer()); if (data.length > 5 * 1024 * 1024 || data.length < 200) continue; kit.logos!.push({ url: u, fileName: u.split("/").pop()?.split("?")[0] || "logo", data, mime: mime.split(";")[0], source: "website" }); } catch { /* skip */ }
  }
  return kit;
}

/** Optional AI structuring of guideline text (only when GEMINI_API_KEY is set); output is validated and merged. */
export async function aiStructure(text: string): Promise<Partial<BrandKit> | null> {
  if (!process.env.GEMINI_API_KEY || text.length < 80) return null;
  const out = await generateJson<{ name?: string; industry?: string; description?: string; positioning?: string; personality?: string; targetAudience?: string; colors?: { name?: string; hex: string; role?: string }[]; fonts?: { heading?: string; body?: string; arabicHeading?: string; arabicBody?: string }; rules?: { category: string; rule: string }[] }>(
    `Extract the brand identity facts stated in this document. Only report what the document actually says (no invention). Categories for rules: logo_placement, logo_proportions, clear_space, color_usage, typography, image_treatment, composition, restrictions, dos_donts. Hex colors must be 6-digit. Keep rules as short quotes/paraphrases of the stated guideline.\n\nDOCUMENT:\n${text.slice(0, 60_000)}`,
    `{"name":"","industry":"","description":"","positioning":"","personality":"","targetAudience":"","colors":[{"name":"","hex":"#RRGGBB","role":"primary|secondary|accent|background|text"}],"fonts":{"heading":"","body":"","arabicHeading":"","arabicBody":""},"rules":[{"category":"","rule":""}]}`
  ).catch(() => null);
  if (!out) return null;
  return { name: out.name || undefined, industry: out.industry || undefined, description: out.description || undefined, positioning: out.positioning || undefined, personality: out.personality || undefined, targetAudience: out.targetAudience || undefined,
    colors: (out.colors || []).filter((c) => /^#?[0-9a-f]{6}$/i.test(c.hex || "")).map((c) => ({ ...c, hex: normHex(c.hex), source: "ai" })), fonts: out.fonts || {}, rules: (out.rules || []).filter((r) => r.rule).map((r) => ({ ...r, source: "ai" })) };
}

export function mergeKits(kits: Partial<BrandKit>[]): BrandKit {
  const out: BrandKit = { colors: [], fonts: {}, rules: [], logos: [], notes: [] };
  for (const k of kits) {
    for (const key of ["name", "description", "website", "positioning", "personality", "targetAudience", "industry"] as const) if (k[key] && !out[key]) out[key] = k[key];
    for (const c of k.colors || []) if (!out.colors.some((x) => x.hex === c.hex)) out.colors.push(c);
    for (const key of ["heading", "body", "arabicHeading", "arabicBody"] as const) if (k.fonts?.[key] && !out.fonts[key]) out.fonts[key] = k.fonts[key];
    for (const r of k.rules || []) if (!out.rules.some((x) => x.rule === r.rule)) out.rules.push(r);
    for (const l of k.logos || []) out.logos.push(l);
    out.notes.push(...(k.notes || []));
  }
  if (!out.colors.some((c) => c.role === "primary") && out.colors[0]) out.colors[0].role = "primary";
  return out;
}

/** Full pipeline: files (PDF/DOCX/PPTX/images) + optional website → brand kit. */
export async function buildKit(files: { name: string; mime: string; data: Buffer }[], website?: string): Promise<BrandKit> {
  const parts: Partial<BrandKit>[] = []; const notes: string[] = [];
  for (const f of files) {
    const ext = f.name.toLowerCase().split(".").pop() || "";
    const isImage = f.mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"].includes(ext);
    if (isImage) {
      const kit: Partial<BrandKit> = { logos: [{ fileName: f.name, data: f.data, mime: f.mime || `image/${ext === "jpg" ? "jpeg" : ext}`, source: "upload" }], colors: [] };
      if (ext !== "svg" && f.mime !== "image/svg+xml") { try { kit.colors = await colorsFromImage(f.data, `logo ${f.name}`); } catch (e) { notes.push(`Could not read colors from ${f.name}: ${(e as Error).message}`); } }
      else { const svg = f.data.toString("utf8"); kit.colors = [...new Set([...svg.matchAll(HEX_RE)].map((m) => normHex(m[0])))].filter((h) => !/^#(fff|ffffff|000|000000)$/i.test(h)).slice(0, 5).map((hex, i) => ({ hex, source: `logo ${f.name}`, role: i === 0 ? "primary" : i === 1 ? "secondary" : "accent" })); }
      parts.push(kit); continue;
    }
    try {
      const { text } = await extractText(f.data, f.name, f.mime);
      parts.push(kitFromText(text, f.name));
      const ai = await aiStructure(text); if (ai) parts.unshift(ai); else notes.push(`${f.name}: colors, fonts and rules were detected with pattern matching (set GEMINI_API_KEY for AI-structured extraction of positioning and rules).`);
    } catch (e) { notes.push(`${f.name}: ${(e as Error).message}`); }
  }
  if (website?.trim()) { try { parts.push(await kitFromWebsite(website.trim())); } catch (e) { notes.push(`Website: ${(e as Error).message}`); } }
  const kit = mergeKits(parts); kit.notes.push(...notes);
  return kit;
}
