import { CANVAS_H, CANVAS_W, type BlockModel, type ElementModel, type ImageProps, type ShapeProps, type SlideModel, type TextProps, type Dir, type Lang } from "../types";
import type { StyleSpec } from "../styles/spec";
import { resolvePalette, withAlpha, type ResolvedPalette } from "./colors";
import { textHeight, countLines } from "./measure";
import { splitIntoFragments } from "../content/parser";
import { typeProfile, type CompanyEntry, type GenContext, type LogoRef } from "./types";

let W = CANVAS_W, H = CANVAS_H;
const portrait = () => W < H;
const MIN_BODY = 22;   // px on 1920 canvas (~11pt). Below this text is considered unreadable.

interface Rect { x: number; y: number; w: number; h: number }

interface Env {
  ctx: GenContext;
  spec: StyleSpec;
  pal: ResolvedPalette;
  margin: number;
  dir: Dir;
  primaryLogo?: LogoRef | null;
  images: LogoRef[];
  imageCursor: number;
  z: number;
  slideCount: number;
  imageSlots: number;
  radius: number;
  tone?: string;
}

function fontFor(env: Env, lang: Lang, heading: boolean) {
  const f = env.spec.fonts;
  const brandTypo = env.ctx.participants.find((p) => p.role === "primary")?.brand.typography || {};
  if (lang === "ar" || lang === "mixed") return heading ? (brandTypo.arabicHeadingFont || f.arabicHeading) : (brandTypo.arabicBodyFont || f.arabicBody);
  return heading ? f.heading : f.body;
}
function alignFor(dir: Dir, center = false): TextProps["align"] { return center ? "center" : dir === "rtl" ? "right" : "left"; }
function langOf(text: string): { lang: Lang; dir: Dir } {
  const ar = (text.match(/[؀-ۿ]/g) || []).length; const la = (text.match(/[A-Za-z]/g) || []).length;
  if (!ar && !la) return { lang: "neutral", dir: "ltr" };
  if (ar / (ar + la) >= 0.2 && la / (ar + la) >= 0.2) return { lang: "mixed", dir: ar >= la ? "rtl" : "ltr" };
  return ar > la ? { lang: "ar", dir: "rtl" } : { lang: "en", dir: "ltr" };
}

function text(env: Env, r: Rect, t: string, opts: Partial<TextProps> & { origin?: ElementModel["origin"]; blockId?: string; fragmentIndex?: number; fragmentCount?: number; heading?: boolean; lang?: Lang; dir?: Dir }): ElementModel {
  const detected = langOf(t);
  const lang = opts.lang || detected.lang;
  const dir = opts.dir || (lang === "neutral" ? env.dir : detected.dir);
  const role = opts.role || "body";
  const heading = opts.heading ?? (role === "h1" || role === "h2" || role === "h3");
  const props: TextProps = {
    text: t,
    fontFamily: opts.fontFamily || fontFor(env, lang, heading),
    fontSize: opts.fontSize || env.spec.scale.body,
    fontWeight: opts.fontWeight ?? (heading ? env.spec.fonts.headingWeight : env.spec.fonts.bodyWeight),
    color: opts.color || env.pal.text,
    align: opts.align || alignFor(dir, env.spec.composition.alignment === "center" && role !== "body"),
    dir, lang,
    lineHeight: opts.lineHeight ?? (heading ? 1.08 : env.spec.scale.lineHeight),
    letterSpacing: opts.letterSpacing ?? (heading && lang !== "ar" ? env.spec.fonts.headingLetterSpacing : 0),
    textTransform: opts.textTransform ?? (heading && lang !== "ar" && lang !== "mixed" ? env.spec.fonts.headingTransform : "none"),
    valign: opts.valign || "top",
    bullet: opts.bullet, bulletChar: opts.bulletChar, marker: opts.marker, italic: opts.italic, opacity: opts.opacity, role,
  };
  return { type: "text", origin: opts.origin || "content", x: r.x, y: r.y, w: r.w, h: r.h, z: env.z++, props, blockId: opts.blockId ?? null, fragmentIndex: opts.fragmentIndex ?? null, fragmentCount: opts.fragmentCount ?? null };
}
function shape(env: Env, r: Rect, props: ShapeProps, origin: ElementModel["origin"] = "decoration"): ElementModel {
  return { type: "shape", origin, x: r.x, y: r.y, w: r.w, h: r.h, z: env.z++, props };
}
function logo(env: Env, r: Rect, ref: LogoRef, origin: ElementModel["origin"] = "participant"): ElementModel {
  // fit logo into rect preserving aspect ratio
  const ar = ref.width && ref.height ? ref.width / ref.height : 2.5;
  let w = r.w, h = r.w / ar;
  if (h > r.h) { h = r.h; w = r.h * ar; }
  const x = env.dir === "rtl" ? r.x + r.w - w : r.x;
  const props: ImageProps = { fit: "contain", src: `/api/files/asset/${ref.assetId}`, alt: "logo" };
  return { type: "logo", origin, x, y: r.y + (r.h - h) / 2, w, h, z: env.z++, props, assetId: ref.assetId };
}
function imageEl(env: Env, r: Rect, opts: { assetId?: string; placeholder?: boolean; concept?: string; radius?: number }): ElementModel {
  const props: ImageProps = { fit: "cover", src: opts.assetId ? `/api/files/asset/${opts.assetId}` : undefined, placeholder: !opts.assetId, concept: opts.concept, cssFilter: env.spec.imageTreatment.cssFilter, radius: opts.radius };
  return { type: "image", origin: opts.assetId ? "content" : "ai_image", x: r.x, y: r.y, w: r.w, h: r.h, z: env.z++, props, assetId: opts.assetId || null };
}
function mirror(el: ElementModel): ElementModel { return { ...el, x: W - el.x - el.w }; }

function marginFor(spec: StyleSpec) { return spec.density === "airy" ? 128 : spec.density === "balanced" ? 104 : 84; }

function background(env: Env, kind: "normal" | "cover" | "section"): SlideModel["background"] {
  const b = env.spec.background;
  if (b.treatment === "gradient" && b.gradient && env.pal.source === "style") return { color: env.pal.background, gradient: b.gradient };
  if (b.treatment === "gradient") return { color: env.pal.background, gradient: `linear-gradient(135deg, ${env.pal.background} 0%, ${env.pal.surface} 100%)` };
  if ((b.treatment === "image-dark" || b.treatment === "image-light") && b.gradient && kind !== "normal") return { color: env.pal.background, gradient: env.pal.source === "style" ? b.gradient : undefined };
  return { color: env.pal.background };
}

/** Chrome: logo, slide number, confidentiality label, grid lines */
function chrome(env: Env, slide: SlideModel, slideNo: number) {
  const { spec, pal, margin } = env;
  const d = spec.decorative;
  const small = spec.scale.caption;
  if (d.gridLines) {
    for (let i = 1; i < 4; i++) slide.elements.push(shape(env, { x: margin + ((W - 2 * margin) / 4) * i, y: 0, w: 1, h: H }, { shape: "rect", fill: withAlpha(pal.text, 0.05) }));
  }
  if (d.frames) {
    const o = Math.round(margin * 0.45);
    slide.elements.push(shape(env, { x: o, y: o, w: W - 2 * o, h: H - 2 * o }, { shape: "rect", stroke: withAlpha(pal.accent, 0.45), strokeWidth: 1.5 }));
  }
  if (env.primaryLogo && slide.purpose !== "cover") {
    const lp = d.logoPosition; const box = { w: 220, h: 56 };
    const x = lp.endsWith("left") ? margin * 0.7 : W - margin * 0.7 - box.w;
    const y = lp.startsWith("top") ? margin * 0.6 : H - margin * 0.6 - box.h;
    slide.elements.push(logo(env, { x, y, ...box }, env.primaryLogo));
  }
  const rtl = env.dir === "rtl";
  if (d.slideNumbers && slide.purpose !== "cover") {
    const n = String(slideNo).padStart(2, "0");
    const r = { x: rtl ? margin : W - margin - 160, y: H - margin * 0.6 - 30, w: 160, h: 30 };
    slide.elements.push(text(env, r, n, { origin: "decoration", role: "caption", fontSize: small, color: pal.muted, align: rtl ? "left" : "right", dir: "ltr", lang: "neutral" }));
  }
  const conf = env.ctx.metadata.confidentiality?.trim();
  if (conf && slide.purpose !== "cover") {
    slide.elements.push(text(env, { x: rtl ? W - margin - 700 : margin, y: H - margin * 0.6 - 30, w: 700, h: 30 }, conf, { origin: "metadata", role: "caption", fontSize: small, color: pal.muted, dir: env.dir, align: rtl ? "right" : "left" }));
  }
}

