export const maxDuration = 300;
import { z } from "zod";
import { handler, logHistory, ownPresentation, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/runner";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  await ownPresentation(userId, id);
  const { proposalId } = await parse(req, z.object({ proposalId: z.string() }));
  const prop = await prisma.styleProposal.findFirst({ where: { id: proposalId, presentationId: id } });
  if (!prop) throw new ApiError(404, "Proposal not found");
  await prisma.styleProposal.updateMany({ where: { presentationId: id }, data: { selected: false } });
  await prisma.styleProposal.update({ where: { id: proposalId }, data: { selected: true } });
  await prisma.presentation.update({ where: { id }, data: { styleId: prop.styleId, status: "processing" } });
  const job = await prisma.generationJob.create({ data: { presentationId: id, kind: "full", params: { styleId: prop.styleId, fromProposal: proposalId } } });
  await enqueue("generation", job.id); await logHistory(id, "proposal.selected", { proposalId, styleId: prop.styleId });
  return job;
});
