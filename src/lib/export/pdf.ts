import { getBrowser } from "./browser";
import { renderDeckDocument, type SrcResolver } from "../render/html";
import { embeddedFontCss } from "../render/fonts";
import { CANVAS_H, CANVAS_W, type SlideModel } from "../types";

export interface RenderValidation { overflows: { slideIndex: number; elementId: string; text: string; overflowPx: number }[]; missingImages: { slideIndex: number; src: string }[] }

/** Validates rendering (text overflow, broken images) and optionally produces a PDF with selectable text and embedded fonts. */
export async function renderDeck(slides: SlideModel[], resolve: SrcResolver, title: string, opts: { pdf: boolean }): Promise<{ pdf?: Buffer; validation: RenderValidation }> {
  const fontCss = await embeddedFontCss();
  const html = renderDeckDocument(slides, resolve, fontCss, title);
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: CANVAS_W, height: CANVAS_H }, deviceScaleFactor: 1 });
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
    const pdf = await page.pdf({ width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return { pdf: Buffer.from(pdf), validation };
  } finally { await page.close(); }
}

/** Rasterizes a CSS background (gradient/overlay) to PNG for formats that cannot express it natively. */
export async function rasterizeBackground(css: string, format: "png" | "jpeg" = "jpeg"): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: CANVAS_W, height: CANVAS_H } });
  try {
    await page.setContent(`<html><body style="margin:0"><div style="width:${CANVAS_W}px;height:${CANVAS_H}px;${css}"></div></body></html>`);
    return Buffer.from(await page.screenshot({ type: format, ...(format === "jpeg" ? { quality: 90 } : {}), clip: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H } }));
  } finally { await page.close(); }
}
