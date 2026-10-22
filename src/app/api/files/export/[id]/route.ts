import { handler, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { ApiError } from "@/lib/auth";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const f = await prisma.exportedFile.findUnique({ where: { id }, include: { exportJob: true } });
  if (!f) throw new ApiError(404, "File not found");
  await ownPresentation(userId, f.exportJob.presentationId);
  const buf = await readFile(f.storagePath);
  const mime = f.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": mime, "Content-Length": String(buf.length), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}` } });
});
