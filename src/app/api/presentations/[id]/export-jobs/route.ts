import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => { await ownPresentation(userId, id); return prisma.exportJob.findMany({ where: { presentationId: id }, orderBy: { createdAt: "desc" }, include: { files: true }, take: 20 }); });
