import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { isDatabaseError } from "./health";

const COOKIE = "studio_session";
const TTL_DAYS = 30;

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** Server components: send the visitor to the diagnostics page instead of a blank production error when the DB is down. */
export async function requireUser() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try { user = await getCurrentUser(); }
  catch (e) { if (isDatabaseError(e)) redirect("/status"); throw e; }
  if (!user) redirect("/login");
  return user;
}

export async function safeUserCount() {
  try { return await userCount(); } catch (e) { if (isDatabaseError(e)) redirect("/status"); throw e; }
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  store.delete(COOKIE);
}

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 10); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
export async function userCount() { return prisma.user.count(); }
