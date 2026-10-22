/* Content extraction (PDF, PPTX, image OCR) and brand extraction (logo colors, guideline text, website). */
import fs from "fs";
import { extractText } from "../src/lib/content/extract";
import { buildKit, kitFromText } from "../src/lib/brand/extract";
(async () => {
  const pdf = fs.readFileSync("tests/out/browser/download.pdf"); const r1 = await extractText(pdf, "deck.pdf", "application/pdf");
  console.log("PDF:", r1.method, r1.text.length, "chars |", r1.text.replace(/\s+/g, " ").slice(0, 90));
  const pptx = fs.readFileSync("tests/out/browser/download.pptx"); const r2 = await extractText(pptx, "deck.pptx", "");
  console.log("PPTX:", r2.method, r2.text.length, "chars |", r2.text.replace(/\s+/g, " ").slice(0, 90));
  const img = fs.readFileSync("tests/out/theme-export.png"); const t = Date.now(); const r3 = await extractText(img, "screen.png", "image/png");
  console.log("IMAGE OCR:", r3.method, r3.text.length, "chars in", Date.now() - t, "ms |", r3.text.replace(/\s+/g, " ").slice(0, 90));
  if (!/Content integrity|Export/i.test(r3.text)) throw new Error("OCR did not recognise expected text");
  const guide = "Brand Guidelines\n\nPrimary colour: Midnight #0E1B2E. Secondary: Gold #C9A85C. Accent rgb(37, 99, 235).\nTypography: Montserrat for headlines, Open Sans for body copy. Arabic typeface: Cairo.\nLogo clear space: always keep clear space equal to the height of the mark on all sides. Do not place the logo on busy photography. Never stretch or recolour the logo.";
  const k = kitFromText(guide, "guide.txt");
  console.log("TEXT KIT: colors", k.colors!.map((c) => `${c.hex}${c.name ? `(${c.name})` : ""}`).join(","), "| fonts", JSON.stringify(k.fonts), "| rules", k.rules!.length);
  if (k.colors!.length < 3 || k.fonts!.heading !== "Montserrat" || k.fonts!.arabicHeading !== "Cairo" || k.rules!.length < 2) throw new Error("text kit extraction incomplete");
  const logo = fs.readFileSync("tests/fixtures/logo.png");
  const kit = await buildKit([{ name: "logo.png", mime: "image/png", data: logo }, { name: "guide.txt", mime: "text/plain", data: Buffer.from(guide) }], "https://example.com");
  console.log("FULL KIT: logos", kit.logos.length, "| colors", kit.colors.map((c) => `${c.hex}:${c.role || "-"}`).join(","), "| site name:", kit.name, "| notes:", kit.notes.length);
  if (!kit.logos.length || !kit.colors.some((c) => c.source.startsWith("logo"))) throw new Error("logo colors missing");
  console.log("EXTRACT TEST PASSED");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
