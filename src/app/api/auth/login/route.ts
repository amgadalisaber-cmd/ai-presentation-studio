import { z } from "zod";
import { publicHandler, parse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ApiError, createSession, verifyPassword } from "@/lib/auth";

export const POST = publicHandler(async (req) => {
  const body = await parse(req, z.object({ email: z.string().email(), password: z.string().min(1) }));
  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw new ApiError(401, "Invalid email or password");
  await createSession(user.id);
  return { ok: true };
});
