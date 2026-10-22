import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => { await ownPresentation(userId, id); return prisma.styleProposal.findMany({ where: { presentationId: id }, orderBy: { order: "asc" }, include: { style: true } }); });
