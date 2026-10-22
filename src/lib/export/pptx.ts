import PptxGenJS from "pptxgenjs";
import { CANVAS_H, CANVAS_W, type ElementModel, type ImageProps, type ShapeProps, type SlideModel, type TextProps } from "../types";
import { rasterizeBackground } from "./pdf";

const PX_PER_IN = CANVAS_W / 13.333; // 144 px per inch on the 1920px canvas
const inch = (px: number) => Math.round((px / PX_PER_IN) * 1000) / 1000;
const pt = (px: number) => Math.round((px / 2) * 10) / 10; // 1px (at 144dpi canvas) = 0.5pt

export type DataResolver = (src: string | undefined) => Promise<{ data: string; mime: string } | null>;

export function toPptxColor(c: string | undefined): { color?: string; transparency?: number } {
  if (!c) return {};
  const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    const a = m[4] !== undefined ? Number(m[4]) : 1;
    return { color: hex, transparency: Math.round((1 - a) * 100) };
  }
  const h = c.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  return /^[0-9a-f]{6}$/i.test(full) ? { color: full.toUpperCase() } : {};
}

export interface PptxWarnings { warnings: string[] }

export async function buildPptx(slides: SlideModel[], resolve: DataResolver, title: string): Promise<{ buffer: Buffer; warnings: string[] }> {
  const pptx = new PptxGenJS();
  const W = slides[0]?.w || CANVAS_W, H = slides[0]?.h || CANVAS_H;
  pptx.defineLayout({ name: "STUDIO", width: Math.round((W / PX_PER_IN) * 1000) / 1000, height: Math.round((H / PX_PER_IN) * 1000) / 1000 });
  pptx.layout = "STUDIO";
  pptx.title = title;
  const warnings: string[] = [];
  const bgCache = new Map<string, string>();
  const fontsUsed = new Set<string>();

  for (const s of slides) {
    const slide = pptx.addSlide();
    // Background: solid color natively; gradients/images/overlays are rasterized into a background image (elements stay editable).
    const bg = s.background;
    const bgImg = await resolve(bg.imageSrc);
    const bgCss: string[] = [];
    if (bg.overlay) bgCss.push(bg.overlay);
    if (bgImg) bgCss.push(`url("${bgImg.data}") center/cover no-repeat`);
    if (bg.gradient) bgCss.push(bg.gradient);
    if (bgCss.length) {
      const css = `background-color:${bg.color || "#fff"};background:${bgCss.join(",")};`;
      const key = css.length > 5000 ? `${bg.imageSrc}|${bg.overlay}|${bg.gradient}` : css;
      let data = bgCache.get(key);
      if (!data) { try { data = `image/jpeg;base64,${(await rasterizeBackground(css, "jpeg", { w: W, h: H })).toString("base64")}`; bgCache.set(key, data); } catch (e) { warnings.push(`Slide ${s.index + 1}: gradient/overlay background exported as a solid color (${(e as Error).message.split(".")[0]}).`); } }
      if (data) slide.background = { data }; else slide.background = { color: toPptxColor(bg.color || "#ffffff").color || "FFFFFF" };
    } else {
      slide.background = { color: toPptxColor(bg.color || "#ffffff").color || "FFFFFF" };
    }

    const ordered = [...s.elements].sort((a, b) => a.z - b.z);
    for (const el of ordered) {
      const box = { x: inch(el.x), y: inch(el.y), w: inch(el.w), h: inch(el.h) };
      if (el.type === "shape") {
        const p = el.props as ShapeProps;
        const fill = toPptxColor(p.fill);
        const line = toPptxColor(p.stroke);
        const type = p.shape === "ellipse" ? pptx.ShapeType.ellipse : p.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
        if (p.gradient) warnings.push(`Slide ${s.index + 1}: a gradient shape was exported as a solid fill.`);
        slide.addShape(type, {
          ...box, rotate: el.rotation || 0,
          fill: fill.color ? { color: fill.color, transparency: Math.round((fill.transparency || 0) + (1 - (p.opacity ?? 1)) * 100) } : { type: "none" },
          line: line.color ? { color: line.color, width: pt(p.strokeWidth || 1), transparency: line.transparency } : { type: "none" },
          rectRadius: p.radius ? Math.min(inch(p.radius), Math.min(box.w, box.h) / 2) : undefined,
        });
        continue;
      }
      if (el.type === "image" || el.type === "logo") {
        const p = el.props as ImageProps;
        const img = await resolve(p.src);
        if (!img) { if (!p.placeholder) warnings.push(`Slide ${s.index + 1}: an image could not be loaded and was skipped.`); continue; }
        if (p.cssFilter) warnings.push(`Slide ${s.index + 1}: CSS image filter (${p.cssFilter}) is not applied in PowerPoint.`);
        const sizing = p.fit === "cover" ? { type: "cover" as const, w: box.w, h: box.h } : { type: "contain" as const, w: box.w, h: box.h };
        slide.addImage({ data: img.data, ...box, sizing, rotate: el.rotation || 0, rounding: !!p.radius && p.radius >= Math.min(el.w, el.h) / 2 });
        continue;
      }
      const p = el.props as TextProps;
      fontsUsed.add(p.fontFamily);
      const color = toPptxColor(p.color);
      const rtl = p.dir === "rtl";
      const isUpper = p.textTransform === "uppercase" && el.origin !== "content";
      const txt = isUpper ? p.text.toUpperCase() : p.text; // content text is never case-transformed in PPTX (wording preserved exactly)
      if (p.textTransform === "uppercase" && el.origin === "content") warnings.push(`Slide ${s.index + 1}: uppercase styling of a content heading is not applied in PowerPoint (text kept exactly as supplied).`);
      const opts: PptxGenJS.TextPropsOptions = {
        ...box, fontFace: p.fontFamily, fontSize: pt(p.fontSize), bold: p.fontWeight >= 600, italic: !!p.italic,
        color: color.color, transparency: p.opacity != null ? Math.round((1 - p.opacity) * 100) : color.transparency,
        align: p.align, valign: p.valign === "middle" ? "middle" : p.valign === "bottom" ? "bottom" : "top",
        rtlMode: rtl, lang: p.lang === "ar" ? "ar-SA" : "en-US", margin: 0, lineSpacingMultiple: p.lineHeight, charSpacing: p.letterSpacing ? pt(p.letterSpacing) : undefined,
        wrap: true, fit: "none", autoFit: false, rotate: el.rotation || 0, breakLine: false,
      };
      if (p.bullet) opts.bullet = p.bulletChar ? { code: p.bulletChar.codePointAt(0)!.toString(16).padStart(4, "0").toUpperCase(), indent: pt(p.fontSize * 1.1) } : { indent: pt(p.fontSize * 1.1) };
      slide.addText(txt, opts);
    }
  }
  const fonts = [...fontsUsed];
  if (fonts.length) warnings.push(`Fonts referenced (install on the viewing machine for exact rendering): ${fonts.join(", ")}. PowerPoint files do not embed these fonts.`);
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer: out, warnings };
}
