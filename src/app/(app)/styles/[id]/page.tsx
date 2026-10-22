import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StyleForm } from "@/components/styles/StyleForm";
import { normalizeSpec } from "@/lib/styles/spec";
export default async function StylePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const s = await prisma.visualStyle.findFirst({ where: { id, OR: [{ userId: user.id }, { isBuiltIn: true }] }, include: { references: { include: { asset: true } }, companyLinks: { include: { company: { select: { id: true, name: true } } } } } });
  if (!s) notFound();
  return <div className="space-y-6"><div><h1 className="h1">{s.name}</h1><p className="muted text-sm mt-1">{s.isBuiltIn ? "Built-in concept" : "Custom concept"}{s.companyLinks.length ? ` · used for ${s.companyLinks.map((l) => l.company.name).join(", ")}` : ""}</p></div>
    <StyleForm id={s.id} isBuiltIn={s.isBuiltIn} references={s.references} initial={{ name: s.name, description: s.description || "", tone: s.tone || "", voice: s.voice || "", spec: normalizeSpec(s.spec), composition: s.composition || "", layoutRules: s.layoutRules || "", typography: s.typography || "", imageTreatment: s.imageTreatment || "", backgroundTreatment: s.backgroundTreatment || "", colorBehavior: s.colorBehavior || "", lighting: s.lighting || "", density: s.density || "", decorative: s.decorative || "", negative: s.negative || "" }} /></div>;
}
