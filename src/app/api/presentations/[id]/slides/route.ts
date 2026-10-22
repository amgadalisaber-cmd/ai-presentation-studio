import { z } from "zod";
import { handler, logHistory, ownPresentation, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadBlocks, loadSlides, runIntegrityCheck, saveSlides } from "@/lib/generation/service";
import type { SlideModel } from "@/lib/types";

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
  await saveSlides(id, slides as unknown as SlideModel[]);
  const report = await runIntegrityCheck(id);
  await logHistory(id, "slides.saved", { slides: slides.length, integrity: report.ok });
  return { slides: await loadSlides(id), integrity: report };
});
