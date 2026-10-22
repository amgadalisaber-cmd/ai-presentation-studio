import { z } from "zod";
import { handler, logHistory, ownPresentation, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";
import { imageProviderStatus } from "@/lib/images/nanobanana";
import { imagePromptFor } from "@/lib/generation/service";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  const img = await prisma.generatedImage.findUnique({ where: { id } }); if (!img) throw new ApiError(404, "Image not found");
  await ownPresentation(userId, img.presentationId);
  if (!imageProviderStatus().configured) throw new ApiError(409, "Nano Banana Pro is not configured. Set GEMINI_API_KEY on the server (Settings & Integrations).");
  let body: { concept?: string; prompt?: string } = {};
  try { body = await parse(req, z.object({ concept: z.string().optional(), prompt: z.string().optional() })); } catch { body = {}; }
  const prompt = body.prompt?.trim() || (body.concept ? await imagePromptFor(img.presentationId, body.concept) : img.prompt);
  const updated = await prisma.generatedImage.update({ where: { id }, data: { status: "pending", error: null, prompt, concept: body.concept ?? img.concept } });
  enqueue("image", id); await logHistory(img.presentationId, "image.regenerate", { imageId: id });
  return updated;
});