/* ------------------------------------------------------------------ */
/* Regions                                                             */
/* ------------------------------------------------------------------ */
interface Regions { heading?: Rect; label?: Rect; columns: Rect[]; image?: Rect; index?: Rect }

function regions(env: Env, opts: { hasHeading: boolean; hasLabel: boolean; withImage: boolean; headingLines: number }): Regions {
  const { spec, margin: M } = env;
  const c = spec.composition;
  const top = M * 0.9;
  const hH = opts.hasHeading ? Math.round(spec.scale.h2 * 1.1 * Math.max(1, Math.min(opts.headingLines, 3)) + 24) : 0;
  const labelH = opts.hasLabel ? spec.scale.caption * 1.4 + 20 : 0;
  const bottom = H - M * 0.95;
  const gap = 56;
  const full = W - 2 * M;
  const img = opts.withImage && c.imagePlacement !== "none";
  const cols = (r: Rect, n: number): Rect[] => { const cw = (r.w - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: r.x + i * (cw + gap), y: r.y, w: cw, h: r.h })); };
  let image: Rect | undefined;
  let area: Rect = { x: M, y: top, w: full, h: bottom - top };
  if (img && portrait() && (c.imagePlacement === "right-half" || c.imagePlacement === "left-half" || c.imagePlacement === "inset")) {
    const bandH = Math.round(H * 0.34);
    image = { x: 0, y: 0, w: W, h: bandH }; area = { x: M, y: bandH + 48, w: full, h: bottom - bandH - 48 };
  } else if (img) {
    if (c.imagePlacement === "right-half") { image = { x: W / 2 + 40, y: 0, w: W / 2 - 40, h: H }; area = { x: M, y: top, w: W / 2 - M - 40, h: bottom - top }; }
    else if (c.imagePlacement === "left-half") { image = { x: 0, y: 0, w: W / 2 - 40, h: H }; area = { x: W / 2 + 40, y: top, w: W / 2 - M - 40, h: bottom - top }; }
    else if (c.imagePlacement === "top-band") { image = { x: M, y: top, w: full, h: 300 }; area = { x: M, y: top + 300 + 40, w: full, h: bottom - top - 340 }; }
    else if (c.imagePlacement === "inset") { image = { x: W - M - 560, y: top, w: 560, h: bottom - top }; area = { x: M, y: top, w: full - 560 - gap, h: bottom - top }; }
    else if (c.imagePlacement === "full-bleed") { image = { x: 0, y: 0, w: W, h: H }; area = { x: M, y: top, w: Math.min(full, 1000), h: bottom - top }; }
  }
  const out: Regions = { columns: [], image };
  let y = area.y;
  if (opts.hasLabel) { out.label = { x: area.x, y, w: area.w, h: labelH - 20 }; y += labelH; }
  if (opts.hasHeading) {
    if (c.headingPlacement === "side" && area.w > 1100) {
      const hw = Math.round(area.w * 0.36);
      out.heading = { x: area.x, y, w: hw, h: area.y + area.h - y };
      const body = { x: area.x + hw + gap, y, w: area.w - hw - gap, h: area.y + area.h - y };
      out.columns = cols(body, spec.density === "dense" && body.w > 900 ? 2 : 1);
      return out;
    }
    if (c.headingPlacement === "bottom") {
      out.heading = { x: area.x, y: area.y + area.h - hH, w: area.w, h: hH };
      const body = { x: area.x, y, w: area.w, h: area.h - hH - 40 };
      out.columns = cols(body, body.w > 1200 ? 2 : 1);
      return out;
    }
    out.heading = { x: area.x, y, w: area.w, h: hH }; y += hH + 20;
  }
  const body = { x: area.x, y, w: area.w, h: area.y + area.h - y };
  const n = c.contentLayout === "two-column" || c.contentLayout === "editorial" ? (body.w > 1000 ? 2 : 1) : c.contentLayout === "single-column" ? 1 : (spec.density === "dense" && body.w > 1300 ? 2 : 1);
  if (c.contentLayout === "single-column" && c.alignment === "center") { const w = Math.min(body.w, 1200); out.columns = [{ ...body, x: body.x + (body.w - w) / 2, w }]; }
  else out.columns = cols(body, n);
  return out;
}

/* ------------------------------------------------------------------ */
/* Content flow                                                        */
/* ------------------------------------------------------------------ */
interface Piece { block: BlockModel; text: string; fragmentIndex: number; fragmentCount: number }

function blockFontSize(env: Env, kind: BlockModel["kind"], level: number) {
  const s = env.spec.scale;
  if (kind === "heading") return s.h2;
  if (kind === "subheading") return level >= 3 ? s.h3 * 0.85 : s.h3;
  if (kind === "quote") return s.h3;
  return s.body;
}
function roleFor(kind: BlockModel["kind"], level: number): TextProps["role"] { return kind === "heading" ? "h2" : kind === "subheading" ? (level >= 3 ? "h3" : "h3") : kind === "quote" ? "quote" : "body"; }

function pieceHeight(env: Env, p: Piece, width: number, size: number) {
  const heading = p.block.kind === "heading" || p.block.kind === "subheading";
  const lh = heading ? 1.15 : env.spec.scale.lineHeight;
  const indent = p.block.kind === "list_item" ? 48 : 0;
  const upper = heading && env.spec.fonts.headingTransform === "uppercase" && p.block.lang === "en";
  return textHeight(p.text, size, width - indent, lh, { uppercase: upper, weight: heading ? env.spec.fonts.headingWeight : env.spec.fonts.bodyWeight }) + (heading ? 18 : 10);
}

/** Lay out a sequence of pieces into columns, returning the elements placed and the remaining pieces. */
function flow(env: Env, pieces: Piece[], columns: Rect[], scale = 1): { placed: ElementModel[]; rest: Piece[] } {
  const placed: ElementModel[] = [];
  let ci = 0; let y = columns[0].y;
  const rest = [...pieces];
  const gapAfter = env.spec.density === "airy" ? 26 : env.spec.density === "balanced" ? 18 : 12;
  while (rest.length && ci < columns.length) {
    const col = columns[ci];
    const p = rest[0];
    const size = Math.max(MIN_BODY, Math.round(blockFontSize(env, p.block.kind, p.block.level) * scale));
    const h = pieceHeight(env, p, col.w, size);
    const remaining = col.y + col.h - y;
    if (h <= remaining || (y === col.y && h <= col.h)) {
      const isList = p.block.kind === "list_item";
      const el = text(env, { x: col.x, y, w: col.w, h: Math.min(h, remaining > 0 ? Math.max(remaining, h) : h) }, p.text, {
        blockId: p.block.id, fragmentIndex: p.fragmentIndex, fragmentCount: p.fragmentCount,
        role: roleFor(p.block.kind, p.block.level), fontSize: size, lang: p.block.lang, dir: p.block.dir,
        bullet: isList, bulletChar: isList && !/^(\d+|[٠-٩]+)[.)]/.test(p.text) ? "•" : undefined, heading: p.block.kind === "heading" || p.block.kind === "subheading",
        color: p.block.kind === "subheading" ? env.pal.accent : p.block.kind === "quote" ? env.pal.text : env.pal.text,
        italic: p.block.kind === "quote", align: alignFor(p.block.dir, false),
      });
      // dense style: list items in rtl within ltr slide (or vice-versa) keep their own alignment
      placed.push(el);
      y += h + gapAfter;
      rest.shift();
      continue;
    }
    if (y === col.y && h > col.h) {
      // Piece alone doesn't fit a whole column: fragment it (paragraph/list) at sentence boundaries.
      const perLineChars = Math.max(20, Math.floor((col.w / (size * 0.55))));
      const linesFit = Math.max(2, Math.floor(col.h / (size * env.spec.scale.lineHeight)) - 1);
      const frags = splitIntoFragments(p.text, perLineChars * linesFit);
      if (frags.length > 1) {
        const base = p.fragmentIndex; const total = frags.length;
        // Re-map fragment indices: this piece's index becomes base..base+total-1 and subsequent pieces of the same block shift.
        const shift = total - 1;
        const newPieces: Piece[] = frags.map((f, i) => ({ block: p.block, text: f, fragmentIndex: base + i, fragmentCount: p.fragmentCount + shift }));
        rest.shift();
        for (const r of rest) if (r.block.id === p.block.id) { r.fragmentIndex += shift; r.fragmentCount += shift; }
        for (const el of placed) if (el.blockId === p.block.id && el.fragmentCount != null) el.fragmentCount += shift;
        rest.unshift(...newPieces);
        continue;
      }
      // Cannot split: shrink text within readability limits, otherwise place and flag (never hide).
      if (size > MIN_BODY) { return flow(env, pieces, columns, Math.max(MIN_BODY / blockFontSize(env, p.block.kind, p.block.level), scale * 0.85)); }
      const el = text(env, { x: col.x, y, w: col.w, h: col.h }, p.text, { blockId: p.block.id, fragmentIndex: p.fragmentIndex, fragmentCount: p.fragmentCount, role: roleFor(p.block.kind, p.block.level), fontSize: size, lang: p.block.lang, dir: p.block.dir });
      placed.push(el); rest.shift(); y = col.y + col.h; ci++; continue;
    }
    ci++; if (ci < columns.length) y = columns[ci].y;
  }
  return { placed, rest };
}

