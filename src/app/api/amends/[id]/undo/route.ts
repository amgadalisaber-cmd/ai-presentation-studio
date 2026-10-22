import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { undoAmend } from "@/lib/amends/service";
export const POST = handler<{ id: string }>(async (_req, { id }, userId) => {
  const a = await prisma.amend.findUnique({ where: { id } }); if (!a) throw new ApiError(404, "Amend not found");
  await ownPresentation(userId, a.presentationId);
  try { return await undoAmend(id); } catch (e) { throw new ApiError(409, (e as Error).message); }
});
