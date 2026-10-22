import { chromium, type Browser } from "playwright-core";
import fs from "fs";

const CANDIDATES = [process.env.CHROMIUM_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/snap/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean) as string[];

/** Serverless hosts (Vercel, AWS Lambda) have no system Chromium: use the @sparticuz/chromium build instead. */
export const SERVERLESS_CHROMIUM = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.CHROMIUM_MODE === "serverless";

export function chromiumPath() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch { /* not installed */ }
  if (SERVERLESS_CHROMIUM) return "@sparticuz/chromium (serverless build)";
  return null;
}

const g = globalThis as unknown as { __browser?: Promise<Browser>; __browserSource?: string };
/** Which Chromium was launched last ("local:<path>" or "serverless:@sparticuz/chromium"). */
export function browserSource() { return g.__browserSource || null; }
export async function getBrowser(): Promise<Browser> {
  if (!g.__browser) {
    g.__browser = (async () => {
      const local = CANDIDATES.find((c) => fs.existsSync(c)) || (() => { try { const p = chromium.executablePath(); return p && fs.existsSync(p) ? p : null; } catch { return null; } })();
      if (local && !(SERVERLESS_CHROMIUM && process.env.CHROMIUM_MODE === "serverless")) { g.__browserSource = `local:${local}`; return chromium.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] }); }
      if (SERVERLESS_CHROMIUM) {
        g.__browserSource = "serverless:@sparticuz/chromium";
        const sparticuz = (await import("@sparticuz/chromium")).default;
        const executablePath = await sparticuz.executablePath();
        return chromium.launch({ executablePath, headless: true, args: [...sparticuz.args, "--font-render-hinting=none"] });
      }
      throw new Error("Chromium not found. Install Chrome/Chromium on the server and set CHROMIUM_PATH to its binary (or run `npx playwright install chromium` and set PLAYWRIGHT_BROWSERS_PATH). PDF export and render validation need it.");
    })();
    g.__browser.catch(() => { g.__browser = undefined; });
  }
  const b = await g.__browser;
  if (!b.isConnected()) { g.__browser = undefined; return getBrowser(); }
  return b;
}
