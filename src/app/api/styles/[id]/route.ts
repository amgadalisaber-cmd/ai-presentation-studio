import { handler, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeSpec } from "@/lib/styles/spec";
import { ApiError } from "@/lib/auth";
import { styleSchema } from "../schema";

export const GET = handler<{ id: string }>(async (_req, { id }, userId) => { await ownStyle(userId, id); return prisma.visualStyle.findUnique({ where: { id }, include: { references: { include: { asset: true } }, companyLinks: { include: { company: { select: { id: true, name: true } } } } } }); });
export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => {
  const s = await ownStyle(userId, id);
  if (s.isBuiltIn) throw new ApiError(403, "Built-in styles cannot be edited. Duplicate it to create an editable copy.");
  const body = await parse(req, styleSchema.partial());
  return prisma.visualStyle.update({ where: { id }, data: { ...body, spec: body.spec ? (normalizeSpec(body.spec) as object) : undefined } });
});
export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  const s = await ownStyle(userId, id);
  if (s.isBuiltIn) throw new ApiError(403, "Built-in styles cannot be deleted.");
  await prisma.visualStyle.delete({ where: { id } }); return { ok: true };
});