/* ------------------------------------------------------------------ */
/* Cards & rows for lists                                              */
/* ------------------------------------------------------------------ */
function tryCards(env: Env, pieces: Piece[], area: Rect): { placed: ElementModel[]; rest: Piece[] } | null {
  const items = pieces.filter((p) => p.block.kind === "list_item");
  if (items.length < 2 || items.length !== pieces.length) return null;
  const n = Math.min(items.length, 6);
  const colsN = portrait() ? Math.min(2, n) : n <= 3 ? n : n === 4 ? 2 : 3; const rowsN = Math.ceil(n / colsN);
  const gap = 32; const cw = (area.w - gap * (colsN - 1)) / colsN; const chMax = (area.h - gap * (rowsN - 1)) / rowsN;
  const pad = 36;
  const size = Math.max(MIN_BODY, Math.min(env.spec.scale.body, env.spec.scale.body * (cw > 500 ? 1 : 0.9)));
  const heights = items.slice(0, n).map((p) => pieceHeight(env, p, cw - pad * 2, size));
  if (heights.some((h) => h > chMax - pad * 2 - 40)) return null;
  const ch = Math.min(chMax, Math.max(...heights) + pad * 2 + 40 + (env.spec.density === "airy" ? 60 : 20));
  const placed: ElementModel[] = [];
  for (let i = 0; i < n; i++) {
    const p = items[i];
    const h = heights[i];
    const x = area.x + (i % colsN) * (cw + gap); const y = area.y + Math.floor(i / colsN) * (ch + gap);
    placed.push(shape(env, { x, y, w: cw, h: ch }, { shape: "rect", fill: env.pal.surface, radius: env.radius, stroke: withAlpha(env.pal.accent, 0.35), strokeWidth: 1 }));
    placed.push(shape(env, { x: env.dir === "rtl" ? x + cw - pad - 48 : x + pad, y: y + pad, w: 48, h: 6 }, { shape: "rect", fill: env.pal.accent }));
    placed.push(text(env, { x: x + pad, y: y + pad + 30, w: cw - pad * 2, h: ch - pad * 2 - 30 }, p.text, { blockId: p.block.id, fragmentIndex: p.fragmentIndex, fragmentCount: p.fragmentCount, fontSize: size, lang: p.block.lang, dir: p.block.dir, align: alignFor(p.block.dir) }));
  }
  return { placed, rest: items.slice(n) };
}

function tryRows(env: Env, pieces: Piece[], area: Rect): { placed: ElementModel[]; rest: Piece[] } | null {
  const items = pieces.filter((p) => p.block.kind === "list_item");
  if (items.length < 2 || items.length !== pieces.length) return null;
  const placed: ElementModel[] = [];
  let y = area.y; let i = 0;
  const numW = 110; const gap = 22;
  for (; i < items.length; i++) {
    const p = items[i];
    const size = env.spec.scale.body;
    const h = pieceHeight(env, p, area.w - numW - 30, size) + 14;
    if (y + h > area.y + area.h) break;
    const rtl = env.dir === "rtl";
    placed.push(shape(env, { x: area.x, y: y + h - 2, w: area.w, h: 1 }, { shape: "rect", fill: withAlpha(env.pal.text, 0.15) }));
    placed.push(text(env, { x: rtl ? area.x + area.w - numW : area.x, y: y + 2, w: numW, h: h - 10 }, String(i + 1).padStart(2, "0"), { origin: "decoration", role: "number", fontSize: Math.round(size * 1.25), fontWeight: 700, color: env.pal.accent, dir: "ltr", lang: "neutral", align: rtl ? "right" : "left", fontFamily: env.spec.fonts.heading }));
    placed.push(text(env, { x: rtl ? area.x : area.x + numW + 30, y: y + 6, w: area.w - numW - 30, h: h - 10 }, p.text, { blockId: p.block.id, fragmentIndex: p.fragmentIndex, fragmentCount: p.fragmentCount, fontSize: size, lang: p.block.lang, dir: p.block.dir, align: alignFor(p.block.dir) }));
    y += h + gap;
  }
  if (i === 0) return null;
  return { placed, rest: items.slice(i) };
}

/* ------------------------------------------------------------------ */
/* Image prompt                                                        */
/* ------------------------------------------------------------------ */
function brandRestrictions(env: Env) {
  const rules: string[] = [];
  for (const p of env.ctx.participants) for (const g of p.brand.guidelines) if (/image|restriction|donts|dos_donts|composition/.test(g.category)) rules.push(`${p.brand.name}: ${g.rule}`);
  return rules;
}
export function buildImagePrompt(env: Env, concept: string) {
  const it = env.spec.imageTreatment;
  const parts = [it.promptPrefix, `Subject: ${concept}.`];
  if (env.spec.lighting) parts.push(`Lighting: ${env.spec.lighting}`);
  const voice = env.ctx.metadata.voice || env.spec.voice; if (env.tone || voice) parts.push(`Tone & voice: ${[env.tone, voice].filter(Boolean).join(" — ")}.`);
  if (env.ctx.customDirection) parts.push(`Art direction notes: ${env.ctx.customDirection}`);
  const r = brandRestrictions(env); if (r.length) parts.push(`Brand restrictions: ${r.join("; ")}`);
  parts.push(`Aspect ratio ${it.aspect}. Absolutely no text, lettering, logos or watermarks in the image.`);
  return parts.join(" ");
}
function conceptFrom(env: Env, heading: string | undefined, body: string | undefined, hint?: string) {
  if (hint) return hint;
  const h = (heading || env.ctx.name).trim();
  const b = (body || "").replace(/\s+/g, " ").slice(0, 220);
  return `A visual metaphor for "${h}"${b ? ` — context: ${b}` : ""}. Presentation type: ${env.ctx.typeLabel}.`;
}

/* ------------------------------------------------------------------ */
/* Cover / section / participants / closing                            */
/* ------------------------------------------------------------------ */
function entryLines(e: CompanyEntry) {
  const parts = [e.name]; if (e.title) parts.push(e.title); if (e.contactName) parts.push(e.contactName); if (e.department) parts.push(e.department);
  return parts;
}

