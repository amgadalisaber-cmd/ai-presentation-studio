import { prisma } from "../db";
import { normalizeSpec, type StyleSpec } from "../styles/spec";
import { generateSlides, relayoutSlide, remapFragments, buildImagePrompt, makeEnv } from "./engine";
import { aiPlan } from "./aiPlanner";
import type { BrandProfile, CompanyEntry, GenContext, LogoRef, ParticipantCtx, PresentationMeta } from "./types";
import type { BlockModel, SlideModel, ElementModel, ImageProps } from "../types";
import { verifyIntegrity, type IntegrityIssue, type IntegrityReport } from "../content/verify";
import type { Prisma } from "@prisma/client";

type AssetRow = { id: string; kind: string; mimeType: string; width: number | null; height: number | null; approved: boolean };
const ref = (a: AssetRow | null | undefined): LogoRef | null => (a ? { assetId: a.id, width: a.width || 0, height: a.height || 0, mime: a.mimeType } : null);

export async function brandProfile(companyId: string): Promise<BrandProfile> {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { assets: true, guidelines: { where: { approved: true } } } });
  const approved = c.assets.filter((a) => a.approved);
  const logoAsset = approved.find((a) => a.kind === "primary_logo") || approved.find((a) => a.kind === "secondary_logo" || a.kind === "logo_variation");
  const images = approved.filter((a) => (a.kind === "product_image" || a.kind === "photo") && a.mimeType.startsWith("image/"));
  return {
    id: c.id, name: c.name,
    colors: Array.isArray(c.colors) ? (c.colors as BrandProfile["colors"]) : [],
    typography: (c.typography && typeof c.typography === "object" ? c.typography : {}) as BrandProfile["typography"],
    logo: ref(logoAsset), images: images.map((a) => ref(a)!),
    guidelines: c.guidelines.map((g) => ({ category: g.category, rule: g.rule })),
  };
}

export async function loadBlocks(presentationId: string): Promise<BlockModel[]> {
  const rows = await prisma.contentBlock.findMany({ where: { presentationId }, orderBy: { index: "asc" } });
  return rows.map((r) => ({ id: r.id, index: r.index, kind: r.kind as BlockModel["kind"], level: r.level, text: r.text, rawText: r.rawText, marker: r.marker, lang: r.lang as BlockModel["lang"], dir: r.dir as BlockModel["dir"], sectionIndex: r.sectionIndex }));
}

export async function buildContext(presentationId: string, styleId: string | null, opts: { useAiPlanner?: boolean } = {}): Promise<{ ctx: GenContext; styleName: string; plannerNote?: string }> {
  const p = await prisma.presentation.findUniqueOrThrow({ where: { id: presentationId }, include: { participants: { include: { company: true }, orderBy: { order: "asc" } }, companies: { include: { company: { include: { assets: true } } }, orderBy: { order: "asc" } }, style: true } });
  const style = styleId ? await prisma.visualStyle.findUnique({ where: { id: styleId } }) : p.style;
  const spec: StyleSpec = normalizeSpec(style?.spec);
  const blocks = await loadBlocks(presentationId);
  const participants: ParticipantCtx[] = [];
  for (const pt of p.participants) participants.push({ brand: await brandProfile(pt.companyId), role: pt.role, roleLabel: pt.roleLabel, instructions: pt.instructions });
  const entries = async (section: string): Promise<CompanyEntry[]> => {
    const out: CompanyEntry[] = [];
    for (const c of p.companies.filter((x) => x.section === section)) {
      let logo: LogoRef | null = null;
      if (c.logoAssetId) { const a = await prisma.brandAsset.findUnique({ where: { id: c.logoAssetId } }); logo = ref(a); }
      else if (c.company) { const l = c.company.assets.find((a) => a.kind === "primary_logo" && a.approved) || c.company.assets.find((a) => a.kind.includes("logo") && a.approved); logo = ref(l); }
      out.push({ name: c.customName || c.company?.name || "", title: c.title, contactName: c.contactName, department: c.department, logo, showLogo: c.showLogo });
    }
    return out.filter((e) => e.name);
  };
  const ctx: GenContext = {
    presentationId, name: p.name, type: p.type, typeLabel: p.type === "Custom" && p.customType ? p.customType : p.type,
    language: p.language, blocks, spec, styleId: style?.id || null, participants,
    presentedBy: await entries("presented_by"), presentedTo: await entries("presented_to"),
    presentedByEnabled: p.presentedByEnabled, presentedToEnabled: p.presentedToEnabled,
    metadata: (p.metadata || {}) as PresentationMeta, aiImages: p.aiImages, customDirection: p.customDirection, plan: null,
  };
  let plannerNote: string | undefined;
  if (opts.useAiPlanner) { const r = await aiPlan(blocks, ctx.typeLabel, style?.name || "Default"); ctx.plan = r.plan; plannerNote = r.note; }
  return { ctx, styleName: style?.name || "Default", plannerNote };
}

