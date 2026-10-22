import { handler, logHistory, ownPresentation } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
export const POST = handler<{ id: string }>(async (_req, { id }, userId) => {
  const src = await ownPresentation(userId, id);
  const full = await prisma.presentation.findUniqueOrThrow({ where: { id }, include: { participants: true, companies: true, blocks: true, slides: { include: { elements: true }, orderBy: { index: "asc" } } } });
  const copy = await prisma.presentation.create({ data: { userId, name: `${src.name} (copy)`, type: src.type, customType: src.customType, language: src.language, languageDetected: src.languageDetected, sourceContent: src.sourceContent, contentSource: src.contentSource, styleId: src.styleId, customDirection: src.customDirection, threeStyleMode: src.threeStyleMode, aiImages: src.aiImages, presentedByEnabled: src.presentedByEnabled, presentedToEnabled: src.presentedToEnabled, metadata: src.metadata as Prisma.InputJsonValue, projectNotes: src.projectNotes, status: full.slides.length ? "awaiting_review" : "draft" } });
  const blockMap = new Map<string, string>();
  for (const b of full.blocks) { const nb = await prisma.contentBlock.create({ data: { presentationId: copy.id, index: b.index, kind: b.kind, level: b.level, text: b.text, rawText: b.rawText, marker: b.marker, lang: b.lang, dir: b.dir, sectionIndex: b.sectionIndex } }); blockMap.set(b.id, nb.id); }
  for (const p of full.participants) await prisma.presentationParticipant.create({ data: { presentationId: copy.id, companyId: p.companyId, role: p.role, roleLabel: p.roleLabel, instructions: p.instructions, order: p.order } });
  for (const c of full.companies) await prisma.presentationCompany.create({ data: { presentationId: copy.id, section: c.section, companyId: c.companyId, customName: c.customName, title: c.title, contactName: c.contactName, department: c.department, logoAssetId: c.logoAssetId, showLogo: c.showLogo, order: c.order } });
  for (const s of full.slides) {
    const bg = { ...(s.background as object) } as Record<string, unknown>; delete bg.generatedImageId; // generated images are not duplicated
    const ns = await prisma.slide.create({ data: { presentationId: copy.id, index: s.index, layoutKey: s.layoutKey, purpose: s.purpose, background: bg as Prisma.InputJsonValue, styleId: s.styleId, notes: s.notes } });
    for (const e of s.elements) await prisma.slideElement.create({ data: { slideId: ns.id, type: e.type, origin: e.origin, x: e.x, y: e.y, w: e.w, h: e.h, z: e.z, rotation: e.rotation, props: e.props as Prisma.InputJsonValue, blockId: e.blockId ? blockMap.get(e.blockId) : null, fragmentIndex: e.fragmentIndex, fragmentCount: e.fragmentCount, assetId: e.assetId, generatedImageId: null } });
  }
  await logHistory(copy.id, "presentation.duplicated", { from: id });
  return copy;
});
