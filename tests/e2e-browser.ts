/* Browser end-to-end test against the running server (http://localhost:3000). */
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();
const OUT = "tests/out/browser"; const shots: string[] = [];
const CONTENT = `Brand Strategy 2027

Where we are today

HALFLENS has grown into a multidisciplinary studio serving twelve retained clients across the GCC. Our work spans brand identity, campaign production and strategic consulting.

Strategic pillars

- Craft: every deliverable meets a cinematic standard
- Clarity: strategy before execution, always
- Partnership: we grow with our clients, not around them

الرؤية

نطمح إلى أن نكون الشريك الإبداعي الأول للعلامات التجارية الطموحة في المنطقة، من خلال الجمع بين الحرفية السينمائية والاستراتيجية المبنية على البيانات.

Investment

1. Studio expansion: $1.2M
2. Talent: $800K`;

async function main() {
  await prisma.user.deleteMany({}); // clean workspace: exercises the first-run setup flow
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
  const shot = async (n: string) => { const p = path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-${n}.png`); await page.screenshot({ path: p, fullPage: false }); shots.push(p); };
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  const step = (s: string) => console.log(`• ${s}`);

  step("setup"); await page.goto(`${BASE}/`); await page.waitForURL(/\/setup/);
  await page.fill('input.input >> nth=0', "Amgad"); await page.fill('input[type="email"]', "designer@halflens.studio"); await page.fill('input[type="password"]', "studio-pass-123");
  await page.click("button:has-text('Create workspace')"); await page.waitForURL(`${BASE}/`); await shot("dashboard-empty");

  step("client profile + logo"); await page.goto(`${BASE}/clients/new`);
  await page.fill("input.input >> nth=0", "HALFLENS"); await page.fill("input.input >> nth=2", "Creative studio");
  await page.click("button:has-text('Add color')"); await page.fill("input.input.w-32", "#0f0f12"); await page.click("button:has-text('Create profile')"); await page.waitForURL(/\/clients\/(?!new)[a-z0-9]+$/);
  const clientUrl = page.url();
  await page.goto(`${clientUrl}?tab=assets`);
  // make a simple PNG logo on the fly
  const logoPng = await fs.readFile("tests/fixtures/logo.png");
  await page.setInputFiles('input[type="file"]', { name: "halflens-logo.png", mimeType: "image/png", buffer: logoPng });
  await page.waitForSelector("text=halflens-logo.png"); await shot("client-assets");
  await page.goto(`${clientUrl}?tab=rules`); await page.fill("input.input", "Never place the logo on a busy image area; keep clear space equal to the mark height."); await page.click("button:has-text('Add rule')"); await page.waitForSelector("text=Never place the logo");

  step("new presentation"); await page.goto(`${BASE}/presentations/new`);
  await page.fill("input.input >> nth=0", "HALFLENS Brand Strategy 2027");
  await page.selectOption("select.select >> nth=0", "Brand Strategy");
  await page.fill("textarea.textarea", CONTENT);
  await page.waitForSelector("text=content blocks detected");
  // client selection: pick HALFLENS as primary
  await page.fill('input[placeholder="Search or create a client profile…"]', "HALF"); await page.click("button:has-text('HALFLENS')");
  // presented by: HALFLENS + custom partner; presented to: create new company + custom
  const byInput = page.locator('input[placeholder="Search or create a company…"]').first(); await byInput.fill("HALF"); await page.locator("div.card button:has-text('HALFLENS')").first().click();
  await page.locator('input[placeholder="Or enter a custom name / title (no profile)"]').first().fill("Partner Agency"); await page.locator("button:has-text('Add')").first().click();
  const toInput = page.locator('input[placeholder="Search or create a company…"]').nth(1); await toInput.fill("Client Company A"); await page.click("button:has-text('Create “Client Company A”')");
  await page.locator('input[placeholder="Or enter a custom name / title (no profile)"]').nth(1).fill("Government Entity"); await page.locator("button:has-text('Add')").nth(1).click();
  await page.fill('input.input >> nth=-1', ""); // noop
  await page.locator("label:has-text('Presentation date') + input, div:has(> label:has-text('Presentation date')) input").first().fill("October 2026");
  await page.locator("div:has(> label:has-text('Confidentiality label')) input").first().fill("Confidential");
  await page.locator("button[role='switch']").nth(2).click(); // three-style mode on
  await shot("setup-filled");
  await page.click("button:has-text('Create & continue to generation')"); await page.waitForURL(/\/presentations\/[a-z0-9]+\?tab=generate/);
  const presUrl = page.url().split("?")[0]; const presId = presUrl.split("/").pop()!;
  step(`presentation ${presId}`);

  step("three styles"); await page.click("button:has-text('Generate three examples')");
  await page.waitForSelector("text=Compare the three directions", { timeout: 120000 }); await page.waitForTimeout(1500); await shot("three-proposals");
  await page.locator("button:has-text('Select')").nth(1).click();
  await page.waitForSelector("a:has-text('Review in editor')", { timeout: 120000 }); await shot("generated");

  step("editor"); await page.goto(`${presUrl}/editor`); await page.waitForSelector("text=Slide 1 /"); await page.waitForTimeout(1500); await shot("editor");
  // select slide 2, move an element, add a text element, save
  await page.locator("aside >> nth=0 >> .slide-frame").nth(1).click();
  await page.click("button:has-text('Text')"); await page.fill("textarea.textarea", "Added by designer"); await page.keyboard.press("Control+s"); await page.waitForSelector("text=Saved", { timeout: 15000 });
  await shot("editor-edited");
  // regenerate slide 3
  await page.locator("aside >> nth=0 >> .slide-frame").nth(2).click(); await page.click("button:has-text('Regenerate slide')"); await page.waitForSelector("text=Slides regenerated.", { timeout: 60000 });
  // change style for slide 4 only
  await page.locator("aside >> nth=0 >> .slide-frame").nth(3).click(); await page.click("button:has-text('Change style')"); await page.selectOption(".card select.select", { label: "Luxury" }); await page.click("button[role='switch']"); await page.click("button:has-text('Apply style')"); await page.waitForSelector("text=Slides regenerated.", { timeout: 60000 }); await shot("editor-restyled-slide");

  step("export"); await page.goto(`${presUrl}?tab=export`); await page.waitForSelector("text=Content integrity"); await shot("export-tab");
  await page.click("button:has-text('Check & export')"); await page.waitForSelector("a:has-text('.pptx')", { timeout: 180000 }); await page.waitForSelector("a:has-text('.pdf')", { timeout: 180000 }); await shot("export-done");
  for (const ext of ["pptx", "pdf"]) { const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`a:has-text('.${ext}')`)]); const to = path.join(OUT, `download.${ext}`); await dl.saveAs(to); console.log(`  downloaded ${ext}: ${(await fs.stat(to)).size} bytes`); }
  const exportJob = await prisma.exportJob.findFirst({ where: { presentationId: presId }, orderBy: { createdAt: "desc" }, include: { files: true } });
  console.log("  export:", exportJob?.status, "verified:", exportJob?.verified, "warnings:", (exportJob?.warnings as string[]).length, "files:", exportJob?.files.map((f) => f.format));

  step("images ON path (no key → explicit failure, no simulation)"); await page.goto(`${presUrl}?tab=generate`);
  await page.locator("button[role='switch']").nth(1).click(); // AI images ON
  await page.locator("button[role='switch']").nth(0).click(); // direct mode
  await page.click("button:has-text('Regenerate entire presentation')"); await page.waitForSelector("a:has-text('Review in editor')", { timeout: 120000 });
  await page.goto(`${presUrl}?tab=images`); await page.waitForSelector("text=Nano Banana Pro setup required"); await page.waitForTimeout(2500); await shot("images-tab");
  const imgs = await prisma.generatedImage.findMany({ where: { presentationId: presId } });
  console.log("  image requests:", imgs.length, "statuses:", [...new Set(imgs.map((i) => i.status))], "error sample:", imgs[0]?.error?.slice(0, 80));

  step("duplicate + list"); await page.goto(`${BASE}/presentations`); await shot("presentations-list");
  await page.goto(`${BASE}/styles`); await page.waitForSelector("text=Cinematic"); await shot("styles");
  await page.goto(`${BASE}/history`); await shot("history"); await page.goto(`${BASE}/settings`); await shot("settings");
  await browser.close();
  console.log("DONE", shots.length, "screenshots");
}
main().catch((e) => { console.error("E2E FAILED:", e); process.exit(1); }).finally(() => prisma.$disconnect());
