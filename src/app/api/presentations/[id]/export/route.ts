import { z } from "zod";
import { handler, logHistory, ownPresentation, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const { formats } = await parse(req, z.object({ formats: z.array(z.enum(["pptx", "pdf"])).min(1) }));
  const slides = await prisma.slide.count({ where: { presentationId: id } });
  if (!slides) throw new ApiError(409, "Generate the presentation before exporting.");
  const running = await prisma.exportJob.findFirst({ where: { presentationId: id, status: { in: ["queued", "checking", "running"] } } });
  if (running) throw new ApiError(409, "An export is already in progress for this presentation.");
  const job = await prisma.exportJob.create({ data: { presentationId: id, formats: [...new Set(formats)] } });
  enqueue("export", job.id); await logHistory(id, "export.queued", { formats });
  return job;
});