/* ------------------------------ persistence ------------------------------ */

export async function loadSlides(presentationId: string): Promise<SlideModel[]> {
  const rows = await prisma.slide.findMany({ where: { presentationId }, orderBy: { index: "asc" }, include: { elements: { orderBy: { z: "asc" } } } });
  return rows.map((s) => ({
    id: s.id, index: s.index, layoutKey: s.layoutKey, purpose: s.purpose as SlideModel["purpose"], background: (s.background || {}) as SlideModel["background"], styleId: s.styleId, notes: s.notes || undefined,
    elements: s.elements.map((e) => ({ id: e.id, type: e.type as ElementModel["type"], origin: e.origin as ElementModel["origin"], x: e.x, y: e.y, w: e.w, h: e.h, z: e.z, rotation: e.rotation, props: e.props as unknown as ElementModel["props"], blockId: e.blockId, fragmentIndex: e.fragmentIndex, fragmentCount: e.fragmentCount, assetId: e.assetId, generatedImageId: e.generatedImageId })),
  }));
}

async function insertSlide(tx: Prisma.TransactionClient, presentationId: string, s: SlideModel, index: number) {
  const slide = await tx.slide.create({ data: { presentationId, index, layoutKey: s.layoutKey, purpose: s.purpose, background: s.background as Prisma.InputJsonValue, styleId: s.styleId || null, notes: s.notes || null } });
  for (const e of s.elements) {
    await tx.slideElement.create({ data: { slideId: slide.id, type: e.type, origin: e.origin, x: e.x, y: e.y, w: e.w, h: e.h, z: e.z, rotation: e.rotation || 0, props: e.props as unknown as Prisma.InputJsonValue, blockId: e.blockId || null, fragmentIndex: e.fragmentIndex ?? null, fragmentCount: e.fragmentCount ?? null, assetId: e.assetId || null, generatedImageId: e.generatedImageId || null } });
  }
  return slide.id;
}

/** Replace all slides of a presentation. */
export async function replaceAllSlides(presentationId: string, slides: SlideModel[]) {
  return prisma.$transaction(async (tx) => {
    await tx.slide.deleteMany({ where: { presentationId } });
    const ids: string[] = [];
    for (let i = 0; i < slides.length; i++) ids.push(await insertSlide(tx, presentationId, slides[i], i));
    return ids;
  }, { timeout: 120000 });
}

/** Replace a single slide with one or more slides, shifting following slide indexes. */
export async function replaceOneSlide(presentationId: string, slideId: string, replacements: SlideModel[]) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.slide.findUniqueOrThrow({ where: { id: slideId } });
    await tx.slide.delete({ where: { id: slideId } });
    const after = await tx.slide.findMany({ where: { presentationId, index: { gt: old.index } }, orderBy: { index: "desc" } });
    for (const s of after) await tx.slide.update({ where: { id: s.id }, data: { index: s.index + replacements.length - 1 + 1000 } });
    const ids: string[] = [];
    for (let i = 0; i < replacements.length; i++) ids.push(await insertSlide(tx, presentationId, replacements[i], old.index + i));
    for (const s of after) await tx.slide.update({ where: { id: s.id }, data: { index: s.index + replacements.length - 1 } });
    return ids;
  }, { timeout: 120000 });
}

