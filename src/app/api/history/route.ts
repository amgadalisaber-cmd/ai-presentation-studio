import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
export const GET = handler(async (_req, _p, userId) => {
  const [generation, exports, images] = await Promise.all([
    prisma.generationJob.findMany({ where: { presentation: { userId } }, orderBy: { createdAt: "desc" }, take: 50, include: { presentation: { select: { id: true, name: true } } } }),
    prisma.exportJob.findMany({ where: { presentation: { userId } }, orderBy: { createdAt: "desc" }, take: 50, include: { presentation: { select: { id: true, name: true } }, files: true } }),
    prisma.generatedImage.findMany({ where: { presentation: { userId } }, orderBy: { createdAt: "desc" }, take: 50, include: { presentation: { select: { id: true, name: true } } } }),
  ]);
  return { generation, exports, images };
});
