import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { ApiError, requireApiUser } from "./auth";
import { prisma } from "./db";

export type Ctx<P = Record<string, string>> = { params: Promise<P> };

export function handler<P = Record<string, string>>(fn: (req: Request, params: P, userId: string) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireApiUser();
      const params = await ctx.params;
      const out = await fn(req, params, user.id);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) { return errorResponse(e); }
  };
}

export function publicHandler<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try { const out = await fn(req, await ctx.params); if (out instanceof Response) return out; return NextResponse.json(out ?? { ok: true }); }
    catch (e) { return errorResponse(e); }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", details: e.flatten() }, { status: 400 });
  const msg = (e as Error)?.message || "Unexpected error";
  console.error("[api]", e);
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function parse<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new ApiError(400, "Expected a JSON body"); }
  return schema.parse(body);
}

export async function ownPresentation(userId: string, id: string) {
  const p = await prisma.presentation.findFirst({ where: { id, userId } });
  if (!p) throw new ApiError(404, "Presentation not found");
  return p;
}
export async function ownCompany(userId: string, id: string) {
  const c = await prisma.company.findFirst({ where: { id, userId } });
  if (!c) throw new ApiError(404, "Company not found");
  return c;
}
export async function ownAsset(userId: string, id: string) {
  const a = await prisma.brandAsset.findFirst({ where: { id, userId } });
  if (!a) throw new ApiError(404, "Asset not found");
  return a;
}
export async function ownStyle(userId: string, id: string, allowBuiltIn = true) {
  const s = await prisma.visualStyle.findFirst({ where: { id, OR: [{ userId }, ...(allowBuiltIn ? [{ isBuiltIn: true }] : [])] } });
  if (!s) throw new ApiError(404, "Visual style not found");
  return s;
}
export async function logHistory(presentationId: string, action: string, details?: unknown) {
  await prisma.projectHistory.create({ data: { presentationId, action, details: (details ?? null) as never } });
}
