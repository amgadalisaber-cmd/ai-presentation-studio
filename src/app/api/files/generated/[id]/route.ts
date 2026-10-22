import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { ApiError } from "@/lib/auth";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const g = await prisma.generatedImage.findUnique({ where: { id } });
  if (!g || !g.storagePath) throw new ApiError(404, "Image not found");
  await ownPresentation(userId, g.presentationId);
  const buf = await readFile(g.storagePath);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": g.mimeType || "image/png", "Cache-Control": "private, max-age=3600" } });
});
