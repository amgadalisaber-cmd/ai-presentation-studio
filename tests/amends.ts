/* Amends: natural-language revisions per slide → operations → applied → undo. */
import { PrismaClient } from "@prisma/client";
import { parseContent } from "../src/lib/content/parser";
import { runFullGeneration, loadSlides, runIntegrityCheck } from "../src/lib/generation/service";
import { submitAmend, undoAmend } from "../src/lib/amends/service";
import { hashPassword } from "../src/lib/auth";
import type { TextProps } from "../src/lib/types";
const prisma = new PrismaClient();
const CONTENT = `Growth Plan\n\nSummary\n\nWe grew 42% in 2026 across three markets. The plan consolidates those gains.\n\nObjectives\n\n- Enter two new markets\n- Increase recurring revenue to 65%\n- Launch the creator platform\n\nالرؤية\n\nنطمح إلى أن نكون الشريك الإبداعي الأول في المنطقة.`;
async function main() {
  let user = await prisma.user.findFirst(); if (!user) user = await prisma.user.create({ data: { email: "amend@studio.local", name: "A", passwordHash: await hashPassword("test1234") } });
  const style = await prisma.visualStyle.findFirstOrThrow({ where: { name: "Modern Minimal" } });
  await prisma.presentation.deleteMany({ where: { name: "Test amends" } });
  const p = await prisma.presentation.create({ data: { userId: user.id, name: "Test amends", type: "Business Proposal", language: "ar-en", sourceContent: CONTENT, styleId: style.id } });
  await prisma.contentBlock.createMany({ data: parseContent(CONTENT).map((b) => ({ ...b, presentationId: p.id })) });
  await runFullGeneration(p.id, style.id, async () => {});
  let slides = await loadSlides(p.id);
  const content = slides.find((s) => s.purpose === "content")!;
  const headingBefore = content.elements.find((e) => e.type === "text" && (e.props as TextProps).role === "h2")!;
  const tests: [string, (s: typeof slides[number]) => boolean][] = [
    ["make the heading bigger and gold", (s) => { const h = s.elements.find((e) => e.id === headingBefore.id)!; return (h.props as TextProps).fontSize > (headingBefore.props as TextProps).fontSize && (h.props as TextProps).color === "#c9a85c"; }],
    ["dark background", (s) => ["#0b0b0e", "#111111"].includes(s.background.color || "")],
    ["move the heading down a bit", (s) => s.elements.find((e) => e.id === headingBefore.id)!.y > headingBefore.y],
    ["كبّر النص", (s) => s.elements.some((e) => e.type === "text" && (e.props as TextProps).role === "body" && (e.props as TextProps).fontSize > 28)],
    ['change the heading to "Executive Summary"', (s) => (s.elements.find((e) => e.id === headingBefore.id)!.props as TextProps).text === "Executive Summary"],
  ];
  for (const [msg, check] of tests) {
    const r = await submitAmend(p.id, content.id!, msg, user.id);
    slides = await loadSlides(p.id); const s = slides.find((x) => x.id === content.id)!;
    console.log(`"${msg}" → ${r.status} | ${check(s) ? "OK" : "CHECK FAILED"} | ${r.message.split("\n")[0].slice(0, 90)}`);
    if (!check(s)) throw new Error(`Amend check failed for: ${msg}`);
  }
  let rep = await runIntegrityCheck(p.id); console.log("integrity after authorized wording change:", rep.ok, rep.matchedBlocks + "/" + rep.totalBlocks);
  if (!rep.ok) throw new Error("integrity should pass after an authorized wording change");
  // unclear
  const u = await submitAmend(p.id, content.id!, "hmm maybe something nicer?", user.id); console.log("unclear →", u.status);
  // structural: split + regenerate in another style
  const listSlide = slides.find((s) => s.purpose === "list")!;
  const sp = await submitAmend(p.id, listSlide.id!, "this is too crowded, split it into two slides", user.id);
  slides = await loadSlides(p.id); console.log("split →", sp.status, "slides now", slides.length);
  const rg = await submitAmend(p.id, slides[2].id!, "regenerate this slide in Cinematic style", user.id);
  slides = await loadSlides(p.id); console.log("regenerate →", rg.status, "| slide 3 style:", (await prisma.visualStyle.findUnique({ where: { id: slides[2].styleId! } }))?.name);
  rep = await runIntegrityCheck(p.id); console.log("integrity after structural amends:", rep.ok);
  if (!rep.ok) throw new Error("integrity failed after structural amends: " + JSON.stringify(rep.issues.filter((i) => i.severity === "error").slice(0, 2)));
  // whole presentation + undo
  const all = await submitAmend(p.id, null, "all text white", user.id); console.log("whole deck →", all.status);
  const un = await undoAmend(all.id); console.log("undo →", un.status);
  slides = await loadSlides(p.id);
  const whites = slides.flatMap((s) => s.elements).filter((e) => e.type === "text" && (e.props as TextProps).color === "#ffffff").length;
  console.log("white text elements after undo:", whites);
  rep = await runIntegrityCheck(p.id); if (!rep.ok) throw new Error("integrity failed after undo");
  console.log("AMENDS TEST PASSED");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
