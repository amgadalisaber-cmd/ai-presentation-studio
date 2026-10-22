/* Deployment doctor: checks environment, database, Chromium, storage and fonts. Run with `npm run doctor`. */
import fs from "fs";
import path from "path";
const ok = (m: string) => console.log(`  ✓ ${m}`); const bad = (m: string) => { console.log(`  ✗ ${m}`); failures++; }; let failures = 0;
async function main() {
  console.log("AI Presentation Studio — deployment check\n");
  const nodeMajor = Number(process.versions.node.split(".")[0]); nodeMajor >= 20 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} — version 20 or newer is required`);
  if (!fs.existsSync(".env")) bad(".env is missing — copy .env.example to .env and fill it in"); else ok(".env present");
  const { config } = await import("dotenv").catch(() => ({ config: () => undefined })); if (config) config();
  process.env.DATABASE_URL ? ok("DATABASE_URL set") : bad("DATABASE_URL is not set (PostgreSQL connection string)");
  try { const { PrismaClient } = await import("@prisma/client"); const prisma = new PrismaClient(); await prisma.$queryRaw`SELECT 1`; const styles = await prisma.visualStyle.count().catch(() => -1); styles >= 0 ? ok(`Database reachable · ${styles} visual styles (run \`npm run setup\` if 0)`) : bad("Database reachable but tables are missing — run `npm run setup`"); await prisma.$disconnect(); }
  catch (e) { bad(`Database connection failed: ${(e as Error).message.split("\n")[0]} — start PostgreSQL / check DATABASE_URL`); }
  try { const { chromiumPath } = await import("../src/lib/export/browser"); const p = chromiumPath(); p ? ok(`Chromium: ${p}`) : bad("Chromium/Chrome not found — install it and set CHROMIUM_PATH (needed for PDF export)"); } catch (e) { bad(`Chromium check failed: ${(e as Error).message}`); }
  const storage = path.resolve(process.env.STORAGE_DIR || "./storage"); try { fs.mkdirSync(path.join(storage, "exports"), { recursive: true }); fs.writeFileSync(path.join(storage, ".write-test"), "ok"); fs.unlinkSync(path.join(storage, ".write-test")); ok(`Storage writable: ${storage}`); } catch { bad(`Storage not writable: ${storage}`); }
  for (const f of ["Inter-Regular.ttf", "Cairo-Regular.ttf", "Cairo-Bold.ttf"]) fs.existsSync(path.join("public", "fonts", f)) ? ok(`Font ${f}`) : bad(`Missing font public/fonts/${f}`);
  process.env.GEMINI_API_KEY ? ok("GEMINI_API_KEY set (Nano Banana Pro + AI amend interpreter enabled)") : console.log("  · GEMINI_API_KEY not set — AI images disabled, rule-based amend interpreter in use (optional)");
  console.log(failures ? `\n${failures} problem(s) found.` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}
main();
