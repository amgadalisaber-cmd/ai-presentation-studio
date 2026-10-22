import { handler, parse, ownStyle, logHistory } from "@/lib/api";
import { prisma } from "@/lib/db";
import { presentationSchema } from "./schema";
import { syncRelations } from "@/lib/presentations";
import { detectPresentationLanguage, parseContent } from "@/lib/content/parser";
import { Prisma } from "@prisma/client";


export const GET = handler(async (req, _p, userId) => {
  const url = new URL(req.url); const q = url.searchParams.get("q")?.trim(); const status = url.searchParams.get("status");
  return prisma.presentation.findMany({ where: { userId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}), ...(status ? { status } : {}) }, orderBy: { updatedAt: "desc" }, include: { style: { select: { id: true, name: true } }, participants: { include: { company: { select: { id: true, name: true } } } }, _count: { select: { slides: true, exportJobs: true } } } });
});

export const POST = handler(async (req, _p, userId) => {
  const body = await parse(req, presentationSchema);
  if (body.styleId) await ownStyle(userId, body.styleId);
  const content = body.content ?? "";
  const p = await prisma.presentation.create({ data: {
    userId, name: body.name, type: body.type, customType: body.customType, language: body.language || detectPresentationLanguage(content), orientation: body.orientation || "landscape", languageDetected: detectPresentationLanguage(content),
    sourceContent: content, contentSource: body.contentSource || "paste", styleId: body.styleId || null, customDirection: body.customDirection, threeStyleMode: body.threeStyleMode ?? false, aiImages: body.aiImages ?? false,
    presentedByEnabled: body.presentedByEnabled ?? true, presentedToEnabled: body.presentedToEnabled ?? true, metadata: (body.metadata || {}) as Prisma.InputJsonValue, projectNotes: body.projectNotes,
  } });
  if (content.trim()) { const blocks = parseContent(content); await prisma.contentBlock.createMany({ data: blocks.map((b) => ({ ...b, presentationId: p.id })) }); }
  await syncRelations(userId, p.id, body);
  await logHistory(p.id, "presentation.created");
  return prisma.presentation.findUnique({ where: { id: p.id }, include: { _count: { select: { blocks: true } } } });
});
