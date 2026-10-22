import { z } from "zod";
import { handler, ownPresentation, parse } from "@/lib/api";
import { listAmends, submitAmend } from "@/lib/amends/service";
import { imageProviderStatus } from "@/lib/images/nanobanana";
export const GET = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const url = new URL(req.url); const slideId = url.searchParams.get("slideId");
  return { interpreter: imageProviderStatus().configured ? "ai" : "rules", amends: await listAmends(id, slideId === null ? undefined : slideId === "" ? null : slideId) };
});
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const body = await parse(req, z.object({ slideId: z.string().nullable().optional(), message: z.string().min(1).max(4000) }));
  return submitAmend(id, body.slideId || null, body.message.trim(), userId);
});
