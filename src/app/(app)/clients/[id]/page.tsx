import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClientForm, type ClientValue } from "@/components/clients/ClientForm";
import { AssetManager } from "@/components/clients/AssetManager";
import { GuidelineEditor } from "@/components/clients/GuidelineEditor";
import { StyleLinks } from "@/components/clients/StyleLinks";
import { DeleteButton } from "@/components/DeleteButton";
import { StatusBadge } from "@/components/ui";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(); const { id } = await params; const { tab = "profile" } = await searchParams;
  const c = await prisma.company.findFirst({ where: { id, userId: user.id }, include: { assets: { orderBy: { createdAt: "desc" }, include: { company: { select: { id: true, name: true } } } }, guidelines: { orderBy: { createdAt: "asc" } }, styleLinks: { include: { style: { select: { id: true, name: true } } } }, participants: { include: { presentation: { select: { id: true, name: true, status: true, updatedAt: true } } } }, presentationCompanies: { include: { presentation: { select: { id: true, name: true, status: true } } } } } });
  if (!c) notFound();
  const styles = await prisma.visualStyle.findMany({ where: { OR: [{ userId: user.id }, { isBuiltIn: true }] }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const initial: ClientValue = { name: c.name, legalName: c.legalName || "", isClient: c.isClient, industry: c.industry || "", description: c.description || "", website: c.website || "", positioning: c.positioning || "", personality: c.personality || "", targetAudience: c.targetAudience || "", colors: (c.colors as ClientValue["colors"]) || [], typography: (c.typography as ClientValue["typography"]) || {} };
  const tabs = ["profile", "assets", "rules", "styles", "presentations"];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4"><div><h1 className="h1">{c.name}</h1><p className="muted text-sm mt-1">{c.isClient ? "Client brand profile" : "Company profile"}{c.industry ? ` · ${c.industry}` : ""}</p></div><DeleteButton url={`/api/companies/${c.id}`} label="Delete profile" confirmText={`Delete "${c.name}" and all its assets and rules?`} redirect="/clients" /></div>
      <nav className="flex gap-1 border-b border-ink-700">{tabs.map((t) => <Link key={t} href={`/clients/${c.id}?tab=${t}`} className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-accent" : "border-transparent text-ink-400 hover:text-ink-200"}`}>{t === "rules" ? "Brand rules" : t === "styles" ? "Visual directions" : t}</Link>)}</nav>
      {tab === "profile" && <div className="max-w-4xl"><ClientForm initial={initial} id={c.id} /></div>}
      {tab === "assets" && <AssetManager assets={c.assets.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))} companyId={c.id} />}
      {tab === "rules" && <GuidelineEditor companyId={c.id} guidelines={c.guidelines} />}
      {tab === "styles" && <div className="space-y-2"><p className="muted text-sm">Visual direction is independent of identity: link the directions you have used (or plan to use) for this client. The same brand identity applies to every one of them.</p><StyleLinks companyId={c.id} linked={c.styleLinks.map((l) => l.style)} all={styles} /></div>}
      {tab === "presentations" && <div className="card divide-y divide-ink-700">{c.participants.length + c.presentationCompanies.length === 0 && <p className="p-4 text-sm text-ink-500">Not used in any presentation yet.</p>}{c.participants.map((p) => <Link key={p.id} href={`/presentations/${p.presentation.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-ink-800"><span>{p.presentation.name}<span className="ml-2 text-xs text-ink-500">as {p.roleLabel || p.role}</span></span><StatusBadge status={p.presentation.status} /></Link>)}{c.presentationCompanies.map((p) => <Link key={p.id} href={`/presentations/${p.presentation.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-ink-800"><span>{p.presentation.name}<span className="ml-2 text-xs text-ink-500">{p.section === "presented_by" ? "presented by" : "presented to"}</span></span><StatusBadge status={p.presentation.status} /></Link>)}</div>}
    </div>
  );
}
