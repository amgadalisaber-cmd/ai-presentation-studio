import { z } from "zod";
import { handler, ownCompany, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
async function own(userId: string, id: string) { const g = await prisma.brandGuideline.findUnique({ where: { id } }); if (!g) throw new ApiError(404, "Guideline not found"); await ownCompany(userId, g.companyId); return g; }
export const PATCH = handler<{ id: string }>(async (req, { id }, userId) => { await own(userId, id); const body = await parse(req, z.object({ category: z.string().optional(), rule: z.string().optional(), approved: z.boolean().optional() })); return prisma.brandGuideline.update({ where: { id }, data: body }); });
export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => { await own(userId, id); await prisma.brandGuideline.delete({ where: { id } }); return { ok: true }; });