function companiesRow(env: Env, entries: CompanyEntry[], r: Rect, label: string, opts: { compact?: boolean } = {}): ElementModel[] {
  const out: ElementModel[] = [];
  if (!entries.length) return out;
  const { spec, pal } = env; const rtl = env.dir === "rtl";
  out.push(text(env, { x: r.x, y: r.y, w: r.w, h: spec.scale.caption * 1.5 }, label, { origin: "metadata", role: "label", fontSize: spec.scale.caption, color: pal.muted, letterSpacing: 2, textTransform: "uppercase", dir: env.dir, lang: env.dir === "rtl" ? "ar" : "en" }));
  let x = rtl ? r.x + r.w : r.x; const y = r.y + spec.scale.caption * 1.5 + 14;
  const logoH = opts.compact ? 56 : 72; const gap = 44;
  for (const e of entries) {
    const lines = entryLines(e); const nameSize = opts.compact ? spec.scale.caption + 2 : spec.scale.body - 2;
    let itemW = 0;
    if (e.logo && e.showLogo) {
      const ar = e.logo.width && e.logo.height ? e.logo.width / e.logo.height : 2.5; const lw = Math.min(260, logoH * ar);
      const lx = rtl ? x - lw : x;
      out.push(logo(env, { x: lx, y, w: lw, h: logoH }, e.logo));
      itemW = lw;
      const tw = Math.max(240, Math.min(420, lines[0].length * nameSize * 0.6));
      const ty = y + logoH + 10;
      out.push(text(env, { x: rtl ? x - tw : x, y: ty, w: tw, h: lines.length * nameSize * 1.3 + 8 }, lines.join("\n"), { origin: "participant", role: "caption", fontSize: nameSize - 4, color: pal.muted, dir: env.dir }));
      itemW = Math.max(itemW, Math.min(tw, lw + 40));
    } else {
      const tw = Math.max(260, Math.min(480, Math.max(...lines.map((l) => l.length)) * nameSize * 0.58));
      out.push(text(env, { x: rtl ? x - tw : x, y, w: tw, h: lines.length * nameSize * 1.35 + 10 }, lines.join("\n"), { origin: "participant", role: "body", fontSize: nameSize, fontWeight: 600, color: pal.text, dir: env.dir }));
      itemW = tw;
    }
    x = rtl ? x - itemW - gap : x + itemW + gap;
    if (rtl ? x < r.x : x > r.x + r.w) break;
  }
  return out;
}

/** Presented-by / presented-to row rectangles: side by side in landscape, stacked in portrait. */
function rowRects(x: number, y: number, w: number, h: number, grow: "up" | "down"): { byR: Rect; toR: Rect } {
  if (!portrait()) return { byR: { x, y, w: w / 2 - 20, h }, toR: { x: x + w / 2 + 20, y, w: w / 2 - 20, h } };
  return grow === "up" ? { byR: { x, y: y - h - 10, w, h }, toR: { x, y, w, h } } : { byR: { x, y, w, h }, toR: { x, y: y + h + 10, w, h } };
}

