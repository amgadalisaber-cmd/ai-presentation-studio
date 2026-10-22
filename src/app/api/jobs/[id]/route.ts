import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const j = await prisma.generationJob.findUnique({ where: { id } }); if (!j) throw new ApiError(404, "Job not found");
  await ownPresentation(userId, j.presentationId); return j;
});
