import { handler, ownStyle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
export const DELETE = handler<{ id: string }>(async (_req, { id }, userId) => {
  const r = await prisma.styleReference.findUnique({ where: { id } }); if (!r) throw new ApiError(404, "Reference not found");
  await ownStyle(userId, r.styleId, false); await prisma.styleReference.delete({ where: { id } }); return { ok: true };
});
