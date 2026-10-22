import { handler } from "@/lib/api";
import { prisma } from "@/lib/db";
export const GET = handler(async (_req, _p, userId) => prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }));
