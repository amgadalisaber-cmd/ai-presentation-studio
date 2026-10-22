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

  try {
  step("setup"); await page.goto(`${BASE}/`); await page.waitForURL(/\/setup/);
  await page.fill('input.input >> nth=0', "Amgad"); await page.fill('input[type="email"]', "designer@halflens.studio"); await page.fill('input[type="password"]', "studio-pass-123");
  await page.click("button:has-text('Create workspace')"); await page.waitForURL(`${BASE}/`); await shot("dashboard-empty");

  step("brand (auto-built from a logo file) + manual color"); await page.goto(`${BASE}/clients/new`);
  await page.fill("input.input >> nth=0", "HALFLENS");
  await page.setInputFiles('input[type="file"]', "tests/fixtures/logo.png");
  await page.click("button:has-text('Create brand')"); await page.waitForURL(/\/clients\/(?!new)[a-z0-9]+$/, { timeout: 90000 });
  const clientUrl = page.url();
  const autoAssets = await prisma.brandAsset.count({ where: { company: { name: "HALFLENS" } } }); const autoColors = (await prisma.company.findFirst({ where: { name: "HALFLENS" } }))?.colors as unknown[]; console.log("  auto-extracted: assets", autoAssets, "colors", autoColors?.length);
  await page.click("button:has-text('Add color')"); await page.locator("input.input.w-24").last().fill("#0f0f12"); await page.click("button:has-text('Save')"); await page.waitForSelector("text=Saved");
  await page.goto(`${clientUrl}?tab=assets`); await page.waitForSelector("text=logo.png"); await shot("client-assets");
  await page.goto(`${clientUrl}?tab=rules`); await page.fill("input.input", "Never place the logo on a busy image area; keep clear space equal to the mark height."); await page.click("button:has-text('Add rule')"); await page.waitForSelector("text=Never place the logo");

  step("new presentation"); await page.goto(`${BASE}/presentations/new`);
  await page.fill("input.input >> nth=0", "HALFLENS Brand Strategy 2027");
  await page.selectOption("select.select >> nth=0", "Brand Strategy");
  await page.fill("textarea.textarea", CONTENT);
  await page.waitForSelector("text=blocks ·");
  await page.click("button:has-text('More details')");
  // brand selection: pick HALFLENS as primary
  await page.fill('input[placeholder="Search or create a brand…"]', "HALF"); await page.click("button:has-text('HALFLENS')");
  // presented by: HALFLENS + custom partner; presented to: create new company + custom
  const byInput = page.locator('input[placeholder="Search or create a company…"]').first(); await byInput.fill("HALF"); await page.locator("div.card button:has-text('HALFLENS')").first().click();
  await page.locator('input[placeholder="Or type a name"]').first().fill("Partner Agency"); await page.locator("button:has-text('Add')").first().click();
  const toInput = page.locator('input[placeholder="Search or create a company…"]').nth(1); await toInput.fill("Client Company A"); await page.click("button:has-text('Create “Client Company A”')");
  await page.locator('input[placeholder="Or type a name"]').nth(1).fill("Government Entity"); await page.locator("button:has-text('Add')").nth(1).click();
  await page.fill('input[placeholder="Date"]', "October 2026"); await page.fill('input[placeholder="Confidentiality label"]', "Confidential");
  await page.locator("label:has-text('Show me three concepts first') button, button[role='switch']").first().click(); // three concepts on
  await shot("setup-filled");
  await page.click("button:has-text('Show me three concepts')"); await page.waitForURL(/\/presentations\/[a-z0-9]+\?tab=concept/);
  const presUrl = page.url().split("?")[0]; const presId = presUrl.split("/").pop()!;
  step(`presentation ${presId}`);

  step("three concepts");
  await page.waitForSelector("text=Pick a concept", { timeout: 120000 }); await page.waitForTimeout(1500); await shot("three-proposals");
  await page.locator("button:has-text('Select')").nth(1).click();
  await page.waitForSelector("a:has-text('Open slides')", { timeout: 120000 }); await shot("generated");

  step("editor"); await page.goto(`${presUrl}/editor`); await page.waitForSelector("text=Slide 1 /"); await page.waitForTimeout(1500); await shot("editor");
  // select slide 2, move an element, add a text element, save
  await page.locator("aside >> nth=0 >> .slide-frame").nth(1).click();
  await page.click("button:has-text('Text')"); await page.fill("textarea.textarea", "Added by designer"); await page.keyboard.press("Control+s"); await page.waitForSelector("text=Saved", { timeout: 15000 });
  await shot("editor-edited");
  // regenerate slide 3
  await page.locator("aside >> nth=0 >> .slide-frame").nth(2).click(); await page.click("button:has-text('Regenerate slide')"); await page.waitForSelector("text=Regenerating…", { timeout: 15000 }); await page.waitForSelector("text=Regenerating…", { state: "detached", timeout: 60000 }); await page.waitForSelector("text=Slides regenerated.", { timeout: 30000 });
  // change style for slide 4 only
  await page.locator("aside >> nth=0 >> .slide-frame").nth(3).click(); await page.click("button:has-text('Change concept')"); await page.selectOption(".card select.select", { label: "Luxury" }); await page.click("button[role='switch']"); await page.click("button:has-text('Apply concept')"); await page.waitForSelector("text=Regenerating…", { timeout: 15000 }); await page.waitForSelector("text=Regenerating…", { state: "detached", timeout: 60000 }); await page.waitForTimeout(500); await shot("editor-restyled-slide");

  step("amends chat (editor, per slide)");
  await page.locator("aside >> nth=0 >> .slide-frame").nth(3).click();
  await page.click("button:has-text('Amends chat')");
  await page.fill("textarea[placeholder='Amend this slide…']", "make the heading bigger and gold");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=Applying: heading", { timeout: 60000 }); await page.waitForTimeout(800); await shot("editor-amends");
  await page.click("button:has-text('Undo')"); await page.waitForSelector("text=undone", { timeout: 30000 });
  step("amends tab (per-slide threads + whole deck)");
  await page.goto(`${presUrl}?tab=amends`); await page.waitForSelector("text=Write amends for this slide");
  await page.locator("text=Write amends for this slide").nth(1).click();
  await page.fill("textarea[placeholder='Amend this slide…']", "خلفية داكنة"); await page.keyboard.press("Enter");
  await page.waitForSelector("text=تم تطبيق", { timeout: 60000 }); await page.waitForTimeout(800); await shot("amends-tab");
  const amendCount = await prisma.amend.count({ where: { presentationId: presId } }); console.log("  amend messages stored:", amendCount);

  step("fonts: upload + select in a style");
  await page.goto(`${BASE}/settings`); await page.click("button:has-text('Upload font')");
  await page.setInputFiles("input[type=file][accept='.ttf,.otf,.woff,.woff2']", "public/fonts/Cairo-Bold.ttf");
  await page.fill("div.fixed input.input >> nth=0", "Brand Sans"); await page.click("div.fixed label:has-text('Supports Arabic')"); await page.locator("div.fixed button.btn-primary").click();
  await page.waitForSelector("text=Brand Sans", { timeout: 30000 }); await shot("settings-fonts");
  await page.goto(`${BASE}/styles/new`); await page.waitForSelector("text=Fonts");
  const headingFontSelect = page.locator("select.select").filter({ hasText: "Brand Sans" }).first(); await headingFontSelect.selectOption("Brand Sans");
  await page.fill("input.input >> nth=0", "Portrait Test Style"); await page.selectOption("select.select >> nth=0", "playful"); // tone
  await page.click("button:has-text('Create concept')"); await page.waitForURL(/\/styles\/(?!new)[a-z0-9]+$/); await shot("style-created");
  const createdStyle = await prisma.visualStyle.findFirst({ where: { name: "Portrait Test Style" } }); console.log("  style fonts:", (createdStyle?.spec as { fonts: { heading: string } })?.fonts.heading, "tone:", createdStyle?.tone);

  step("vertical presentation with style picker");
  await page.goto(`${BASE}/presentations/new`);
  await page.fill("input.input >> nth=0", "Vertical Story Deck"); await page.fill("textarea.textarea", CONTENT); await page.waitForSelector("text=blocks ·");
  await page.locator("button.card:has-text('Portrait Test Style')").click();
  await page.click("button:has-text('More details')"); await page.click("button:has-text('Vertical')");
  await page.locator("div:has(> label:has-text('Tone')) select").first().selectOption("fun");
  await page.click("button:has-text('Generate presentation')"); await page.waitForURL(/\/presentations\/[a-z0-9]+\?tab=concept/);
  const vUrl = page.url().split("?")[0];
  await page.waitForSelector("a:has-text('Open slides')", { timeout: 120000 });
  await page.goto(`${vUrl}/editor`); await page.waitForSelector("text=Slide 1 /"); await page.waitForTimeout(1500); await shot("vertical-editor");
  const vSlides = await prisma.slide.findMany({ where: { presentation: { name: "Vertical Story Deck" } }, select: { width: true, height: true } }); console.log("  vertical slides:", vSlides.length, "size:", vSlides[0]?.width + "x" + vSlides[0]?.height);
  await page.goto(`${vUrl}?tab=export`); await page.click("button:has-text('Check & export')"); await page.waitForSelector("a:has-text('.pdf')", { timeout: 180000 });
  const vJob = await prisma.exportJob.findFirst({ where: { presentation: { name: "Vertical Story Deck" } }, orderBy: { createdAt: "desc" } }); console.log("  vertical export:", vJob?.status, "verified:", vJob?.verified);

  step("export");
  await page.goto(`${presUrl}?tab=export`); await page.goto(`${presUrl}?tab=export`); await page.waitForSelector("text=Content integrity"); await shot("export-tab");
  await page.click("button:has-text('Check & export')"); await page.waitForSelector("a:has-text('.pptx')", { timeout: 180000 }); await page.waitForSelector("a:has-text('.pdf')", { timeout: 180000 }); await shot("export-done");
  for (const ext of ["pptx", "pdf"]) { const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`a:has-text('.${ext}')`)]); const to = path.join(OUT, `download.${ext}`); await dl.saveAs(to); console.log(`  downloaded ${ext}: ${(await fs.stat(to)).size} bytes`); }
  const exportJob = await prisma.exportJob.findFirst({ where: { presentationId: presId }, orderBy: { createdAt: "desc" }, include: { files: true } });
  console.log("  export:", exportJob?.status, "verified:", exportJob?.verified, "warnings:", (exportJob?.warnings as string[]).length, "files:", exportJob?.files.map((f) => f.format));

  step("images ON path (no key → explicit failure, no simulation)"); await page.goto(`${presUrl}?tab=concept`);
  await page.locator("button[role='switch']").nth(1).click(); // AI images ON
  await page.locator("button[role='switch']").nth(0).click(); // direct mode
  await page.click("button:has-text('Regenerate with this concept')"); await page.waitForSelector("a:has-text('Open slides')", { timeout: 120000 });
  await page.goto(`${presUrl}?tab=images`); await page.waitForSelector("text=Nano Banana Pro setup required"); await page.waitForTimeout(2500); await shot("images-tab");
  const imgs = await prisma.generatedImage.findMany({ where: { presentationId: presId } });
  console.log("  image requests:", imgs.length, "statuses:", [...new Set(imgs.map((i) => i.status))], "error sample:", imgs[0]?.error?.slice(0, 80));

  step("duplicate + list"); await page.goto(`${BASE}/presentations`); await shot("presentations-list");
  await page.goto(`${BASE}/styles`); await page.waitForSelector("text=Cinematic"); await shot("concepts");
  await page.goto(`${BASE}/history`); await shot("history"); await page.goto(`${BASE}/settings`); await shot("settings");
  } catch (e) { await page.screenshot({ path: path.join(OUT, "FAILURE.png") }); console.log("panel:", (await page.locator("body").innerText()).slice(0, 1500)); throw e; }
  await browser.close();
  console.log("DONE", shots.length, "screenshots");
}
main().catch(async (e) => { console.error("E2E FAILED:", e); try { const { chromium } = await import("playwright-core"); void chromium; } catch {} process.exit(1); }).finally(() => prisma.$disconnect());
