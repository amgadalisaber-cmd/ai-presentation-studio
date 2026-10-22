import { handler, parse } from "@/lib/api";
import { styleSchema } from "./schema";
import { prisma } from "@/lib/db";
import { normalizeSpec } from "@/lib/styles/spec";


export const GET = handler(async (_req, _p, userId) => prisma.visualStyle.findMany({ where: { OR: [{ userId }, { isBuiltIn: true }] }, orderBy: [{ isBuiltIn: "desc" }, { updatedAt: "desc" }], include: { references: { include: { asset: true } }, companyLinks: { include: { company: { select: { id: true, name: true } } } }, _count: { select: { presentations: true } } } }));

export const POST = handler(async (req, _p, userId) => {
  const body = await parse(req, styleSchema);
  return prisma.visualStyle.create({ data: { ...body, spec: normalizeSpec(body.spec) as object, userId, isBuiltIn: false } });
});
