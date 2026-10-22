/* Long content → overflow handling (extra slides, sentence-level fragments), per-slide regeneration keeps integrity. */
import { PrismaClient } from "@prisma/client";
import { parseContent } from "../src/lib/content/parser";
import { runFullGeneration, runRegenerateSlides, runIntegrityCheck, loadSlides } from "../src/lib/generation/service";
import { hashPassword } from "../src/lib/auth";
const prisma = new PrismaClient();
const para = (i: number) => `Paragraph ${i}. ` + "The studio combines cinematic craft with data-informed strategy to deliver work that performs across markets, channels and audiences without compromising on detail. ".repeat(16);
const CONTENT = `Long Form Report\n\nIntroduction\n\n${para(1)}\n\n${para(2)}\n\nFindings\n\n${Array.from({ length: 9 }, (_, i) => `- Finding ${i + 1}: adoption increased in segment ${i + 1} with measurable gains in retention and brand recall.`).join("\n")}\n\nDetailed Analysis\n\n${para(3)}\n\n${para(4)}\n\n${para(5)}`;
async function main() {
  let user = await prisma.user.findFirst(); if (!user) user = await prisma.user.create({ data: { email: "long@studio.local", name: "Long", passwordHash: await hashPassword("test1234") } });
  const style = await prisma.visualStyle.findFirstOrThrow({ where: { name: "Luxury" } }); // airy density → forces splitting
  await prisma.presentation.deleteMany({ where: { name: "Test long content" } });
  const p = await prisma.presentation.create({ data: { userId: user.id, name: "Test long content", type: "Performance Report", language: "en", sourceContent: CONTENT, styleId: style.id } });
  const blocks = parseContent(CONTENT); await prisma.contentBlock.createMany({ data: blocks.map((b) => ({ ...b, presentationId: p.id })) });
  const logs: string[] = [];
  const r = await runFullGeneration(p.id, style.id, async (m) => { logs.push(m); });
  let slides = await loadSlides(p.id);
  const fragmented = slides.flatMap((s) => s.elements).filter((e) => (e.fragmentCount || 1) > 1);
  const report1 = await runIntegrityCheck(p.id);
  console.log(`blocks=${blocks.length} slides=${r.slideCount} fragmentedElements=${fragmented.length} integrity=${report1.ok} (${report1.matchedBlocks}/${report1.totalBlocks})`);
  if (r.slideCount < 6) throw new Error("Expected long content to produce additional slides");
  if (!report1.ok) throw new Error("Integrity failed after generation: " + JSON.stringify(report1.issues.slice(0, 3)));
  // regenerate the slide that holds a fragment, in another style
  const target = slides.find((s) => s.elements.some((e) => (e.fragmentCount || 1) > 1))!;
  const other = await prisma.visualStyle.findFirstOrThrow({ where: { name: "Swiss International" } });
  await runRegenerateSlides(p.id, [target.id!], other.id, async (m) => { logs.push(m); });
  slides = await loadSlides(p.id);
  const report2 = await runIntegrityCheck(p.id);
  const untouched = slides.filter((s) => s.id !== target.id && s.styleId === style.id).length;
  console.log(`after per-slide regeneration: slides=${slides.length} integrity=${report2.ok} untouchedSlidesKeptStyle=${untouched} logs=${logs.slice(-1)[0]}`);
  if (!report2.ok) throw new Error("Integrity failed after per-slide regeneration: " + JSON.stringify(report2.issues.filter((i) => i.severity === "error").slice(0, 3)));
  console.log("LONG CONTENT TEST PASSED");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
