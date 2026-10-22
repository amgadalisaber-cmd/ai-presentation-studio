import { chromium, type Browser } from "playwright-core";
import fs from "fs";

const CANDIDATES = [process.env.CHROMIUM_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/snap/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean) as string[];

export function chromiumPath() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  // Fall back to whatever playwright-core resolves (PLAYWRIGHT_BROWSERS_PATH / `npx playwright install chromium`)
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch { /* not installed */ }
  return null;
}

const g = globalThis as unknown as { __browser?: Promise<Browser> };
export async function getBrowser(): Promise<Browser> {
  if (!g.__browser) {
    const executablePath = chromiumPath();
    if (!executablePath) throw new Error("Chromium not found. Install Chrome/Chromium on the server and set CHROMIUM_PATH to its binary (or run `npx playwright install chromium` and set PLAYWRIGHT_BROWSERS_PATH). PDF export and render validation need it.");
    g.__browser = chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] });
    g.__browser.catch(() => { g.__browser = undefined; });
  }
  const b = await g.__browser;
  if (!b.isConnected()) { g.__browser = undefined; return getBrowser(); }
  return b;
}
