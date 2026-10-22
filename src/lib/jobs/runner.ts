import { prisma } from "../db";
import { runFullGeneration, runRegenerateSlides, runThreeStyles, loadSlides, runIntegrityCheck } from "../generation/service";
import { generateImage, ImageProviderNotConfigured } from "../images/nanobanana";
import { saveFile, toDataUri, readFile, imageDimensions } from "../storage";
import { renderDeck } from "../export/pdf";
import { buildPptx } from "../export/pptx";
import type { SlideModel } from "../types";
import type { Prisma } from "@prisma/client";
import type { IntegrityIssue } from "../content/verify";
import { userFontCss } from "../fonts";

type Kind = "generation" | "export" | "image";
const g = globalThis as unknown as { __jobs?: { queue: { kind: Kind; id: string }[]; running: Set<string>; active: number } };
const state = g.__jobs ?? (g.__jobs = { queue: [], running: new Set(), active: 0 });
const CONCURRENCY = 2;

export function enqueue(kind: Kind, id: string) {
  if (state.running.has(id) || state.queue.some((q) => q.id === id)) return;
  state.queue.push({ kind, id });
  void pump();
}

async function pump() {
  while (state.active < CONCURRENCY && state.queue.length) {
    const job = state.queue.shift()!;
    state.active++; state.running.add(job.id);
    (async () => {
      try {
        if (job.kind === "generation") await runGeneration(job.id);
        else if (job.kind === "export") await runExport(job.id);
        else await runImage(job.id);
      } catch (e) { console.error(`[jobs] ${job.kind} ${job.id} crashed`, e); }
      finally { state.active--; state.running.delete(job.id); void pump(); }
    })();
  }
}

/** Re-queue jobs left in queued/running state (e.g. after a restart). */
export async function resumePendingJobs() {
  const gens = await prisma.generationJob.findMany({ where: { status: { in: ["queued", "running"] } } });
  for (const j of gens) { if (j.status === "running") await prisma.generationJob.update({ where: { id: j.id }, data: { status: "queued" } }); enqueue("generation", j.id); }
  const exps = await prisma.exportJob.findMany({ where: { status: { in: ["queued", "checking", "running"] } } });
  for (const j of exps) { await prisma.exportJob.update({ where: { id: j.id }, data: { status: "queued" } }); enqueue("export", j.id); }
  const imgs = await prisma.generatedImage.findMany({ where: { status: { in: ["pending", "generating"] } } });
  for (const i of imgs) enqueue("image", i.id);
}

async function history(presentationId: string, action: string, details?: unknown) {
  await prisma.projectHistory.create({ data: { presentationId, action, details: (details ?? null) as Prisma.InputJsonValue } });
}

/* ------------------------------ generation ------------------------------ */
async function runGeneration(id: string) {
  const job = await prisma.generationJob.findUnique({ where: { id } });
  if (!job || job.status === "completed") return;
  const logs: string[] = [];
  const log = async (m: string) => { logs.push(m); await prisma.generationJob.update({ where: { id }, data: { result: { logs } } }); };
  await prisma.generationJob.update({ where: { id }, data: { status: "running", startedAt: new Date(), error: null } });
  await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "processing" } });
  const params = (job.params || {}) as { styleId?: string | null; styleIds?: string[]; slideIds?: string[] };
  try {
    let result: unknown = null;
    if (job.kind === "full") result = await runFullGeneration(job.presentationId, params.styleId ?? null, log);
    else if (job.kind === "three_styles") result = await runThreeStyles(job.presentationId, params.styleIds || [], log);
    else if (job.kind === "slides") result = await runRegenerateSlides(job.presentationId, params.slideIds || [], params.styleId ?? null, log);
    else throw new Error(`Unknown generation kind ${job.kind}`);
    const imageIds = (result as { imageIds?: string[] } | null)?.imageIds || [];
    for (const i of imageIds) enqueue("image", i);
    await prisma.generationJob.update({ where: { id }, data: { status: "completed", finishedAt: new Date(), progress: 100, result: { logs, ...(result as object || {}) } as Prisma.InputJsonValue } });
    await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "awaiting_review" } });
    await history(job.presentationId, `generation.${job.kind}.completed`, { logs });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    await prisma.generationJob.update({ where: { id }, data: { status: "failed", finishedAt: new Date(), error: msg, result: { logs } } });
    // Keep previous slides/content intact; mark presentation failed only for this job.
    await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "failed" } });
    await history(job.presentationId, `generation.${job.kind}.failed`, { error: msg });
  }
}

