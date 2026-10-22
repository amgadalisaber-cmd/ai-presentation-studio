import { getBrowser } from "./browser";
import { renderDeckDocument, type SrcResolver } from "../render/html";
import { embeddedFontCss } from "../render/fonts";
import { CANVAS_H, CANVAS_W, type SlideModel } from "../types";

export interface RenderValidation { overflows: { slideIndex: number; elementId: string; text: string; overflowPx: number }[]; missingImages: { slideIndex: number; src: string }[] }

/** Validates rendering (text overflow, broken images) and optionally produces a PDF with selectable text and embedded fonts. */
export async function renderDeck(slides: SlideModel[], resolve: SrcResolver, title: string, opts: { pdf: boolean; extraFontCss?: string }): Promise<{ pdf?: Buffer; validation: RenderValidation }> {
  const fontCss = (await embeddedFontCss()) + "\n" + (opts.extraFontCss || "");
  const html = renderDeckDocument(slides, resolve, fontCss, title);
  const browser = await getBrowser();
  const W = slides[0]?.w || CANVAS_W, H = slides[0]?.h || CANVAS_H;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
    const validation = await page.evaluate(() => {
      const overflows: RenderValidation["overflows"] = [];
      const missingImages: RenderValidation["missingImages"] = [];
      document.querySelectorAll<HTMLElement>(".slide").forEach((slide) => {
        const si = Number(slide.dataset.index);
        slide.querySelectorAll<HTMLElement>(".el.text").forEach((el) => {
          const inner = el.querySelector<HTMLElement>(".t, .bul");
          if (!inner) return;
          const over = inner.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
          if (over > 4) overflows.push({ slideIndex: si, elementId: el.dataset.id || "", text: (inner.textContent || "").slice(0, 60), overflowPx: Math.round(over) });
        });
        slide.querySelectorAll<HTMLImageElement>("img").forEach((img) => { if (!img.complete || img.naturalWidth === 0) missingImages.push({ slideIndex: si, src: img.getAttribute("src")?.slice(0, 80) || "" }); });
      });
      return { overflows, missingImages };
    });
    if (!opts.pdf) return { validation };
    const pdf = await page.pdf({ width: `${W}px`, height: `${H}px`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return { pdf: Buffer.from(pdf), validation };
  } finally { await page.close(); }
}

/** Rasterizes a CSS background (gradient/overlay) to PNG for formats that cannot express it natively. */
export async function rasterizeBackground(css: string, format: "png" | "jpeg" = "jpeg", size = { w: CANVAS_W, h: CANVAS_H }): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  try {
    await page.setContent(`<html><body style="margin:0"><div style="width:${size.w}px;height:${size.h}px;${css}"></div></body></html>`);
    return Buffer.from(await page.screenshot({ type: format, ...(format === "jpeg" ? { quality: 90 } : {}), clip: { x: 0, y: 0, width: size.w, height: size.h } }));
  } finally { await page.close(); }
}