/** Creates GeneratedImage rows for slides that requested AI imagery and links them to elements/background. */
export async function createImageRequests(presentationId: string, slideIds: string[]) {
  const slides = await prisma.slide.findMany({ where: { id: { in: slideIds } }, include: { elements: true } });
  const created: string[] = [];
  for (const s of slides) {
    const bg = (s.background || {}) as SlideModel["background"] & { imageRequest?: SlideModel["imageRequest"] };
    const req = bg.imageRequest;
    if (!req) continue;
    const gi = await prisma.generatedImage.create({ data: { presentationId, slideId: s.id, prompt: req.prompt, concept: req.concept, status: "pending" } });
    created.push(gi.id);
    if (req.placement === "background") await prisma.slide.update({ where: { id: s.id }, data: { background: { ...bg, generatedImageId: gi.id } as Prisma.InputJsonValue } });
    else {
      const el = s.elements.find((e) => e.type === "image" && e.origin === "ai_image" && !e.generatedImageId);
      if (el) await prisma.slideElement.update({ where: { id: el.id }, data: { generatedImageId: gi.id } });
    }
  }
  return created;
}

function attachImageRequests(slides: SlideModel[]) {
  // store the request inside background JSON so it survives persistence
  for (const s of slides) if (s.imageRequest) (s.background as unknown as { imageRequest?: SlideModel["imageRequest"] }).imageRequest = s.imageRequest;
}

/* ------------------------------ flows ------------------------------ */

export async function runFullGeneration(presentationId: string, styleId: string | null, log: (m: string) => Promise<void>) {
  const { ctx, styleName, plannerNote } = await buildContext(presentationId, styleId, { useAiPlanner: true });
  if (plannerNote) await log(plannerNote);
  if (!ctx.blocks.length) throw new Error("No content blocks found. Add presentation content first.");
  const slides = generateSlides(ctx);
  attachImageRequests(slides);
  await log(`Laid out ${slides.length} slides in style "${styleName}".`);
  const ids = await replaceAllSlides(presentationId, slides);
  await prisma.presentation.update({ where: { id: presentationId }, data: { styleId: ctx.styleId, status: "awaiting_review" } });
  let imageIds: string[] = [];
  if (ctx.aiImages) { imageIds = await createImageRequests(presentationId, ids); await log(`${imageIds.length} image request(s) prepared for Nano Banana Pro.`); }
  const report = await runIntegrityCheck(presentationId);
  await log(`Integrity: ${report.ok ? "verified" : `${report.issues.length} issue(s)`}.`);
  return { slideCount: slides.length, imageIds, integrity: report.ok };
}

export async function runThreeStyles(presentationId: string, styleIds: string[], log: (m: string) => Promise<void>) {
  if (styleIds.length !== 3) throw new Error("Three style IDs are required for the comparison mode.");
  await prisma.styleProposal.deleteMany({ where: { presentationId } });
  let order = 0;
  for (const sid of styleIds) {
    const { ctx, styleName } = await buildContext(presentationId, sid);
    if (!ctx.blocks.length) throw new Error("No content blocks found. Add presentation content first.");
    const all = generateSlides({ ...ctx, aiImages: false }); // proposals never trigger image generation
    // representative selection: cover, first section/content, first list-like, and one more content
    const pick: SlideModel[] = [];
    const take = (pred: (s: SlideModel) => boolean) => { const s = all.find((x) => pred(x) && !pick.includes(x)); if (s) pick.push(s); };
    take((s) => s.purpose === "cover"); take((s) => s.purpose === "section"); take((s) => s.purpose === "content"); take((s) => s.purpose === "list"); take((s) => s.purpose === "content" || s.purpose === "list");
    const slides = pick.slice(0, 4).sort((a, b) => a.index - b.index);
    await prisma.styleProposal.create({ data: { presentationId, styleId: sid, order: order++, slides: slides as unknown as Prisma.InputJsonValue } });
    await log(`Prepared preview for "${styleName}" (${slides.length} representative slides).`);
  }
  await prisma.presentation.update({ where: { id: presentationId }, data: { status: "awaiting_review" } });
}

