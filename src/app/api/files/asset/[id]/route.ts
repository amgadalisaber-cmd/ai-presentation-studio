import { handler, ownAsset } from "@/lib/api";
import { readFile } from "@/lib/storage";
export const GET = handler<{ id: string }>(async (_req, { id }, userId) => {
  const a = await ownAsset(userId, id);
  const buf = await readFile(a.storagePath);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": a.mimeType, "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="${encodeURIComponent(a.fileName)}"` } });
});
