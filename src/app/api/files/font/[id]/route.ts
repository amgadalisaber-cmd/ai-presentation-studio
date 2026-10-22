import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { readFile } from "@/lib/storage";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const f = await prisma.userFont.findFirst({ where: { id, userId } }); if (!f) throw new ApiError(404, "Font not found");
  const buf = await readFile(f.storagePath);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": f.mimeType, "Cache-Control": "private, max-age=86400" } });
});
