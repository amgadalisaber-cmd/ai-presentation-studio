import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); const BASE = "http://localhost:3000";
(async () => {
  const p = await prisma.presentation.findFirstOrThrow({ where: { name: "HALFLENS Brand Strategy 2027" }, orderBy: { createdAt: "desc" } });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] }); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`); await page.screenshot({ path: "tests/out/theme-login.png" });
  await page.fill('input[type="email"]', "designer@halflens.studio"); await page.fill('input[type="password"]', "studio-pass-123"); await page.click("button:has-text('Sign in')"); await page.waitForURL(`${BASE}/`); await page.waitForTimeout(800); await page.screenshot({ path: "tests/out/theme-dashboard.png" });
  await page.goto(`${BASE}/presentations/new`); await page.waitForTimeout(1200); await page.screenshot({ path: "tests/out/theme-setup.png" });
  await page.goto(`${BASE}/presentations/${p.id}?tab=generate`); await page.waitForTimeout(1200); await page.screenshot({ path: "tests/out/theme-generate.png" });
  await page.goto(`${BASE}/presentations/${p.id}/editor`); await page.waitForSelector("text=Slide 1 /"); await page.waitForTimeout(1200); await page.click("button:has-text('Amends chat')"); await page.waitForTimeout(500); await page.screenshot({ path: "tests/out/theme-editor.png" });
  await page.goto(`${BASE}/presentations/${p.id}?tab=export`); await page.waitForTimeout(1000); await page.screenshot({ path: "tests/out/theme-export.png" });
  await page.goto(`${BASE}/styles`); await page.waitForTimeout(1500); await page.screenshot({ path: "tests/out/theme-styles.png" });
  await b.close(); await prisma.$disconnect(); console.log("shots ok");
})();