function coverSlide(env: Env): SlideModel {
  const { spec, pal, margin: M, ctx } = env;
  const slide: SlideModel = { index: 0, layoutKey: `cover-${spec.composition.coverLayout}`, purpose: "cover", background: background(env, "cover"), styleId: env.ctx.styleId, elements: [] };
  const title = ctx.name; const subtitle = typeProfile(ctx.type).subtitle ? ctx.typeLabel : "";
  const metaBits: string[] = [];
  const md = ctx.metadata;
  if (md.projectName) metaBits.push(md.projectName);
  if (md.date) metaBits.push(md.date);
  if (md.version) metaBits.push(md.version);
  if (md.referenceNumber) metaBits.push(md.referenceNumber);
  if (md.preparedBy) metaBits.push(md.preparedBy);
  for (const c of md.custom || []) if (c.label || c.value) metaBits.push([c.label, c.value].filter(Boolean).join(": "));
  const titleLang = langOf(title);
  const h1 = spec.scale.h1; const tSize = title.length > 60 ? Math.round(h1 * 0.6) : title.length > 32 ? Math.round(h1 * 0.78) : h1;
  const lay = spec.composition.coverLayout;
  const wantImage = ctx.aiImages && spec.composition.imagePlacement !== "none";
  const concept = conceptFrom(env, undefined, ctx.blocks.find((b) => b.kind === "paragraph")?.text, undefined);

  const by = ctx.presentedByEnabled ? ctx.presentedBy : []; const to = ctx.presentedToEnabled ? ctx.presentedTo : [];
  const others = ctx.participants.filter((p) => p.role !== "primary" && p.brand.logo);
  const byLabel = env.dir === "rtl" ? "مقدم من" : "Presented by"; const toLabel = env.dir === "rtl" ? "مقدم إلى" : "Presented to";
  const upper = spec.fonts.headingTransform === "uppercase" && titleLang.lang === "en";
  const tLines = (width: number, size = tSize) => countLines(title, size, width, { uppercase: upper, weight: spec.fonts.headingWeight, letterSpacing: titleLang.lang === "ar" ? 0 : spec.fonts.headingLetterSpacing });
  const titleH = (lines: number, size = tSize) => size * 1.12 * lines + 12;
  const lines = tLines(W - 2 * M);
  const titleOpts = { origin: "metadata" as const, role: "h1" as const, fontSize: tSize, lineHeight: 1.05, lang: titleLang.lang, dir: titleLang.dir };

  if (lay === "centered" || lay === "poster") {
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "background" }; slide.background.overlay = spec.background.overlay || `linear-gradient(180deg, ${withAlpha(pal.background, 0.55)}, ${withAlpha(pal.background, 0.85)})`; }
    const center = lay === "centered";
    const pSize = lay === "poster" ? Math.min(tSize * 1.1, 170) : tSize; const tw = center ? 1400 : W - 2 * M; const th = titleH(Math.min(4, tLines(tw, pSize)), pSize);
    const ty = center ? 300 : H - M - th - 170;
    slide.elements.push(text(env, { x: center ? (W - tw) / 2 : M, y: ty, w: tw, h: th }, title, { ...titleOpts, align: center ? "center" : alignFor(titleLang.dir), fontSize: pSize }));
    if (subtitle) slide.elements.push(text(env, { x: center ? (W - tw) / 2 : M, y: ty + th + 18, w: tw, h: 60 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.h3 * 0.8, color: pal.accent, letterSpacing: 3, textTransform: "uppercase", align: center ? "center" : alignFor(env.dir), dir: env.dir }));
    if (metaBits.length) slide.elements.push(text(env, { x: center ? (W - tw) / 2 : M, y: ty + th + 90, w: tw, h: 40 }, metaBits.join("   ·   "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, align: center ? "center" : alignFor(env.dir), dir: env.dir }));
    if (spec.decorative.largeIndex && lay === "poster") slide.elements.push(text(env, { x: M, y: M * 0.6, w: 600, h: 250 }, "01", { origin: "decoration", role: "number", fontSize: 200, lineHeight: 1.1, fontWeight: 900, color: withAlpha(pal.accent, 0.9), dir: "ltr", lang: "neutral", fontFamily: spec.fonts.heading }));
    if (spec.decorative.rules && center) slide.elements.push(shape(env, { x: W / 2 - 60, y: ty - 40, w: 120, h: 3 }, { shape: "rect", fill: pal.accent }));
    const rowY = center ? H - M - 150 : M * 0.7;
    const rowX = center ? M : M + (spec.decorative.largeIndex && !portrait() ? 360 : 0);
    const rr = rowRects(rowX, rowY, W - M - rowX, 150, center ? "up" : "down");
    if (by.length) slide.elements.push(...companiesRow(env, by, rr.byR, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, rr.toR, toLabel, { compact: true }));
  } else if (lay === "split" && portrait()) {
    const bandH = Math.round(H * 0.46);
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "element", elementKey: "cover-image" }; slide.elements.push(imageEl(env, { x: 0, y: 0, w: W, h: bandH }, { placeholder: true, concept })); }
    else slide.elements.push(shape(env, { x: 0, y: 0, w: W, h: bandH }, { shape: "rect", fill: pal.surface }), shape(env, { x: 0, y: bandH, w: W, h: 10 }, { shape: "rect", fill: pal.accent }));
    const tw = W - 2 * M; const th = titleH(Math.min(5, tLines(tw)));
    const ty = bandH + 90;
    slide.elements.push(text(env, { x: M, y: ty, w: tw, h: th }, title, titleOpts));
    if (subtitle) slide.elements.push(text(env, { x: M, y: ty + th + 16, w: tw, h: 50 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.h3 * 0.8, color: pal.accent, letterSpacing: 3, textTransform: "uppercase", dir: env.dir }));
    if (metaBits.length) slide.elements.push(text(env, { x: M, y: ty + th + 80, w: tw, h: 70 }, metaBits.join("  ·  "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, dir: env.dir }));
    const rr = rowRects(M, H - M - 160, tw, 150, "up");
    if (by.length) slide.elements.push(...companiesRow(env, by, rr.byR, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, rr.toR, toLabel, { compact: true }));
  } else if (lay === "split") {
    const half = W / 2;
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "element", elementKey: "cover-image" }; slide.elements.push({ ...imageEl(env, { x: half, y: 0, w: half, h: H }, { placeholder: true, concept }), props: { ...imageEl(env, { x: 0, y: 0, w: 1, h: 1 }, { placeholder: true }).props, concept } as ImageProps }); }
    else slide.elements.push(shape(env, { x: half, y: 0, w: half, h: H }, { shape: "rect", fill: pal.surface }), shape(env, { x: half, y: 0, w: 10, h: H }, { shape: "rect", fill: pal.accent }));
    const tw = half - M - 60; const th = titleH(Math.min(5, tLines(tw)));
    const ty = H * 0.3;
    slide.elements.push(text(env, { x: M, y: ty, w: tw, h: th }, title, titleOpts));
    if (subtitle) slide.elements.push(text(env, { x: M, y: ty + th + 16, w: tw, h: 50 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.h3 * 0.8, color: pal.accent, letterSpacing: 3, textTransform: "uppercase", dir: env.dir }));
    if (metaBits.length) slide.elements.push(text(env, { x: M, y: ty + th + 80, w: tw, h: 70 }, metaBits.join("  ·  "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, dir: env.dir }));
    const rowY = H - M - 160;
    if (by.length) slide.elements.push(...companiesRow(env, by, { x: M, y: rowY, w: tw, h: 160 }, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, { x: half + 80, y: rowY, w: half - 80 - M, h: 160 }, toLabel, { compact: true }).map((e) => ({ ...e, props: e.type === "text" ? { ...(e.props as TextProps), color: pal.text } : e.props })));
  } else if (lay === "bottom-band") {
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "background" }; slide.background.overlay = spec.background.overlay; }
    const tw = W - 2 * M; const th = titleH(Math.min(4, lines));
    const ty = H - M - th - 150;
    if (spec.decorative.rules) slide.elements.push(shape(env, { x: M, y: ty - 36, w: 160, h: 4 }, { shape: "rect", fill: pal.accent }));
    slide.elements.push(text(env, { x: M, y: ty, w: tw, h: th }, title, titleOpts));
    if (subtitle) slide.elements.push(text(env, { x: M, y: ty + th + 16, w: tw / 2, h: 50 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.h3 * 0.75, color: pal.accent, letterSpacing: 3, textTransform: "uppercase", dir: env.dir }));
    if (metaBits.length) slide.elements.push(text(env, { x: M, y: ty + th + 70, w: tw / 2, h: 40 }, metaBits.join("  ·  "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, dir: env.dir }));
    const rowY = M * 0.8; const rr = rowRects(M, rowY, W - 2 * M, 150, "down");
    if (by.length) slide.elements.push(...companiesRow(env, by, rr.byR, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, rr.toR, toLabel, { compact: true }));
  } else if (lay === "grid") {
    slide.elements.push(shape(env, { x: 0, y: 0, w: W, h: 24 }, { shape: "rect", fill: pal.accent }));
    for (let i = 1; i < 4; i++) slide.elements.push(shape(env, { x: M + ((W - 2 * M) / 4) * i, y: 0, w: 1, h: H }, { shape: "rect", fill: withAlpha(pal.text, 0.08) }));
    const tw = (W - 2 * M) * 0.75; const th = titleH(Math.min(4, tLines(tw)));
    slide.elements.push(text(env, { x: M, y: M, w: tw, h: th }, title, titleOpts));
    if (subtitle) slide.elements.push(text(env, { x: M, y: M + th + 20, w: tw, h: 50 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.h3 * 0.8, color: pal.accent, dir: env.dir, fontWeight: 700 }));
    if (metaBits.length) slide.elements.push(text(env, { x: M, y: M + th + 80, w: tw, h: 50 }, metaBits.join("  /  "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, dir: env.dir }));
    slide.elements.push(shape(env, { x: M, y: H - M - 220, w: (W - 2 * M) / 4 - 30, h: 220 }, { shape: "rect", fill: pal.accent }));
    const rowY = H - M - 160; const rr = rowRects(M + (W - 2 * M) / 4, rowY, (W - 2 * M) * 0.75, 160, "up");
    if (by.length) slide.elements.push(...companiesRow(env, by, rr.byR, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, rr.toR, toLabel, { compact: true }));
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "element", elementKey: "cover-image" }; slide.elements.push(imageEl(env, { x: M + tw + 40, y: M, w: W - 2 * M - tw - 40, h: H - 2 * M - 250 }, { placeholder: true, concept })); }
  } else { // left-stack
    if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "element", elementKey: "cover-image" }; slide.elements.push(imageEl(env, portrait() ? { x: M, y: M, w: W - 2 * M, h: Math.round(H * 0.3) } : { x: W - M - 640, y: M, w: 640, h: H - 2 * M }, { placeholder: true, concept, radius: 8 })); }
    const tw = portrait() ? W - 2 * M : wantImage ? W - 2 * M - 700 : W - 2 * M - 200; const th = titleH(Math.min(5, tLines(tw)));
    const ty = portrait() && wantImage ? M + Math.round(H * 0.3) + 110 : M + 120;
    if (subtitle) slide.elements.push(text(env, { x: M, y: ty - 60, w: tw, h: 46 }, subtitle, { origin: "metadata", role: "label", fontSize: spec.scale.caption + 2, color: pal.accent, letterSpacing: 3, textTransform: "uppercase", dir: env.dir }));
    slide.elements.push(text(env, { x: M, y: ty, w: tw, h: th }, title, titleOpts));
    if (spec.decorative.rules) slide.elements.push(shape(env, { x: M, y: ty + th + 30, w: 120, h: 3 }, { shape: "rect", fill: pal.accent }));
    if (metaBits.length) slide.elements.push(text(env, { x: M, y: ty + th + 56, w: tw, h: 70 }, metaBits.join("  ·  "), { origin: "metadata", role: "caption", fontSize: spec.scale.caption, color: pal.muted, dir: env.dir }));
    const rowY = H - M - 160; const rr = rowRects(M, rowY, tw, 160, "up");
    if (by.length) slide.elements.push(...companiesRow(env, by, rr.byR, byLabel, { compact: true }));
    if (to.length) slide.elements.push(...companiesRow(env, to, rr.toR, toLabel, { compact: true }));
  }
  // Partner / sponsor / collaborator logos as a small footer row
  if (others.length) {
    let x = env.dir === "rtl" ? W - M : M; const y = H - M * 0.55 - 40;
    for (const p of others) {
      const ref = p.brand.logo!; const ar = ref.width && ref.height ? ref.width / ref.height : 2.5; const lw = Math.min(160, 40 * ar);
      slide.elements.push(logo(env, { x: env.dir === "rtl" ? x - lw : x, y, w: lw, h: 40 }, ref));
      x = env.dir === "rtl" ? x - lw - 36 : x + lw + 36;
    }
  }
  if (env.dir === "rtl") slide.elements = slide.elements.map((e) => (e.type === "text" || e.type === "logo" || (e.type === "shape" && e.w < W) || e.type === "image" ? mirror(e) : e));
  return slide;
}

