/* Portrait orientation: generation, integrity, render validation, PDF + PPTX page size. */
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import { parseContent } from "../src/lib/content/parser";
import { runFullGeneration, loadSlides, runIntegrityCheck } from "../src/lib/generation/service";
import { makeDataResolver } from "../src/lib/jobs/runner";
import { renderDeck } from "../src/lib/export/pdf";
import { buildPptx } from "../src/lib/export/pptx";
import { hashPassword } from "../src/lib/auth";
const prisma = new PrismaClient();
const CONTENT = `Growth Strategy 2027\n\nExecutive Summary\n\nOur regional expansion delivered 42% revenue growth in 2026, driven by three new markets and a refreshed product line. This plan sets out how we consolidate those gains and prepare the next phase of growth.\n\nKey Objectives\n\n- Enter two additional GCC markets by Q3 2027\n- Increase recurring revenue share to 65%\n- Launch the HALFLENS creator platform with 25 partner studios\n- Reduce customer acquisition cost by 18%\n\nالرؤية\n\nنطمح إلى أن نكون الشريك الإبداعي الأول للعلامات التجارية الطموحة في المنطقة.`;
async function main() {
  let user = await prisma.user.findFirst(); if (!user) user = await prisma.user.create({ data: { email: "p@studio.local", name: "P", passwordHash: await hashPassword("test1234") } });
  const hl = await prisma.company.findFirst({ where: { name: "HALFLENS" } }) || await prisma.company.create({ data: { userId: user.id, name: "HALFLENS", colors: [{ hex: "#0f0f12", role: "primary" }] } });
  for (const [styleName, tone] of [["Corporate Premium", "fun"], ["Bold Editorial", undefined], ["Cinematic", "calm"]] as const) {
    const style = await prisma.visualStyle.findFirstOrThrow({ where: { name: styleName } });
    const name = `Test portrait ${styleName}`; await prisma.presentation.deleteMany({ where: { name } });
    const p = await prisma.presentation.create({ data: { userId: user.id, name, type: "Pitch Deck", language: "ar-en", orientation: "portrait", sourceContent: CONTENT, styleId: style.id, metadata: { date: "2026", confidentiality: "Confidential", tone } } });
    await prisma.contentBlock.createMany({ data: parseContent(CONTENT).map((b) => ({ ...b, presentationId: p.id })) });
    await prisma.presentationParticipant.create({ data: { presentationId: p.id, companyId: hl.id, role: "primary" } });
    await prisma.presentationCompany.createMany({ data: [{ presentationId: p.id, section: "presented_by", companyId: hl.id }, { presentationId: p.id, section: "presented_to", customName: "Client Company A" }, { presentationId: p.id, section: "presented_to", customName: "Government Entity", order: 1 }] });
    const r = await runFullGeneration(p.id, style.id, async () => {});
    const slides = await loadSlides(p.id); const rep = await runIntegrityCheck(p.id);
    const resolver = await makeDataResolver();
    const { validation, pdf } = await renderDeck(slides, (s) => s, name, { pdf: true });
    const { buffer } = await buildPptx(slides, resolver, name);
    await fs.mkdir("tests/out", { recursive: true }); await fs.writeFile(`tests/out/portrait-${styleName.replace(/\s/g, "")}.pdf`, pdf!); await fs.writeFile(`tests/out/portrait-${styleName.replace(/\s/g, "")}.pptx`, buffer);
    console.log(`${styleName} (tone ${tone || "default"}): slides=${r.slideCount} size=${slides[0].w}x${slides[0].h} integrity=${rep.ok} overflows=${validation.overflows.length} ${JSON.stringify(validation.overflows.slice(0, 2))} pdf=${pdf!.length}B pptx=${buffer.length}B`);
    if (slides[0].w !== 1080 || !rep.ok) throw new Error("portrait generation failed");
  }
  console.log("PORTRAIT TEST PASSED");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); const { getBrowser } = await import("../src/lib/export/browser"); try { (await getBrowser()).close(); } catch {} });
