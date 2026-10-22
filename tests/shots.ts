import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); const BASE = "http://localhost:3000";
(async () => {
  const c = await prisma.company.findFirstOrThrow({ where: { name: "HALFLENS" }, orderBy: { createdAt: "desc" } });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] }); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`); await page.fill('input[type="email"]', "designer@halflens.studio"); await page.fill('input[type="password"]', "studio-pass-123"); await page.click("button:has-text('Sign in')"); await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/presentations/new`); await page.waitForTimeout(1500); await page.screenshot({ path: "tests/out/simple-new.png" });
  await page.goto(`${BASE}/clients/new`); await page.waitForTimeout(800); await page.screenshot({ path: "tests/out/simple-new-brand.png" });
  await page.goto(`${BASE}/clients/${c.id}`); await page.waitForTimeout(1200); await page.screenshot({ path: "tests/out/simple-brand.png" });
  await page.goto(`${BASE}/`); await page.waitForTimeout(800); await page.screenshot({ path: "tests/out/simple-home.png" });
  await b.close(); await prisma.$disconnect(); console.log("shots ok");
})();
