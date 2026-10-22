export const maxDuration = 300;
import { z } from "zod";
import { handler, logHistory, ownPresentation, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";
/** Change the visual style for the whole presentation or selected slides only; slides are re-laid out with content preserved. */
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const body = await parse(req, z.object({ styleId: z.string(), scope: z.enum(["all", "slides"]), slideIds: z.array(z.string()).optional() }));
  await ownStyle(userId, body.styleId);
  const running = await prisma.generationJob.findFirst({ where: { presentationId: id, status: { in: ["queued", "running"] } } });
  if (running) throw new ApiError(409, "A generation job is already running for this presentation.");
  let slideIds = body.slideIds || [];
  if (body.scope === "all") { await prisma.presentation.update({ where: { id }, data: { styleId: body.styleId } }); slideIds = (await prisma.slide.findMany({ where: { presentationId: id }, select: { id: true } })).map((s) => s.id); }
  if (!slideIds.length) throw new ApiError(400, "No slides selected.");
  const job = await prisma.generationJob.create({ data: { presentationId: id, kind: "slides", params: { slideIds, styleId: body.styleId } } });
  await enqueue("generation", job.id); await logHistory(id, "style.changed", { styleId: body.styleId, scope: body.scope, slides: slideIds.length });
  return job;
});