function sectionSlide(env: Env, heading: BlockModel, sectionNo: number, body?: BlockModel): SlideModel {
  const { spec, pal, margin: M } = env;
  const slide: SlideModel = { index: 0, layoutKey: "section", purpose: "section", background: background(env, "section"), styleId: env.ctx.styleId, elements: [] };
  const wantImage = env.ctx.aiImages && spec.composition.imagePlacement !== "none" && typeProfile(env.ctx.type).imageFrequency !== "none";
  const concept = conceptFrom(env, heading.text, body?.text);
  const center = spec.composition.alignment === "center";
  if (wantImage) { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "background" }; slide.background.overlay = spec.background.overlay || `linear-gradient(90deg, ${withAlpha(pal.background, 0.9)}, ${withAlpha(pal.background, 0.5)})`; }
  else if (env.images.length) { const ref = env.images[env.imageCursor++ % env.images.length]; slide.background.imageAssetId = ref.assetId; slide.background.imageSrc = `/api/files/asset/${ref.assetId}`; slide.background.overlay = spec.background.overlay || `linear-gradient(90deg, ${withAlpha(pal.background, 0.92)}, ${withAlpha(pal.background, 0.55)})`; }
  const size = Math.min(spec.scale.h1 * 0.9, heading.text.length > 40 ? spec.scale.h1 * 0.6 : spec.scale.h1 * 0.9) * (portrait() ? 0.85 : 1);
  const tw = center ? Math.min(1400, W - 2 * M) : Math.min(1300, W - 2 * M);
  const upperH = spec.fonts.headingTransform === "uppercase" && heading.lang === "en";
  const th = size * 1.1 * Math.min(5, countLines(heading.text, size, tw, { uppercase: upperH, weight: spec.fonts.headingWeight, letterSpacing: heading.lang === "ar" ? 0 : spec.fonts.headingLetterSpacing })) + 20;
  const ty = spec.composition.headingPlacement === "bottom" ? H - M - th - 60 : (H - th) / 2 - 40;
  if (spec.decorative.sectionNumbers) slide.elements.push(text(env, { x: center ? (W - 300) / 2 : M, y: ty - (spec.decorative.largeIndex ? 210 : spec.scale.h3 * 1.3 + 20), w: spec.decorative.largeIndex ? 600 : 300, h: spec.decorative.largeIndex ? 200 : spec.scale.h3 * 1.3 }, String(sectionNo).padStart(2, "0"), { origin: "decoration", role: "number", fontSize: spec.decorative.largeIndex ? 170 : spec.scale.h3, lineHeight: 1.1, fontWeight: spec.decorative.largeIndex ? 900 : 500, color: pal.accent, dir: "ltr", lang: "neutral", align: center ? "center" : "left", fontFamily: spec.fonts.heading }));
  if (spec.decorative.dividerStyle === "block") slide.elements.push(shape(env, { x: env.dir === "rtl" ? W - M - 18 : M - 40, y: ty, w: 18, h: th }, { shape: "rect", fill: pal.accent }));
  if (spec.decorative.dividerStyle === "line") slide.elements.push(shape(env, { x: center ? W / 2 - 60 : M, y: ty + th + 24, w: 120, h: 3 }, { shape: "rect", fill: pal.accent }));
  slide.elements.push(text(env, { x: center ? (W - tw) / 2 : M, y: ty, w: tw, h: th }, heading.text, { blockId: heading.id, fragmentIndex: 0, fragmentCount: 1, role: "h1", fontSize: size, lineHeight: 1.08, lang: heading.lang, dir: heading.dir, align: center ? "center" : alignFor(heading.dir) }));
  if (env.dir === "rtl") slide.elements = slide.elements.map((e) => (e.type === "shape" && e.w >= W ? e : mirror(e)));
  return slide;
}

function participantsSlide(env: Env): SlideModel | null {
  const by = env.ctx.presentedByEnabled ? env.ctx.presentedBy : []; const to = env.ctx.presentedToEnabled ? env.ctx.presentedTo : [];
  if (by.length + to.length < 3) return null;
  const { spec, margin: M } = env;
  const slide: SlideModel = { index: 0, layoutKey: "participants", purpose: "participants", background: background(env, "normal"), styleId: env.ctx.styleId, elements: [] };
  const byLabel = env.dir === "rtl" ? "مقدم من" : "Presented by"; const toLabel = env.dir === "rtl" ? "مقدم إلى" : "Presented to";
  const colW = portrait() ? W - 2 * M : (W - 2 * M - 80) / 2;
  const list = (entries: CompanyEntry[], x: number, label: string) => {
    const out: ElementModel[] = [];
    out.push(text(env, { x, y: M, w: colW, h: 50 }, label, { origin: "metadata", role: "label", fontSize: spec.scale.caption + 2, color: env.pal.accent, letterSpacing: 3, textTransform: "uppercase", dir: env.dir }));
    let y = M + 80;
    for (const e of entries) {
      if (e.logo && e.showLogo) { out.push(logo(env, { x, y, w: 220, h: 64 }, e.logo)); y += 74; }
      const lines = entryLines(e);
      out.push(text(env, { x, y, w: colW, h: lines.length * spec.scale.body * 1.4 + 10 }, lines.join("\n"), { origin: "participant", fontSize: spec.scale.body, fontWeight: 600, dir: env.dir }));
      y += lines.length * spec.scale.body * 1.4 + 40;
      if (y > H - M) break;
    }
    return out;
  };
  if (by.length) slide.elements.push(...list(by, M, byLabel));
  if (to.length) { const toEls = list(to, portrait() ? M : M + colW + 80, toLabel); if (portrait()) { const byBottom = Math.max(M, ...slide.elements.map((e) => e.y + e.h)) + 60 - M; for (const e of toEls) e.y += byBottom; } slide.elements.push(...toEls); }
  if (env.dir === "rtl") slide.elements = slide.elements.map(mirror);
  return slide;
}