export async function runRegenerateSlides(presentationId: string, slideIds: string[], styleId: string | null, log: (m: string) => Promise<void>) {
  const { ctx } = await buildContext(presentationId, styleId);
  const existing = await loadSlides(presentationId);
  let created: string[] = [];
  for (const id of slideIds) {
    const s = existing.find((x) => x.id === id);
    if (!s) continue;
    const sectionNo = existing.filter((x) => x.index <= s.index && (x.purpose === "section" || (x.elements.some((e) => e.blockId && ctx.blocks.find((b) => b.id === e.blockId)?.kind === "heading")))).length || 1;
    const { slides: made, fragMeta } = relayoutSlide(ctx, s, sectionNo);
    const { shifts, countDelta } = remapFragments(made, fragMeta);
    attachImageRequests(made);
    // Keep already generated/approved images of this slide where possible
    const prevBgImg = s.background.generatedImageId;
    if (prevBgImg && made[0].imageRequest?.placement === "background") { made[0].background.generatedImageId = prevBgImg; made[0].imageRequest = null; delete (made[0].background as unknown as { imageRequest?: unknown }).imageRequest; }
    const prevEl = s.elements.find((e) => e.type === "image" && e.generatedImageId);
    if (prevEl) for (const m of made) { const slot = m.elements.find((e) => e.type === "image" && e.origin === "ai_image"); if (slot) { slot.generatedImageId = prevEl.generatedImageId; (slot.props as ImageProps).src = `/api/files/generated/${prevEl.generatedImageId}`; (slot.props as ImageProps).placeholder = false; m.imageRequest = null; delete (m.background as unknown as { imageRequest?: unknown }).imageRequest; } }
    const ids = await replaceOneSlide(presentationId, id, made);
    created.push(...ids);
    // Fragment metadata of the same blocks on OTHER slides (index/count only; no visual change)
    if (shifts.length) {
      const others = await prisma.slideElement.findMany({ where: { slide: { presentationId, id: { notIn: ids } }, blockId: { in: [...countDelta.keys()] } } });
      for (const e of others) {
        let fi = e.fragmentIndex ?? 0;
        for (const sh of shifts) if (sh.realId === e.blockId && fi > sh.afterIndex) fi += sh.shift;
        await prisma.slideElement.update({ where: { id: e.id }, data: { fragmentIndex: fi, fragmentCount: (e.fragmentCount ?? 1) + (countDelta.get(e.blockId!) || 0) } });
      }
    }
    await log(`Slide ${s.index + 1} regenerated${made.length > 1 ? ` into ${made.length} slides` : ""}.`);
  }
  if (ctx.aiImages) created = await createImageRequests(presentationId, created);
  await runIntegrityCheck(presentationId);
  return { imageIds: ctx.aiImages ? created : [] };
}

/* ------------------------------ integrity ------------------------------ */

export async function runIntegrityCheck(presentationId: string, extra: IntegrityIssue[] = []): Promise<IntegrityReport> {
  const blocks = await loadBlocks(presentationId);
  const slides = await loadSlides(presentationId);
  const report = verifyIntegrity(blocks, slides, extra);
  await prisma.presentation.update({ where: { id: presentationId }, data: { integrityStatus: report.ok ? "verified" : "issues", integrityReport: report as unknown as Prisma.InputJsonValue } });
  return report;
}

/* ------------------------------ images ------------------------------ */

export async function imagePromptFor(presentationId: string, concept: string) {
  const { ctx } = await buildContext(presentationId, null);
  const env = makeEnv(ctx);
  return buildImagePrompt(env, concept);
}
