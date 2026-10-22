import { CANVAS_H, CANVAS_W, type ElementModel, type ImageProps, type ShapeProps, type SlideModel, type TextProps } from "../types";

export type SrcResolver = (src: string | undefined) => string | undefined;

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const ARABIC_FAMILY_FALLBACK = ", 'Cairo', 'Noto Naskh Arabic', 'Segoe UI', sans-serif";

export function fontStack(family: string) {
  const f = family.includes(",") ? family : `'${family}'`;
  return `${f}${ARABIC_FAMILY_FALLBACK}`;
}

export function textStyle(p: TextProps) {
  const align = p.align;
  const valign = p.valign === "middle" ? "center" : p.valign === "bottom" ? "flex-end" : "flex-start";
  return `font-family:${fontStack(p.fontFamily)};font-size:${p.fontSize}px;font-weight:${p.fontWeight};color:${p.color};text-align:${align};direction:${p.dir};line-height:${p.lineHeight};letter-spacing:${p.letterSpacing || 0}px;text-transform:${p.textTransform || "none"};font-style:${p.italic ? "italic" : "normal"};opacity:${p.opacity ?? 1};display:flex;flex-direction:column;justify-content:${valign};`;
}

export function renderElementHtml(el: ElementModel, resolve: SrcResolver): string {
  const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.z};${el.rotation ? `transform:rotate(${el.rotation}deg);` : ""}`;
  if (el.type === "text") {
    const p = el.props as TextProps;
    const inner = p.bullet
      ? `<div class="bul" style="display:flex;gap:0.6em;align-items:flex-start;"><span style="flex:none;color:inherit;">${esc(p.bulletChar || "")}</span><span class="t" style="white-space:pre-wrap;unicode-bidi:plaintext;">${esc(p.text)}</span></div>`
      : `<span class="t" style="white-space:pre-wrap;unicode-bidi:plaintext;display:block;">${esc(p.text)}</span>`;
    return `<div class="el text" data-id="${el.id || ""}" data-block="${el.blockId || ""}" lang="${p.lang === "ar" ? "ar" : p.lang === "en" ? "en" : ""}" dir="${p.dir}" style="${base}${textStyle(p)}">${inner}</div>`;
  }
  if (el.type === "shape") {
    const p = el.props as ShapeProps;
    const radius = p.shape === "ellipse" ? "50%" : `${p.radius || 0}px`;
    const bg = p.gradient ? `background:${p.gradient};` : p.fill ? `background:${p.fill};` : "";
    const border = p.stroke ? `border:${p.strokeWidth || 1}px solid ${p.stroke};` : "";
    return `<div class="el shape" data-id="${el.id || ""}" style="${base}${bg}${border}border-radius:${radius};opacity:${p.opacity ?? 1};box-sizing:border-box;"></div>`;
  }
  const p = el.props as ImageProps;
  const src = resolve(p.src);
  const style = `${base}border-radius:${p.radius || 0}px;overflow:hidden;opacity:${p.opacity ?? 1};`;
  if (!src) {
    return `<div class="el image placeholder" data-id="${el.id || ""}" style="${style}background:repeating-linear-gradient(45deg,rgba(128,128,128,0.12) 0 12px,rgba(128,128,128,0.22) 12px 24px);display:flex;align-items:center;justify-content:center;"><span style="font:500 22px Inter,sans-serif;color:rgba(128,128,128,0.9);padding:24px;text-align:center;">${esc(p.concept ? "AI image pending" : "Image")}</span></div>`;
  }
  return `<div class="el image" data-id="${el.id || ""}" style="${style}"><img src="${esc(src)}" alt="${esc(p.alt || "")}" style="width:100%;height:100%;object-fit:${p.fit};${p.cssFilter ? `filter:${p.cssFilter};` : ""}display:block;"/></div>`;
}

export function backgroundStyle(bg: SlideModel["background"], resolve: SrcResolver) {
  const layers: string[] = [];
  if (bg.overlay) layers.push(bg.overlay);
  const img = resolve(bg.imageSrc);
  if (img) layers.push(`url("${img}") center/cover no-repeat`);
  if (bg.gradient) layers.push(bg.gradient);
  const color = bg.color || "#ffffff";
  return `background-color:${color};${layers.length ? `background:${layers.join(",")}${layers.length && !bg.gradient && !img ? `, ${color}` : ""};` : ""}`;
}

export function renderSlideHtml(slide: SlideModel, resolve: SrcResolver, extraClass = "") {
  const els = [...slide.elements].sort((a, b) => a.z - b.z).map((e) => renderElementHtml(e, resolve)).join("");
  return `<div class="slide ${extraClass}" data-index="${slide.index}" style="position:relative;width:${slide.w || CANVAS_W}px;height:${slide.h || CANVAS_H}px;overflow:hidden;${backgroundStyle(slide.background, resolve)}">${els}</div>`;
}

export function renderDeckDocument(slides: SlideModel[], resolve: SrcResolver, fontCss: string, title: string) {
  const w = slides[0]?.w || CANVAS_W, h = slides[0]?.h || CANVAS_H;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${fontCss}
@page { size: ${w}px ${h}px; margin: 0; }
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.slide{page-break-after:always;break-after:page;}
.slide:last-child{page-break-after:auto;break-after:auto;}
.el{box-sizing:border-box;}
</style></head><body>${slides.map((s) => renderSlideHtml(s, resolve)).join("\n")}</body></html>`;
}