/* ------------------------------ images ------------------------------ */
async function runImage(id: string) {
  const img = await prisma.generatedImage.findUnique({ where: { id }, include: { presentation: { include: { style: true } } } });
  if (!img || img.status === "ready" || img.status === "approved") return;
  await prisma.generatedImage.update({ where: { id }, data: { status: "generating", attempts: { increment: 1 }, error: null } });
  try {
    const spec = (img.presentation.style?.spec || {}) as { imageTreatment?: { aspect?: "16:9" | "4:3" | "1:1" | "3:4" } };
    const slide = img.slideId ? await prisma.slide.findUnique({ where: { id: img.slideId } }) : null;
    const bg = (slide?.background || {}) as { imageRequest?: { placement?: string } };
    const aspect = bg.imageRequest?.placement === "background" ? "16:9" : spec.imageTreatment?.aspect || "16:9";
    const out = await generateImage(img.prompt, aspect);
    const ext = out.mime.includes("jpeg") ? ".jpg" : out.mime.includes("webp") ? ".webp" : ".png";
    const rel = await saveFile("generated", out.data, `image${ext}`);
    const dims = imageDimensions(out.data, out.mime);
    await prisma.generatedImage.update({ where: { id }, data: { status: "ready", storagePath: rel, mimeType: out.mime, width: dims?.width, height: dims?.height, model: out.model } });
    await applyImageToSlide(id);
    await history(img.presentationId, "image.generated", { imageId: id });
  } catch (e) {
    const msg = e instanceof ImageProviderNotConfigured ? e.message : `Image generation failed: ${(e as Error).message || e}`;
    await prisma.generatedImage.update({ where: { id }, data: { status: "failed", error: msg } });
    await history(img.presentationId, "image.failed", { imageId: id, error: msg });
  }
}

/** Points the slide element / background at the generated (or replaced) image file. */
export async function applyImageToSlide(imageId: string) {
  const img = await prisma.generatedImage.findUnique({ where: { id: imageId } });
  if (!img?.storagePath) return;
  const src = `/api/files/generated/${imageId}`;
  const els = await prisma.slideElement.findMany({ where: { generatedImageId: imageId } });
  for (const el of els) await prisma.slideElement.update({ where: { id: el.id }, data: { props: { ...(el.props as object), src, placeholder: false } as Prisma.InputJsonValue } });
  if (img.slideId) {
    const slide = await prisma.slide.findUnique({ where: { id: img.slideId } });
    const bg = (slide?.background || {}) as Record<string, unknown>;
    if (slide && bg.generatedImageId === imageId) await prisma.slide.update({ where: { id: slide.id }, data: { background: { ...bg, imageSrc: src } as Prisma.InputJsonValue } });
  }
}

/* ------------------------------ export ------------------------------ */
export async function makeDataResolver() {
  const cache = new Map<string, { data: string; mime: string } | null>();
  return async (src: string | undefined) => {
    if (!src) return null;
    if (cache.has(src)) return cache.get(src)!;
    let out: { data: string; mime: string } | null = null;
    try {
      let m = src.match(/^\/api\/files\/asset\/([a-z0-9]+)/i);
      if (m) { const a = await prisma.brandAsset.findUnique({ where: { id: m[1] } }); if (a) out = { data: await toDataUri(a.storagePath, a.mimeType), mime: a.mimeType }; }
      m = src.match(/^\/api\/files\/generated\/([a-z0-9]+)/i);
      if (m) { const gi = await prisma.generatedImage.findUnique({ where: { id: m[1] } }); if (gi?.storagePath) out = { data: await toDataUri(gi.storagePath, gi.mimeType || "image/png"), mime: gi.mimeType || "image/png" }; }
      if (src.startsWith("data:")) out = { data: src, mime: src.slice(5, src.indexOf(";")) };
    } catch { out = null; }
    cache.set(src, out);
    return out;
  };
}

