import { z } from "zod";
import { handler, ownCompany, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownCompany(userId, id); const { styleId } = await parse(req, z.object({ styleId: z.string() })); await ownStyle(userId, styleId);
  return prisma.companyVisualStyle.upsert({ where: { companyId_styleId: { companyId: id, styleId } }, update: {}, create: { companyId: id, styleId } });
});
export const DELETE = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownCompany(userId, id); const { styleId } = await parse(req, z.object({ styleId: z.string() }));
  await prisma.companyVisualStyle.deleteMany({ where: { companyId: id, styleId } }); return { ok: true };
});
