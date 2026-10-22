import { handler, ownCompany, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { companySchema } from "../schema";
import { deleteFile } from "@/lib/storage";

export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  await ownCompany(userId, id);
  return prisma.company.findUnique({ where: { id }, include: { assets: { orderBy: { createdAt: "desc" } }, guidelines: { orderBy: { createdAt: "asc" } }, styleLinks: { include: { style: true } }, participants: { include: { presentation: { select: { id: true, name: true, updatedAt: true, status: true } } } } } });
});

export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownCompany(userId, id);
  const body = await parse(req, companySchema.partial());
  return prisma.company.update({ where: { id }, data: { ...body, colors: body.colors ?? undefined, typography: body.typography ?? undefined } });
});

export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  await ownCompany(userId, id);
  const assets = await prisma.brandAsset.findMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });
  for (const a of assets) await deleteFile(a.storagePath);
  return { ok: true };
});
