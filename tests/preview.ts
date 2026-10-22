/* Screenshots slides of a presentation (by name) to tests/out/preview-*.png for visual inspection. */
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import { loadSlides } from "../src/lib/generation/service";
import { makeDataResolver } from "../src/lib/jobs/runner";
import { renderDeckDocument } from "../src/lib/render/html";
import { embeddedFontCss } from "../src/lib/render/fonts";
import { getBrowser } from "../src/lib/export/browser";
const prisma = new PrismaClient();
async function main() {
  const name = process.argv[2]; const max = Number(process.argv[3] || 6);
  const p = await prisma.presentation.findFirstOrThrow({ where: { name } });
  const slides = await loadSlides(p.id);
  const resolver = await makeDataResolver(); const map = new Map<string, string>();
  for (const s of slides) for (const src of [s.background.imageSrc, ...s.elements.map((e) => (e.props as { src?: string }).src)]) if (src && !map.has(src)) { const r = await resolver(src); if (r) map.set(src, r.data); }
  const html = renderDeckDocument(slides.slice(0, max), (s) => (s ? map.get(s) : undefined), await embeddedFontCss(), p.name);
  const b = await getBrowser(); const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent(html, { waitUntil: "load" }); await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await fs.mkdir("tests/out", { recursive: true });
  const els = await page.$$(".slide");
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `tests/out/preview-${name.replace(/\s+/g, "_")}-${i + 1}.png`, type: "jpeg", quality: 70 } as never);
  await page.close(); await b.close();
  console.log(`wrote ${els.length} previews`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
