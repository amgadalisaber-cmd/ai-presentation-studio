import { z } from "zod";
import { handler, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => {
  const f = await prisma.userFont.findFirst({ where: { id, userId } }); if (!f) throw new ApiError(404, "Font not found");
  const body = await parse(req, z.object({ family: z.string().min(1).optional(), weight: z.number().int().min(100).max(900).optional(), style: z.enum(["normal", "italic"]).optional(), supportsArabic: z.boolean().optional() }));
  return prisma.userFont.update({ where: { id }, data: body });
});
export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  const f = await prisma.userFont.findFirst({ where: { id, userId } }); if (!f) throw new ApiError(404, "Font not found");
  await prisma.userFont.delete({ where: { id } }); await deleteFile(f.storagePath); return { ok: true };
});
