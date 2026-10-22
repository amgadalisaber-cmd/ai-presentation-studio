export const maxDuration = 300;
import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { imageProviderStatus } from "@/lib/images/nanobanana";
import { INLINE_JOBS, processPendingImages } from "@/lib/jobs/runner";
export const GET = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const url = new URL(req.url);
  if (INLINE_JOBS && url.searchParams.get("process") !== "0") {
    if (imageProviderStatus().configured) await processPendingImages(id, 1);
    else await prisma.generatedImage.updateMany({ where: { presentationId: id, status: "pending" }, data: { status: "failed", error: "Nano Banana Pro is not configured. Set GEMINI_API_KEY on the server (see Settings & Integrations)." } });
  }
  return { provider: imageProviderStatus(), inline: INLINE_JOBS, images: await prisma.generatedImage.findMany({ where: { presentationId: id }, orderBy: { createdAt: "asc" }, include: { slide: { select: { id: true, index: true, purpose: true } } } }) };
});
