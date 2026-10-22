import { chromium, type Browser } from "playwright-core";
import fs from "fs";

const CANDIDATES = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].filter(Boolean) as string[];

export function chromiumPath() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  // Fall back to whatever playwright-core resolves (PLAYWRIGHT_BROWSERS_PATH)
  try { return chromium.executablePath(); } catch { return null; }
}

const g = globalThis as unknown as { __browser?: Promise<Browser> };
export async function getBrowser(): Promise<Browser> {
  if (!g.__browser) {
    const executablePath = chromiumPath();
    if (!executablePath) throw new Error("Chromium not found. Set CHROMIUM_PATH to a Chromium/Chrome binary.");
    g.__browser = chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] });
    g.__browser.catch(() => { g.__browser = undefined; });
  }
  const b = await g.__browser;
  if (!b.isConnected()) { g.__browser = undefined; return getBrowser(); }
  return b;
}
