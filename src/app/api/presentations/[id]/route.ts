import { handler, logHistory, ownPresentation, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { presentationSchema } from "../schema";
import { replaceContent, syncRelations } from "@/lib/presentations";
import { deleteFile } from "@/lib/storage";
import { Prisma } from "@prisma/client";

export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  await ownPresentation(userId, id);
  return prisma.presentation.findUnique({ where: { id }, include: {
    style: true,
    participants: { include: { company: { include: { assets: { where: { kind: { contains: "logo" } }, take: 3 } } } }, orderBy: { order: "asc" } },
    companies: { include: { company: { select: { id: true, name: true } } }, orderBy: { order: "asc" } },
    proposals: { include: { style: { select: { id: true, name: true, description: true } } }, orderBy: { order: "asc" } },
    generationJobs: { orderBy: { createdAt: "desc" }, take: 10 },
    exportJobs: { orderBy: { createdAt: "desc" }, take: 10, include: { files: true } },
    generatedImages: { orderBy: { createdAt: "asc" } },
    history: { orderBy: { createdAt: "desc" }, take: 30 },
    _count: { select: { blocks: true, slides: true } },
  } });
});

export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => {
  const existing = await ownPresentation(userId, id);
  const body = await parse(req, presentationSchema.partial());
  if (body.styleId) await ownStyle(userId, body.styleId);
  const data: Prisma.PresentationUpdateInput = {};
  for (const k of ["name", "type", "customType", "language", "contentSource", "customDirection", "threeStyleMode", "aiImages", "presentedByEnabled", "presentedToEnabled", "projectNotes"] as const) if (body[k] !== undefined) (data as Record<string, unknown>)[k] = body[k];
  if (body.styleId !== undefined) data.style = body.styleId ? { connect: { id: body.styleId } } : { disconnect: true };
  if (body.metadata !== undefined) data.metadata = body.metadata as Prisma.InputJsonValue;
  await prisma.presentation.update({ where: { id }, data });
  let contentChanged = false;
  if (body.content !== undefined && body.content !== existing.sourceContent) {
    if (existing.contentLocked) { const { ApiError } = await import("@/lib/auth"); throw new ApiError(409, "Content is locked for this presentation. Unlock it before editing."); }
    await replaceContent(id, body.content); contentChanged = true;
    await logHistory(id, "content.replaced", { blocks: (await prisma.contentBlock.count({ where: { presentationId: id } })) });
  }
  await syncRelations(userId, id, body);
  await logHistory(id, "presentation.updated", { fields: Object.keys(body) });
  return { ok: true, contentChanged };
});

export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  await ownPresentation(userId, id);
  const files = await prisma.exportedFile.findMany({ where: { exportJob: { presentationId: id } } });
  const images = await prisma.generatedImage.findMany({ where: { presentationId: id } });
  await prisma.presentation.delete({ where: { id } });
  for (const f of files) await deleteFile(f.storagePath);
  for (const i of images) if (i.storagePath) await deleteFile(i.storagePath);
  return { ok: true };
});
