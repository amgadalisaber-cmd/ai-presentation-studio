import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
export const POST = handler<{ id: string }>(async (_req, { id }, userId) => {
  const img = await prisma.generatedImage.findUnique({ where: { id } }); if (!img) throw new ApiError(404, "Image not found");
  await ownPresentation(userId, img.presentationId);
  return prisma.generatedImage.update({ where: { id }, data: { status: "rejected" } });
});