function closingSlide(env: Env): SlideModel | null {
  const by = env.ctx.presentedByEnabled ? env.ctx.presentedBy : [];
  const { spec, pal, margin: M } = env;
  const slide: SlideModel = { index: 0, layoutKey: "closing", purpose: "closing", background: background(env, "section"), styleId: env.ctx.styleId, elements: [] };
  const center = spec.composition.alignment === "center" || spec.composition.coverLayout === "centered";
  const titleLang = langOf(env.ctx.name);
  const cx = center && !portrait() ? 260 : M; const cw = W - 2 * cx;
  const cLines = countLines(env.ctx.name, spec.scale.h2, cw, { uppercase: spec.fonts.headingTransform === "uppercase" && titleLang.lang === "en", weight: spec.fonts.headingWeight, letterSpacing: titleLang.lang === "ar" ? 0 : spec.fonts.headingLetterSpacing });
  const cth = spec.scale.h2 * 1.12 * Math.min(5, cLines) + 16;
  slide.elements.push(text(env, { x: cx, y: H / 2 - cth + 10, w: cw, h: cth }, env.ctx.name, { origin: "metadata", role: "h2", fontSize: spec.scale.h2, align: center ? "center" : alignFor(titleLang.dir), lang: titleLang.lang, dir: titleLang.dir }));
  if (spec.decorative.rules) slide.elements.push(shape(env, { x: center ? W / 2 - 60 : M, y: H / 2 + 30, w: 120, h: 3 }, { shape: "rect", fill: pal.accent }));
  if (by.length) slide.elements.push(...companiesRow(env, by, { x: cx, y: H / 2 + 70, w: cw, h: 160 }, env.dir === "rtl" ? "مقدم من" : "Presented by", { compact: true }));
  if (env.dir === "rtl") slide.elements = slide.elements.map(mirror);
  return slide;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
/** Applies tone & voice to a style spec (visual knobs only; wording is never affected). */
export function toneAdjust(spec: StyleSpec, tone?: string): { spec: StyleSpec; radius: number } {
  const t = (tone || spec.tone || "").toLowerCase();
  const out: StyleSpec = JSON.parse(JSON.stringify(spec));
  let radius = out.decorative.frames ? 18 : 6;
  if (t === "fun" || t === "playful") { radius = 28; out.fonts.headingWeight = Math.max(700, out.fonts.headingWeight); out.imageTreatment.promptPrefix += " Playful, vibrant, lively mood."; out.decorative.largeIndex = true; }
  else if (t === "bold" || t === "energetic") { out.fonts.headingWeight = Math.min(900, out.fonts.headingWeight + 100); out.fonts.headingTransform = "uppercase"; out.scale.h1 = Math.round(out.scale.h1 * 1.08); out.imageTreatment.promptPrefix += " High-energy, dynamic, high contrast."; }
  else if (t === "calm" || t === "minimal") { out.scale.lineHeight = Math.min(1.8, out.scale.lineHeight + 0.1); out.density = "airy"; out.imageTreatment.promptPrefix += " Calm, quiet, serene, uncluttered."; radius = 4; }
  else if (t === "luxurious") { out.fonts.headingLetterSpacing = Math.max(out.fonts.headingLetterSpacing, 2); out.fonts.headingWeight = Math.min(out.fonts.headingWeight, 500); out.imageTreatment.promptPrefix += " Refined, luxurious, premium materials."; radius = 0; }
  else if (t === "serious" || t === "professional" || t === "technical") { radius = t === "technical" ? 0 : 6; out.imageTreatment.promptPrefix += t === "technical" ? " Precise, technical, objective." : " Professional, credible, composed."; }
  else if (t === "friendly" || t === "inspirational") { radius = 16; out.imageTreatment.promptPrefix += t === "friendly" ? " Warm, approachable, human." : " Uplifting, aspirational, bright."; }
  return { spec: out, radius };
}

export function makeEnv(ctx: GenContext): Env {
  const size = ctx.orientation === "portrait" ? { w: CANVAS_H, h: CANVAS_W } : { w: CANVAS_W, h: CANVAS_H };
  W = size.w; H = size.h;
  const tone = ctx.metadata.tone || ctx.spec.tone;
  const adjusted = toneAdjust(ctx.spec, tone);
  const spec = adjusted.spec;
  if (W < H) { spec.scale.body = Math.round(spec.scale.body * 1.1); spec.scale.h3 = Math.round(spec.scale.h3 * 1.05); }
  const primary = ctx.participants.find((p) => p.role === "primary") || ctx.participants[0];
  const pal = resolvePalette(spec, primary?.brand.colors, ctx.metadata.colorMode || "auto");
  const dir: Dir = ctx.language === "ar" ? "rtl" : ctx.language === "ar-en" ? (ctx.blocks.filter((b) => b.dir === "rtl").length >= ctx.blocks.length / 2 ? "rtl" : "ltr") : "ltr";
  return { ctx, spec, pal, margin: marginFor(spec) * (W < H ? 0.7 : 1), dir, primaryLogo: primary?.brand.logo || null, images: ctx.aiImages ? [] : (primary?.brand.images || []), imageCursor: 0, z: 1, slideCount: 0, imageSlots: 0, radius: adjusted.radius, tone };
}

interface Section { heading?: BlockModel; blocks: BlockModel[]; imageConcept?: string }

function sectionsFrom(ctx: GenContext): Section[] {
  const sections: Section[] = [];
  if (ctx.plan?.groups?.length) {
    const map = new Map(ctx.blocks.map((b) => [b.id, b]));
    for (const g of ctx.plan.groups) {
      const bs = g.blockIds.map((id) => map.get(id)).filter(Boolean) as BlockModel[];
      if (!bs.length) continue;
      const heading = bs[0].kind === "heading" ? bs[0] : undefined;
      sections.push({ heading, blocks: heading ? bs.slice(1) : bs, imageConcept: g.imageConcept });
    }
    return sections;
  }
  let cur: Section | null = null;
  for (const b of ctx.blocks) {
    if (b.kind === "heading") { if (cur) sections.push(cur); cur = { heading: b, blocks: [] }; continue; }
    if (!cur) cur = { blocks: [] };
    cur.blocks.push(b);
  }
  if (cur) sections.push(cur);
  return sections;
}

function contentSlidesForSection(env: Env, sec: Section, sectionNo: number, startIndex: number): SlideModel[] {
  const { spec, pal } = env;
  const tp = typeProfile(env.ctx.type);
  const out: SlideModel[] = [];
  const pieces: Piece[] = sec.blocks.map((b) => ({ block: b, text: b.text, fragmentIndex: 0, fragmentCount: 1 }));
  const totalChars = sec.blocks.reduce((n, b) => n + b.text.length, 0);
  const capacity = spec.density === "airy" ? 520 : spec.density === "balanced" ? 820 : 1150;
  const useDivider = !!sec.heading && (sec.blocks.length === 0 || (tp.sectionDividers && totalChars > capacity * 0.8));
  if (sec.heading && useDivider) out.push(sectionSlide(env, sec.heading, sectionNo, sec.blocks[0]));
  if (!sec.blocks.length) return out;

  let headingOnFirst = !!sec.heading && !useDivider;
  let rest = pieces;
  let first = true;
  let guard = 0;
  const imgEvery = tp.imageFrequency === "high" ? 1 : tp.imageFrequency === "medium" ? 2 : tp.imageFrequency === "low" ? 4 : 0;
  while (rest.length && guard++ < 60) {
    const slide: SlideModel = { index: 0, layoutKey: spec.composition.contentLayout, purpose: "content", background: background(env, "normal"), styleId: env.ctx.styleId, elements: [] };
    const listOnly = rest.every((p) => p.block.kind === "list_item") || (rest[0].block.kind === "list_item" && rest.filter((p) => p.block.kind === "list_item").length >= 2);
    const nextPieces = listOnly ? rest.filter((p, i) => i < rest.findIndex((q) => q.block.kind !== "list_item") || rest.findIndex((q) => q.block.kind !== "list_item") < 0) : rest;
    const imgAllowed = imgEvery > 0 && spec.composition.imagePlacement !== "none" && (env.ctx.aiImages || env.images.length > 0);
    const withImage = imgAllowed && first && (env.slideCount % imgEvery === 0) && (rest.reduce((n, p) => n + p.text.length, 0) < capacity * 1.3 || spec.composition.imagePlacement === "full-bleed");
    const hasLabel = !!sec.heading && !headingOnFirst;
    const headingLines = sec.heading ? Math.ceil((sec.heading.text.length * spec.scale.h2 * 0.55) / (W - 2 * env.margin)) : 1;
    const R = regions(env, { hasHeading: headingOnFirst, hasLabel, withImage, headingLines });
    if (R.label && sec.heading) slide.elements.push(text(env, R.label, sec.heading.text, { origin: "decoration", role: "label", fontSize: spec.scale.caption, color: pal.accent, letterSpacing: 2, textTransform: "uppercase", lang: sec.heading.lang, dir: sec.heading.dir }));
    if (R.heading && sec.heading) {
      const hs = sec.heading.text.length > 70 ? Math.round(spec.scale.h2 * 0.75) : spec.scale.h2;
      slide.elements.push(text(env, R.heading, sec.heading.text, { blockId: sec.heading.id, fragmentIndex: 0, fragmentCount: 1, role: "h2", fontSize: hs, lang: sec.heading.lang, dir: sec.heading.dir, align: alignFor(sec.heading.dir) }));
      if (spec.decorative.rules && spec.composition.headingPlacement === "top") slide.elements.push(shape(env, { x: R.heading.x, y: R.heading.y + R.heading.h - 8, w: 72, h: 3 }, { shape: "rect", fill: pal.accent }));
      if (spec.decorative.sectionNumbers && spec.composition.headingPlacement === "side") slide.elements.push(text(env, { x: R.heading.x, y: R.heading.y + R.heading.h - spec.scale.h3 * 1.3, w: 200, h: spec.scale.h3 * 1.3 }, String(sectionNo).padStart(2, "0"), { origin: "decoration", role: "number", fontSize: spec.scale.h3, lineHeight: 1.1, color: pal.accent, dir: "ltr", lang: "neutral", fontFamily: spec.fonts.heading }));
    }
    if (R.image) {
      if (env.ctx.aiImages) {
        const concept = conceptFrom(env, sec.heading?.text, rest[0]?.text, sec.imageConcept);
        if (spec.composition.imagePlacement === "full-bleed") { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "background" }; slide.background.overlay = spec.background.overlay || `linear-gradient(90deg, ${withAlpha(pal.background, 0.95)} 0%, ${withAlpha(pal.background, 0.75)} 60%, ${withAlpha(pal.background, 0.35)} 100%)`; }
        else { slide.imageRequest = { concept, prompt: buildImagePrompt(env, concept), placement: "element", elementKey: "slide-image" }; slide.elements.push(imageEl(env, R.image, { placeholder: true, concept, radius: env.radius })); }
      } else if (env.images.length) {
        const ref = env.images[env.imageCursor++ % env.images.length];
        if (spec.composition.imagePlacement === "full-bleed") { slide.background.imageAssetId = ref.assetId; slide.background.imageSrc = `/api/files/asset/${ref.assetId}`; slide.background.overlay = spec.background.overlay || `linear-gradient(90deg, ${withAlpha(pal.background, 0.95)} 0%, ${withAlpha(pal.background, 0.75)} 60%, ${withAlpha(pal.background, 0.35)} 100%)`; }
        else slide.elements.push(imageEl(env, R.image, { assetId: ref.assetId, radius: env.radius }));
      }
    }
    const area: Rect = { x: R.columns[0].x, y: R.columns[0].y, w: R.columns[R.columns.length - 1].x + R.columns[R.columns.length - 1].w - R.columns[0].x, h: R.columns[0].h };
    let result: { placed: ElementModel[]; rest: Piece[] } | null = null;
    const listPieces = nextPieces;
    if (listOnly && listPieces.length >= 2) {
      if (spec.composition.listStyle === "cards") result = tryCards(env, listPieces, area);
      else if (spec.composition.listStyle === "numbered-rows") result = tryRows(env, listPieces, area);
      if (result) result.rest = [...result.rest, ...rest.slice(listPieces.length)];
    }
    if (!result) result = flow(env, rest, R.columns);
    if (!result.placed.length) { // nothing fit – should not happen; force flow in full area without image
      const R2 = regions(env, { hasHeading: false, hasLabel: hasLabel, withImage: false, headingLines: 1 });
      result = flow(env, rest, R2.columns);
      if (!result.placed.length) break;
    }
    slide.elements.push(...result.placed);
    rest = result.rest;
    if (env.dir === "rtl") slide.elements = slide.elements.map((e) => (e.type === "shape" && e.w >= W ? e : mirror(e)));
    slide.purpose = listOnly ? "list" : "content";
    env.slideCount++;
    chrome(env, slide, startIndex + out.length + 1);
    out.push(slide);
    headingOnFirst = false; first = false;
  }
  return out;
}

