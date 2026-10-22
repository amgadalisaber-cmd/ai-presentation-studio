import { z } from "zod";
import { publicHandler, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError, createSession, hashPassword, userCount } from "@/lib/auth";

export const POST = publicHandler(async (req) => {
  const body = await parse(req, z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(8) }));
  if ((await userCount()) > 0) throw new ApiError(403, "Workspace already set up. Please sign in.");
  const user = await prisma.user.create({ data: { email: body.email.toLowerCase(), name: body.name, passwordHash: await hashPassword(body.password) } });
  await createSession(user.id);
  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
});
