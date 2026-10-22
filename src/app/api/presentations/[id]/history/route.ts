import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => { await ownPresentation(userId, id); return prisma.projectHistory.findMany({ where: { presentationId: id }, orderBy: { createdAt: "desc" }, take: 100 }); });
