import { handler, logHistory, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { imageDimensions, saveFile } from "@/lib/storage";
import { applyImageToSlide } from "@/lib/jobs/runner";
/** Replace a generated image slot with an uploaded image (keeps the slot, marks it approved). */
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  const img = await prisma.generatedImage.findUnique({ where: { id } }); if (!img) throw new ApiError(404, "Image not found");
  await ownPresentation(userId, img.presentationId);
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new ApiError(400, "An image file is required");
  const buf = Buffer.from(await file.arrayBuffer());
  const rel = await saveFile("generated", buf, file.name); const dims = imageDimensions(buf, file.type);
  const updated = await prisma.generatedImage.update({ where: { id }, data: { status: "approved", storagePath: rel, mimeType: file.type, width: dims?.width, height: dims?.height, provider: "upload", error: null } });
  await applyImageToSlide(id); await logHistory(img.presentationId, "image.replaced", { imageId: id });
  return updated;
});
