export const maxDuration = 300;
import { z } from "zod";
import { handler, logHistory, ownPresentation, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const body = await parse(req, z.object({ slideIds: z.array(z.string()).min(1), styleId: z.string().optional().nullable() }));
  if (body.styleId) await ownStyle(userId, body.styleId);
  const running = await prisma.generationJob.findFirst({ where: { presentationId: id, status: { in: ["queued", "running"] } } });
  if (running) throw new ApiError(409, "A generation job is already running for this presentation.");
  const job = await prisma.generationJob.create({ data: { presentationId: id, kind: "slides", params: { slideIds: body.slideIds, styleId: body.styleId ?? null } } });
  await enqueue("generation", job.id); await logHistory(id, "generation.slides.queued", { slideIds: body.slideIds });
  return job;
});
