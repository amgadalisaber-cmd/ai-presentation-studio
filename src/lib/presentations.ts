import { prisma } from "./db";
import { ownCompany } from "./api";
import { detectPresentationLanguage, parseContent } from "./content/parser";
import { Prisma } from "@prisma/client";
import type { PresentationInput } from "@/app/api/presentations/schema";

export async function syncRelations(userId: string, presentationId: string, body: Partial<PresentationInput>) {
  if (body.participants) {
    for (const p of body.participants) await ownCompany(userId, p.companyId);
    await prisma.presentationParticipant.deleteMany({ where: { presentationId } });
    const seen = new Set<string>();
    for (const [i, p] of body.participants.entries()) { if (seen.has(p.companyId)) continue; seen.add(p.companyId); await prisma.presentationParticipant.create({ data: { presentationId, companyId: p.companyId, role: p.role, roleLabel: p.roleLabel, instructions: p.instructions, order: i } }); }
  }
  for (const [section, list] of [["presented_by", body.presentedBy], ["presented_to", body.presentedTo]] as const) {
    if (!list) continue;
    for (const e of list) if (e.companyId) await ownCompany(userId, e.companyId);
    await prisma.presentationCompany.deleteMany({ where: { presentationId, section } });
    for (const [i, e] of list.entries()) if (e.companyId || e.customName) await prisma.presentationCompany.create({ data: { presentationId, section, companyId: e.companyId || null, customName: e.customName || null, title: e.title, contactName: e.contactName, department: e.department, logoAssetId: e.logoAssetId || null, showLogo: e.showLogo ?? true, order: i } });
  }
}

export async function replaceContent(presentationId: string, content: string) {
  const blocks = parseContent(content);
  await prisma.$transaction(async (tx) => {
    await tx.slide.deleteMany({ where: { presentationId } });
    await tx.styleProposal.deleteMany({ where: { presentationId } });
    await tx.generatedImage.deleteMany({ where: { presentationId } });
    await tx.contentBlock.deleteMany({ where: { presentationId } });
    if (blocks.length) await tx.contentBlock.createMany({ data: blocks.map((b) => ({ ...b, presentationId })) });
    await tx.presentation.update({ where: { id: presentationId }, data: { sourceContent: content, languageDetected: detectPresentationLanguage(content), integrityStatus: "unverified", integrityReport: Prisma.JsonNull, status: "draft" } });
  });
  return blocks.length;
}

