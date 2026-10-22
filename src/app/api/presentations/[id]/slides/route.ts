import { z } from "zod";
import { handler, logHistory, ownPresentation, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadBlocks, loadSlides, runIntegrityCheck } from "@/lib/generation/service";
import { Prisma } from "@prisma/client";

export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const p = await ownPresentation(userId, id);
  const [slides, blocks, images, styles] = await Promise.all([loadSlides(id), loadBlocks(id), prisma.generatedImage.findMany({ where: { presentationId: id } }), prisma.visualStyle.findMany({ where: { OR: [{ userId }, { isBuiltIn: true }] }, select: { id: true, name: true, isBuiltIn: true } })]);
  return { presentation: { id: p.id, name: p.name, language: p.language, styleId: p.styleId, aiImages: p.aiImages, status: p.status, integrityStatus: p.integrityStatus, integrityReport: p.integrityReport }, slides, blocks, images, styles };
});

const elementSchema = z.object({ id: z.string().optional().nullable(), type: z.enum(["text", "image", "shape", "logo"]), origin: z.string().optional(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number(), rotation: z.number().optional(), props: z.record(z.any()), blockId: z.string().optional().nullable(), fragmentIndex: z.number().optional().nullable(), fragmentCount: z.number().optional().nullable(), assetId: z.string().optional().nullable(), generatedImageId: z.string().optional().nullable() });
const slideSchema = z.object({ id: z.string().optional().nullable(), layoutKey: z.string(), purpose: z.string(), background: z.record(z.any()), styleId: z.string().optional().nullable(), notes: z.string().optional().nullable(), elements: z.array(elementSchema) });

/** Saves the editor state: slide order, backgrounds, elements (positions, props, additions, deletions). */
export const PUT = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const { slides } = await parse(req, z.object({ slides: z.array(slideSchema) }));
  await prisma.$transaction(async (tx) => {
    const existing = await tx.slide.findMany({ where: { presentationId: id }, select: { id: true } });
    const keep = new Set(slides.map((s) => s.id).filter(Boolean) as string[]);
    await tx.slide.deleteMany({ where: { presentationId: id, id: { notIn: [...keep] } } });
    // temporarily offset indexes to avoid unique clashes
    for (const s of existing) if (keep.has(s.id)) await tx.slide.update({ where: { id: s.id }, data: { index: { increment: 10000 } } });
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      let slideId = s.id || null;
      const data = { index: i, layoutKey: s.layoutKey, purpose: s.purpose, background: s.background as Prisma.InputJsonValue, styleId: s.styleId || null, notes: s.notes || null };
      if (slideId && keep.has(slideId)) await tx.slide.update({ where: { id: slideId }, data });
      else { const created = await tx.slide.create({ data: { presentationId: id, ...data } }); slideId = created.id; }
      const existingEls = await tx.slideElement.findMany({ where: { slideId }, select: { id: true } });
      const keepEls = new Set(s.elements.map((e) => e.id).filter(Boolean) as string[]);
      await tx.slideElement.deleteMany({ where: { slideId, id: { notIn: [...keepEls] } } });
      for (const e of s.elements) {
        const base = { type: e.type, origin: e.origin || "user", x: e.x, y: e.y, w: e.w, h: e.h, z: e.z, rotation: e.rotation || 0, props: e.props as Prisma.InputJsonValue, blockId: e.blockId || null, fragmentIndex: e.fragmentIndex ?? null, fragmentCount: e.fragmentCount ?? null, assetId: e.assetId || null, generatedImageId: e.generatedImageId || null };
        if (e.id && existingEls.some((x) => x.id === e.id)) await tx.slideElement.update({ where: { id: e.id }, data: base });
        else await tx.slideElement.create({ data: { slideId, ...base } });
      }
    }
  }, { timeout: 120000 });
  const report = await runIntegrityCheck(id);
  await logHistory(id, "slides.saved", { slides: slides.length, integrity: report.ok });
  return { slides: await loadSlides(id), integrity: report };
});