export function generateSlides(ctx: GenContext): SlideModel[] {
  const env = makeEnv(ctx);
  const slides: SlideModel[] = [];
  slides.push(coverSlide(env));
  const ps = participantsSlide(env); if (ps) slides.push(ps);
  const sections = sectionsFrom(ctx);
  let sectionNo = 0;
  for (const sec of sections) {
    sectionNo++;
    const made = contentSlidesForSection(env, sec, sectionNo, slides.length);
    slides.push(...made);
  }
  if (typeProfile(ctx.type).closing && (ctx.presentedByEnabled && ctx.presentedBy.length)) { const c = closingSlide(env); if (c) slides.push(c); }
  slides.forEach((s, i) => { s.index = i; s.w = W; s.h = H; });
  // chrome for non-content slides (section, participants, closing) – slide numbers etc.
  for (const s of slides) if (s.purpose === "section" || s.purpose === "participants" || s.purpose === "closing") chrome(env, s, s.index + 1);
  return slides;
}

export interface FragMeta { realId: string; fi: number; fc: number }

/**
 * Re-lay out a single existing slide's content pieces in (possibly) another style. Returns 1+ slides.
 * Content fragments already on the slide are treated as pseudo blocks (id = `${blockId}#${fragmentIndex}`);
 * the caller maps them back to real block ids with `remapFragments`, which renumbers fragments globally if a
 * fragment had to be split again.
 */
export function relayoutSlide(ctx: GenContext, slide: SlideModel, sectionNo: number): { slides: SlideModel[]; fragMeta: Map<string, FragMeta> } {
  const env = makeEnv(ctx);
  const fragMeta = new Map<string, FragMeta>();
  const sized = (x: SlideModel) => ({ ...x, w: W, h: H });
  if (slide.purpose === "cover") return { slides: [sized(coverSlide(env))], fragMeta };
  if (slide.purpose === "closing") { const c = closingSlide(env); return { slides: c ? [sized(c)] : [slide], fragMeta }; }
  if (slide.purpose === "participants") { const p = participantsSlide(env); return { slides: p ? [sized(p)] : [slide], fragMeta }; }
  const map = new Map(ctx.blocks.map((b) => [b.id, b]));
  const textEls = slide.elements.filter((e) => e.type === "text" && e.blockId && map.has(e.blockId)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  if (!textEls.length) return { slides: [slide], fragMeta };
  const headingEl = textEls.find((e) => map.get(e.blockId!)!.kind === "heading");
  if (slide.purpose === "section" && headingEl) return { slides: [sized(sectionSlide(env, map.get(headingEl.blockId!)!, sectionNo))], fragMeta };
  const pseudo: BlockModel[] = [];
  for (const e of textEls) {
    const b = map.get(e.blockId!)!; const p = e.props as TextProps;
    if (b.kind === "heading" && headingEl === e) continue;
    const id = `${b.id}#${e.fragmentIndex ?? 0}`;
    pseudo.push({ ...b, id, text: p.text });
    fragMeta.set(id, { fi: e.fragmentIndex ?? 0, fc: e.fragmentCount ?? 1, realId: b.id });
  }
  const sec: Section = { heading: headingEl ? map.get(headingEl.blockId!) : undefined, blocks: pseudo };
  const ctx2 = { ...ctx, blocks: [...ctx.blocks, ...pseudo] };
  const env2 = makeEnv(ctx2);
  // no section dividers when relayouting a single content slide
  const made = contentSlidesForSection({ ...env2, ctx: { ...ctx2, type: "Performance Report" } }, sec, sectionNo, slide.index).map((s) => ({ ...s, styleId: ctx.styleId }));
  for (const m of made) { m.w = W; m.h = H; }
  const nonEmpty = made.filter((s) => s.elements.some((e) => e.type === "text" && e.blockId));
  return { slides: nonEmpty.length ? nonEmpty : made, fragMeta };
}

export interface FragmentShift { realId: string; afterIndex: number; shift: number }

/**
 * Maps pseudo block ids back to real block ids. If a fragment was split again, later fragments of the same
 * block (on these slides and elsewhere) must shift; the returned list describes those shifts in application order.
 */
export function remapFragments(slides: SlideModel[], fragMeta: Map<string, FragMeta>): { shifts: FragmentShift[]; countDelta: Map<string, number> } {
  const shifts: FragmentShift[] = [];
  const countDelta = new Map<string, number>();
  const pseudoIds = [...fragMeta.keys()].sort((a, b) => fragMeta.get(b)!.fi - fragMeta.get(a)!.fi); // highest fragment first
  const converted: ElementModel[] = [];
  for (const pid of pseudoIds) {
    const m = fragMeta.get(pid)!;
    const els = slides.flatMap((s) => s.elements).filter((e) => e.blockId === pid).sort((a, b) => (a.fragmentIndex ?? 0) - (b.fragmentIndex ?? 0));
    const k = els.length;
    for (let j = 0; j < k; j++) { els[j].blockId = m.realId; els[j].fragmentIndex = m.fi + j; }
    const shift = k - 1;
    if (shift > 0) {
      for (const e of converted) if (e.blockId === m.realId && (e.fragmentIndex ?? 0) > m.fi) e.fragmentIndex = (e.fragmentIndex ?? 0) + shift;
      shifts.push({ realId: m.realId, afterIndex: m.fi, shift });
      countDelta.set(m.realId, (countDelta.get(m.realId) || 0) + shift);
    }
    converted.push(...els);
  }
  for (const e of converted) { const m = [...fragMeta.values()].find((x) => x.realId === e.blockId)!; e.fragmentCount = m.fc + (countDelta.get(e.blockId!) || 0); }
  return { shifts, countDelta };
}