async function runExport(id: string) {
  const job = await prisma.exportJob.findUnique({ where: { id }, include: { presentation: true } });
  if (!job || job.status === "completed") return;
  const formats = (job.formats as string[]).filter((f) => f === "pptx" || f === "pdf");
  const warnings: string[] = [];
  try {
    await prisma.exportJob.update({ where: { id }, data: { status: "checking", startedAt: new Date(), error: null } });
    await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "exporting" } });
    const slides = await loadSlides(job.presentationId);
    if (!slides.length) throw new Error("This presentation has no slides to export. Generate it first.");
    const resolver = await makeDataResolver();
    const resolve = (src: string | undefined) => src; // replaced below with data URIs
    const dataMap = new Map<string, string>();
    for (const s of slides) {
      const srcs = [s.background.imageSrc, ...s.elements.map((e) => (e.props as { src?: string }).src)].filter(Boolean) as string[];
      for (const src of srcs) if (!dataMap.has(src)) { const r = await resolver(src); if (r) dataMap.set(src, r.data); }
    }
    void resolve;
    const htmlResolve = (src: string | undefined) => (src ? dataMap.get(src) : undefined);
    // Pending AI images: warn (exported as placeholders are NOT included; the slot stays empty)
    const pending = await prisma.generatedImage.count({ where: { presentationId: job.presentationId, status: { in: ["pending", "generating", "failed"] } } });
    if (pending) warnings.push(`${pending} AI image(s) are not ready and were exported as empty areas.`);

    // 1. render validation (overflow, missing images) + 2. integrity
    const extraFontCss = await userFontCss(job.presentation.userId, true);
    const { validation } = await renderDeck(slides, htmlResolve, job.presentation.name, { pdf: false, extraFontCss });
    const extra: IntegrityIssue[] = validation.overflows.map((o) => ({ severity: "warning", code: "overflow", slideIndex: o.slideIndex, elementId: o.elementId, message: `Text overflows its box by ${o.overflowPx}px on slide ${o.slideIndex + 1}: "${o.text}…"` }));
    for (const m of validation.missingImages) warnings.push(`Slide ${m.slideIndex + 1}: image failed to load (${m.src}).`);
    const report = await runIntegrityCheck(job.presentationId, extra);
    for (const o of validation.overflows) warnings.push(`Slide ${o.slideIndex + 1}: text overflow (${o.overflowPx}px) — consider regenerating the slide.`);
    await prisma.exportJob.update({ where: { id }, data: { status: "running", integrity: report as unknown as Prisma.InputJsonValue, verified: report.ok, warnings } });

    // 3. generate files
    for (const fmt of formats) {
      const base = job.presentation.name.replace(/[^\p{L}\p{N}_\- ]+/gu, "").trim().replace(/\s+/g, "-") || "presentation";
      if (fmt === "pdf") {
        const { pdf } = await renderDeck(slides as SlideModel[], htmlResolve, job.presentation.name, { pdf: true, extraFontCss });
        const rel = await saveFile("exports", pdf!, `${base}.pdf`);
        await prisma.exportedFile.create({ data: { exportJobId: id, format: "pdf", fileName: `${base}.pdf`, storagePath: rel, size: pdf!.length } });
      } else {
        const { buffer, warnings: w } = await buildPptx(slides, resolver, job.presentation.name);
        warnings.push(...w.filter((x, i, arr) => arr.indexOf(x) === i));
        const rel = await saveFile("exports", buffer, `${base}.pptx`);
        await prisma.exportedFile.create({ data: { exportJobId: id, format: "pptx", fileName: `${base}.pptx`, storagePath: rel, size: buffer.length } });
      }
    }
    await prisma.exportJob.update({ where: { id }, data: { status: "completed", finishedAt: new Date(), warnings } });
    await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "ready" } });
    await history(job.presentationId, "export.completed", { formats, verified: report.ok, warnings });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    await prisma.exportJob.update({ where: { id }, data: { status: "failed", finishedAt: new Date(), error: msg, warnings } });
    await prisma.presentation.update({ where: { id: job.presentationId }, data: { status: "awaiting_review" } });
    await history(job.presentationId, "export.failed", { error: msg });
  }
}

export { readFile };
