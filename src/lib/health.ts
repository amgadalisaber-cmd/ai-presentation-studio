import fs from "fs";
import path from "path";
import { prisma } from "./db";
import { chromiumPath } from "./export/browser";
import { STORAGE_DIR } from "./storage";
import { imageProviderStatus } from "./images/nanobanana";

export interface HealthCheck { key: string; label: string; ok: boolean; detail: string; fix?: string }
export interface Health { ok: boolean; checks: HealthCheck[]; checkedAt: string }

/** Sanitizes error text so connection strings or passwords never reach the browser. */
function sanitize(msg: string) {
  return msg.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://…").replace(/password=\S+/gi, "password=…").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" ").slice(0, 400);
}

export function isDatabaseError(e: unknown) {
  const m = ((e as Error)?.message || String(e)) + " " + ((e as { code?: string })?.code || "");
  return /P10\d\d|P2021|P2022|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Can't reach database|does not exist in the current database|relation .* does not exist|DATABASE_URL|PrismaClientInitializationError|PrismaClientKnownRequestError|Authentication failed|SSL|Environment variable not found/i.test(m);
}

export async function checkHealth(): Promise<Health> {
  const checks: HealthCheck[] = [];
  checks.push({ key: "node", label: "Node.js", ok: Number(process.versions.node.split(".")[0]) >= 20, detail: `v${process.versions.node}`, fix: "Use Node 20 or newer." });
  const url = process.env.DATABASE_URL;
  checks.push({ key: "env", label: "DATABASE_URL", ok: !!url, detail: url ? `set (${url.replace(/\/\/.*@/, "//…@").slice(0, 60)}…)` : "not set", fix: "Set DATABASE_URL to a PostgreSQL connection string in the server environment (.env or the host's environment variables). Managed databases usually need ?sslmode=require." });
  let dbOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; checks.push({ key: "db", label: "Database connection", ok: true, detail: "reachable" }); }
  catch (e) { checks.push({ key: "db", label: "Database connection", ok: false, detail: sanitize((e as Error).message || String(e)), fix: "Start PostgreSQL / check host, port, user, password and SSL in DATABASE_URL. The app server must be able to reach the database network." }); }
  if (dbOk) {
    try { const n = await prisma.visualStyle.count(); const users = await prisma.user.count(); checks.push({ key: "schema", label: "Database tables", ok: true, detail: `ready · ${n} visual styles · ${users} user(s)`, fix: n === 0 ? "Run `npm run db:seed` to add the built-in visual styles." : undefined }); if (n === 0) checks[checks.length - 1].ok = false; }
    catch (e) { checks.push({ key: "schema", label: "Database tables", ok: false, detail: sanitize((e as Error).message || String(e)), fix: "Create the tables once with `npm run setup` (runs `prisma db push` and seeds the built-in styles). With Docker this happens automatically on start." }); }
  }
  const chromium = chromiumPath();
  checks.push({ key: "chromium", label: "Chromium (PDF export, render validation)", ok: !!chromium, detail: chromium || "not found", fix: "Install Chrome/Chromium on the server and set CHROMIUM_PATH, or deploy with the provided Dockerfile. PowerPoint export works without it." });
  let storageOk = false; let storageDetail = STORAGE_DIR;
  try { fs.mkdirSync(path.join(STORAGE_DIR, "exports"), { recursive: true }); const t = path.join(STORAGE_DIR, ".write-test"); fs.writeFileSync(t, "ok"); fs.unlinkSync(t); storageOk = true; } catch (e) { storageDetail = `${STORAGE_DIR} — ${sanitize((e as Error).message)}`; }
  checks.push({ key: "storage", label: "File storage", ok: storageOk, detail: storageDetail, fix: "Make STORAGE_DIR writable (persistent disk). Serverless hosts have no persistent disk; use a VPS/Docker host." });
  const img = imageProviderStatus();
  checks.push({ key: "gemini", label: "Nano Banana Pro (optional)", ok: true, detail: img.configured ? `configured · ${img.model}` : "GEMINI_API_KEY not set — AI images off, rule-based amend interpreter" });
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const fontsOk = ["Inter-Regular.ttf", "Cairo-Regular.ttf"].every((f) => fs.existsSync(path.join(fontsDir, f)));
  checks.push({ key: "fonts", label: "Bundled fonts", ok: fontsOk, detail: fontsOk ? "Inter, Cairo present" : `missing in ${fontsDir}`, fix: "Keep public/fonts from the repository in the deployment." });
  const required = checks.filter((c) => ["env", "db", "schema", "storage"].includes(c.key));
  return { ok: required.every((c) => c.ok), checks, checkedAt: new Date().toISOString() };
}
