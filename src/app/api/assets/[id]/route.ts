import { z } from "zod";
import { handler, ownAsset, ownCompany, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownAsset(userId, id);
  const body = await parse(req, z.object({ name: z.string().optional(), kind: z.string().optional(), approved: z.boolean().optional(), notes: z.string().nullable().optional(), companyId: z.string().nullable().optional() }));
  if (body.companyId) await ownCompany(userId, body.companyId);
  return prisma.brandAsset.update({ where: { id }, data: body });
});
export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  const a = await ownAsset(userId, id);
  await prisma.brandAsset.delete({ where: { id } }); await deleteFile(a.storagePath); return { ok: true };
});
