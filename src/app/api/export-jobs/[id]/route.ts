import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const j = await prisma.exportJob.findUnique({ where: { id }, include: { files: true } }); if (!j) throw new ApiError(404, "Export job not found");
  await ownPresentation(userId, j.presentationId); return j;
});
