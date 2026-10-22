import { z } from "zod";
import { handler, logHistory, ownPresentation, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";

export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  const p = await ownPresentation(userId, id);
  const body = await parse(req, z.object({ mode: z.enum(["three", "direct"]), styleId: z.string().optional().nullable(), styleIds: z.array(z.string()).optional(), useDefaultStyle: z.boolean().optional() }));
  const blocks = await prisma.contentBlock.count({ where: { presentationId: id } });
  if (!blocks) throw new ApiError(409, "Add presentation content before generating.");
  const running = await prisma.generationJob.findFirst({ where: { presentationId: id, status: { in: ["queued", "running"] } } });
  if (running) throw new ApiError(409, "A generation job is already running for this presentation.");
  if (body.mode === "three") {
    let ids = body.styleIds || [];
    if (ids.length !== 3) {
      // Auto-pick three meaningfully different built-in directions (include the selected style if any)
      const all = await prisma.visualStyle.findMany({ where: { OR: [{ userId }, { isBuiltIn: true }] }, orderBy: { createdAt: "asc" } });
      const prefer = ["Cinematic", "Bold Editorial", "Modern Minimal", "Corporate Premium", "Swiss International", "Luxury"];
      ids = [];
      if (p.styleId) ids.push(p.styleId);
      for (const n of prefer) { const s = all.find((x) => x.name === n && !ids.includes(x.id)); if (s && ids.length < 3) ids.push(s.id); }
      for (const s of all) if (ids.length < 3 && !ids.includes(s.id)) ids.push(s.id);
    }
    if (ids.length !== 3) throw new ApiError(400, "Select exactly three styles.");
    for (const sid of ids) await ownStyle(userId, sid);
    await prisma.presentation.update({ where: { id }, data: { threeStyleMode: true, status: "processing" } });
    const job = await prisma.generationJob.create({ data: { presentationId: id, kind: "three_styles", params: { styleIds: ids } } });
    enqueue("generation", job.id); await logHistory(id, "generation.three_styles.queued", { styleIds: ids });
    return job;
  }
  let styleId = body.styleId ?? p.styleId;
  if (!styleId) {
    if (!body.useDefaultStyle) throw new ApiError(422, "No visual style selected. Choose a saved style, write a custom direction, or confirm the proposed default (Modern Minimal).");
    const def = await prisma.visualStyle.findFirst({ where: { isBuiltIn: true, name: "Modern Minimal" } });
    if (!def) throw new ApiError(500, "Default style missing. Run the seed script.");
    styleId = def.id;
  }
  await ownStyle(userId, styleId);
  await prisma.presentation.update({ where: { id }, data: { styleId, threeStyleMode: false, status: "processing" } });
  const job = await prisma.generationJob.create({ data: { presentationId: id, kind: "full", params: { styleId } } });
  enqueue("generation", job.id); await logHistory(id, "generation.full.queued", { styleId });
  return job;
});
