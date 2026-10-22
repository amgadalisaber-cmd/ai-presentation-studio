import { handler, ownPresentation } from "@/lib/api";
import { runIntegrityCheck } from "@/lib/generation/service";
export const POST = handler<{ id: string }>(async (_req, { id }, userId) => { await ownPresentation(userId, id); return runIntegrityCheck(id); });
