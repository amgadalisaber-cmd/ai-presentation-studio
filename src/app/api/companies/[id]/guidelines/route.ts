import { z } from "zod";
import { handler, ownCompany, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownCompany(userId, id);
  const body = await parse(req, z.object({ category: z.string().min(1), rule: z.string().min(1), approved: z.boolean().optional() }));
  return prisma.brandGuideline.create({ data: { companyId: id, ...body } });
});
