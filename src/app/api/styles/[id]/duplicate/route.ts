import { handler, ownStyle } from "@/lib/api";
import { prisma } from "@/lib/db";
export const POST = handler<{ id: string }>(async (_req, { id }, userId) => {
  const s = await ownStyle(userId, id);
  const refs = await prisma.styleReference.findMany({ where: { styleId: id } });
  const copy = await prisma.visualStyle.create({ data: { userId, isBuiltIn: false, name: `${s.name} (copy)`, description: s.description, spec: s.spec as object, composition: s.composition, layoutRules: s.layoutRules, typography: s.typography, imageTreatment: s.imageTreatment, backgroundTreatment: s.backgroundTreatment, colorBehavior: s.colorBehavior, lighting: s.lighting, density: s.density, decorative: s.decorative, negative: s.negative } });
  for (const r of refs) await prisma.styleReference.create({ data: { styleId: copy.id, assetId: r.assetId, url: r.url, note: r.note } });
  return copy;
});
