import { PrismaClient } from "@prisma/client";
import { loadSlides } from "../src/lib/generation/service";
import { renderDeck } from "../src/lib/export/pdf";
import { chromiumPath, getBrowser, browserSource } from "../src/lib/export/browser";
const prisma = new PrismaClient();
(async () => {
  const p = await prisma.presentation.findFirstOrThrow({ where: { name: "HALFLENS Brand Strategy 2027" }, orderBy: { createdAt: "desc" } });
  const slides = await loadSlides(p.id);
  console.log("chromiumPath:", chromiumPath());
  const t = Date.now();
  const { pdf, validation } = await renderDeck(slides, (s) => s, p.name, { pdf: true });
  console.log("launched:", browserSource(), "version:", await (await getBrowser()).version()); console.log(`serverless chromium PDF: ${pdf!.length} bytes, overflows=${validation.overflows.length}, ${Date.now() - t}ms`);
  (await getBrowser()).close(); await prisma.$disconnect();
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
