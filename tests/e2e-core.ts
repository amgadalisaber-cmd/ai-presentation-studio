/* End-to-end core test: parse -> generate -> verify -> export (pptx + pdf), without the HTTP layer. */
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import { parseContent, detectPresentationLanguage } from "../src/lib/content/parser";
import { runFullGeneration, loadSlides, runIntegrityCheck } from "../src/lib/generation/service";
import { makeDataResolver } from "../src/lib/jobs/runner";
import { renderDeck } from "../src/lib/export/pdf";
import { buildPptx } from "../src/lib/export/pptx";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

const EN = `Growth Strategy 2027

Executive Summary

Our regional expansion delivered 42% revenue growth in 2026, driven by three new markets and a refreshed product line. This plan sets out how we consolidate those gains and prepare the next phase of growth.

Key Objectives

- Enter two additional GCC markets by Q3 2027
- Increase recurring revenue share to 65%
- Launch the HALFLENS creator platform with 25 partner studios
- Reduce customer acquisition cost by 18%

Market Context

Demand for premium visual content continues to accelerate across the region. Brands are shifting budgets from traditional media to performance-driven creative, and agencies that combine strategy with production capability are winning disproportionate share. Our positioning at the intersection of cinematic craft and data-informed strategy is a durable advantage, but it requires continued investment in talent, tooling and partnerships.

Investment Required

1. Production infrastructure: $1.2M
2. Talent acquisition: $800K
3. Market entry and partnerships: $650K`;

const AR = `استراتيجية النمو ٢٠٢٧

الملخص التنفيذي

حقق التوسع الإقليمي نموًا في الإيرادات بنسبة ٤٢٪ خلال عام ٢٠٢٦، مدفوعًا بثلاثة أسواق جديدة وخط منتجات محدّث. تحدد هذه الخطة كيفية ترسيخ تلك المكاسب والاستعداد للمرحلة التالية من النمو.

الأهداف الرئيسية

- دخول سوقين إضافيين في دول مجلس التعاون الخليجي بحلول الربع الثالث من ٢٠٢٧
- زيادة حصة الإيرادات المتكررة إلى ٦٥٪
- إطلاق منصة HALFLENS للمبدعين مع ٢٥ استوديو شريك
- خفض تكلفة اكتساب العملاء بنسبة ١٨٪

سياق السوق

يستمر الطلب على المحتوى البصري المتميز في التسارع عبر المنطقة. تحوّل العلامات التجارية ميزانياتها من الإعلام التقليدي إلى الإبداع القائم على الأداء، والوكالات التي تجمع بين الاستراتيجية والقدرة الإنتاجية تحقق حصة أكبر. موقعنا عند تقاطع الحرفية السينمائية والاستراتيجية المبنية على البيانات ميزة دائمة، لكنه يتطلب استثمارًا مستمرًا في المواهب والأدوات والشراكات.`;

async function main() {
  let user = await prisma.user.findFirst({ where: { email: "test@studio.local" } });
  if (!user) user = await prisma.user.create({ data: { email: "test@studio.local", name: "Test", passwordHash: await hashPassword("test1234") } });
  const styles = await prisma.visualStyle.findMany({ where: { isBuiltIn: true } });
  const halflens = await prisma.company.upsert({ where: { id: "test-halflens" }, update: {}, create: { id: "test-halflens", userId: user.id, name: "HALFLENS", isClient: true, colors: [{ name: "Ink", hex: "#0f0f12", role: "primary" }, { name: "Gold", hex: "#e8c66b", role: "accent" }] } });
  const client = await prisma.company.upsert({ where: { id: "test-client" }, update: {}, create: { id: "test-client", userId: user.id, name: "Client Company A", isClient: true, colors: [{ hex: "#1d4ed8", role: "primary" }] } });
  const gov = await prisma.company.upsert({ where: { id: "test-gov" }, update: {}, create: { id: "test-gov", userId: user.id, name: "Government Entity", isClient: false } });

  const results: Record<string, unknown> = {};
  for (const [label, content, lang] of [["en", EN, "en"], ["ar", AR, "ar"], ["mixed", EN + "\n\n" + AR, "ar-en"]] as const) {
    for (const styleKey of ["Cinematic", "Bold Editorial", "Corporate Premium"]) {
      const style = styles.find((s) => s.name === styleKey)!;
      await prisma.presentation.deleteMany({ where: { name: `Test ${label} ${styleKey}` } });
      const p = await prisma.presentation.create({ data: { userId: user.id, name: `Test ${label} ${styleKey}`, type: "Business Proposal", language: lang, sourceContent: content, styleId: style.id, aiImages: false, metadata: { date: "October 2026", version: "v1.0", confidentiality: "Confidential" } } });
      const blocks = parseContent(content);
      await prisma.contentBlock.createMany({ data: blocks.map((b) => ({ ...b, presentationId: p.id })) });
      await prisma.presentationParticipant.createMany({ data: [{ presentationId: p.id, companyId: client.id, role: "primary" }, { presentationId: p.id, companyId: halflens.id, role: "partner", order: 1 }] });
      await prisma.presentationCompany.createMany({ data: [
        { presentationId: p.id, section: "presented_by", companyId: halflens.id, order: 0 }, { presentationId: p.id, section: "presented_by", customName: "Partner Agency", order: 1 },
        { presentationId: p.id, section: "presented_to", companyId: client.id, order: 0 }, { presentationId: p.id, section: "presented_to", companyId: gov.id, contactName: "Procurement Department", order: 1 }] });
      const logs: string[] = [];
      const r = await runFullGeneration(p.id, style.id, async (m) => { logs.push(m); });
      const report = await runIntegrityCheck(p.id);
      const slides = await loadSlides(p.id);
      const resolver = await makeDataResolver();
      const { validation, pdf } = await renderDeck(slides, (s) => s, p.name, { pdf: label === "mixed" || styleKey === "Cinematic" });
      let pptxSize = 0;
      if (label === "mixed" || styleKey === "Cinematic") { const { buffer, warnings } = await buildPptx(slides, resolver, p.name); pptxSize = buffer.length; await fs.mkdir("tests/out", { recursive: true }); await fs.writeFile(`tests/out/${label}-${styleKey.replace(/\s/g, "")}.pptx`, buffer); if (pdf) await fs.writeFile(`tests/out/${label}-${styleKey.replace(/\s/g, "")}.pdf`, pdf); results[`${label}/${styleKey}/pptxWarnings`] = warnings.slice(0, 3); }
      results[`${label}/${styleKey}`] = { slides: r.slideCount, blocks: blocks.length, integrityOk: report.ok, matched: `${report.matchedBlocks}/${report.totalBlocks}`, issues: report.issues.filter((i) => i.severity === "error").map((i) => i.message).slice(0, 3), overflows: validation.overflows.length, overflowDetail: validation.overflows.slice(0, 3), pptxBytes: pptxSize, pdfBytes: pdf?.length || 0, detected: detectPresentationLanguage(content) };
    }
  }
  console.log(JSON.stringify(results, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); const { getBrowser } = await import("../src/lib/export/browser"); try { (await getBrowser()).close(); } catch {} });
