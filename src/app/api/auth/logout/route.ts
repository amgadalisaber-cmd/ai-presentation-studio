import { publicHandler } from "@/lib/api";
import { destroySession } from "@/lib/auth";
export const POST = publicHandler(async () => { await destroySession(); return { ok: true }; });
