import { z } from "zod";
import { handler, ownAsset, ownStyle, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
export const POST = handler<{ id: string }>(async (req, { id }, userId) => {
  const s = await ownStyle(userId, id);
  if (s.isBuiltIn) throw new ApiError(403, "Duplicate the built-in style first to add references.");
  const body = await parse(req, z.object({ assetId: z.string().optional(), url: z.string().optional(), note: z.string().optional() }));
  if (body.assetId) await ownAsset(userId, body.assetId);
  if (!body.assetId && !body.url) throw new ApiError(400, "Provide an asset or a URL");
  return prisma.styleReference.create({ data: { styleId: id, assetId: body.assetId, url: body.url, note: body.note }, include: { asset: true } });
});
