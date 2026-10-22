import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui";
import { PresentationActions } from "@/components/presentation/PresentationActions";
import { PresentationSetup, type SetupValue } from "@/components/presentation/PresentationSetup";
import { GeneratePanel } from "@/components/presentation/GeneratePanel";
import { ImagesPanel } from "@/components/presentation/ImagesPanel";
import { ExportPanel } from "@/components/presentation/ExportPanel";
import { AmendsTab } from "@/components/presentation/AmendsTab";
import { IntegrityView } from "@/components/presentation/IntegrityView";
import type { IntegrityReport } from "@/lib/content/verify";
import type { SlideModel } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { LayoutTemplate } from "lucide-react";

const TABS = ["concept", "amends", "export", "details", "images", "history"] as const;
const TAB_LABEL: Record<string, string> = { concept: "Concept", amends: "Amends", export: "Export", details: "Details", images: "AI images", history: "History" };

export default async function PresentationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(); const { id } = await params; const { tab: rawTab } = await searchParams;
  const legacy: Record<string, string> = { generate: "concept", setup: "details", overview: "concept" };
  const mapped = legacy[rawTab || ""] || rawTab || "";
  const tab = (TABS as readonly string[]).includes(mapped) ? (mapped as typeof TABS[number]) : "concept";
  const p = await prisma.presentation.findFirst({ where: { id, userId: user.id }, include: { style: true, participants: { include: { company: true }, orderBy: { order: "asc" } }, companies: { include: { company: { include: { assets: { where: { kind: { contains: "logo" } } } } } }, orderBy: { order: "asc" } }, proposals: { include: { style: true }, orderBy: { order: "asc" } }, generationJobs: { orderBy: { createdAt: "desc" }, take: 5 }, history: { orderBy: { createdAt: "desc" }, take: 40 }, _count: { select: { blocks: true, slides: true, generatedImages: true } } } });
  if (!p) notFound();
  const styles = await prisma.visualStyle.findMany({ where: { OR: [{ userId: user.id }, { isBuiltIn: true }] }, orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }], select: { id: true, name: true, isBuiltIn: true, description: true, spec: true, tone: true } });
  const setting = await prisma.userSetting.findUnique({ where: { userId_key: { userId: user.id, key: "customTypes" } } });
  const md = (p.metadata || {}) as SetupValue["metadata"];
  const entry = (c: typeof p.companies[number]) => ({ companyId: c.companyId, name: c.customName || c.company?.name || "", customName: c.customName, title: c.title || "", contactName: c.contactName || "", department: c.department || "", logoAssetId: c.logoAssetId, showLogo: c.showLogo, logos: (c.company?.assets || []).map((a) => ({ id: a.id, name: a.name })) });
  const initial: SetupValue = { name: p.name, type: p.type, customType: p.customType || "", language: p.language as SetupValue["language"], orientation: p.orientation as SetupValue["orientation"], content: p.sourceContent, contentSource: p.contentSource as SetupValue["contentSource"], styleId: p.styleId, customDirection: p.customDirection || "", threeStyleMode: p.threeStyleMode, aiImages: p.aiImages, presentedByEnabled: p.presentedByEnabled, presentedToEnabled: p.presentedToEnabled, projectNotes: p.projectNotes || "", metadata: md, participants: p.participants.map((x) => ({ companyId: x.companyId, name: x.company.name, role: x.role as SetupValue["participants"][number]["role"], roleLabel: x.roleLabel || "", instructions: x.instructions || "" })), presentedBy: p.companies.filter((c) => c.section === "presented_by").map(entry), presentedTo: p.companies.filter((c) => c.section === "presented_to").map(entry) };
  const report = p.integrityReport as unknown as IntegrityReport | null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-3"><h1 className="h1">{p.name}</h1><StatusBadge status={p.status} /></div><p className="muted text-sm mt-1">{p.type === "Custom" && p.customType ? p.customType : p.type} · {{ ar: "Arabic", en: "English", "ar-en": "Arabic & English", other: "Other" }[p.language]} · {p.orientation === "portrait" ? "Vertical" : "Horizontal"} · {p._count.blocks} content blocks · {p._count.slides} slides{p.style ? ` · ${p.style.name}` : ""}</p></div>
        <div className="flex items-center gap-2">{p._count.slides > 0 && <Link href={`/presentations/${p.id}/editor`} className="btn-primary"><LayoutTemplate size={16} /> Open slides</Link>}<PresentationActions id={p.id} name={p.name} /></div>
      </div>
      <nav className="flex gap-1 border-b border-ink-700">{TABS.filter((t) => t !== "images" || p.aiImages).map((t) => <Link key={t} href={`/presentations/${p.id}?tab=${t}`} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-accent text-accent-dim" : "border-transparent text-ink-400 hover:text-ink-200"}`}>{TAB_LABEL[t]}</Link>)}{p._count.slides > 0 && <Link href={`/presentations/${p.id}/editor`} className="px-4 py-2 text-sm border-b-2 -mb-px border-transparent text-ink-400 hover:text-ink-200">Slides</Link>}</nav>
      {tab === "details" && <PresentationSetup initial={initial} presentationId={p.id} styles={styles} customTypes={(setting?.value as string[]) || []} hasSlides={p._count.slides > 0} />}
      {tab === "concept" && <GeneratePanel presentation={{ id: p.id, orientation: p.orientation as "landscape" | "portrait", tone: md.tone, styleId: p.styleId, threeStyleMode: p.threeStyleMode, aiImages: p.aiImages, status: p.status, blocks: p._count.blocks, slides: p._count.slides, customDirection: p.customDirection }} styles={styles} proposals={p.proposals.map((x) => ({ id: x.id, order: x.order, selected: x.selected, slides: x.slides as unknown as SlideModel[], style: { id: x.style.id, name: x.style.name, description: x.style.description } }))} jobs={p.generationJobs.map((j) => ({ id: j.id, kind: j.kind, status: j.status, error: j.error, result: j.result as { logs?: string[] } | null, createdAt: j.createdAt.toISOString() }))} />}
      {tab === "amends" && <AmendsTab presentationId={p.id} />}
      {tab === "images" && p.aiImages && <ImagesPanel presentationId={p.id} aiImages={p.aiImages} />}
      {tab === "export" && <ExportPanel presentationId={p.id} slides={p._count.slides} integrityReport={report} integrityStatus={p.integrityStatus} />}
      {tab === "history" && <div className="card divide-y divide-ink-700">{p.history.length === 0 && <p className="p-4 text-sm text-ink-500">No history yet.</p>}{p.history.map((h) => <div key={h.id} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><div><span className="font-medium">{h.action}</span>{h.details ? <pre className="mt-1 whitespace-pre-wrap text-xs text-ink-500">{JSON.stringify(h.details).slice(0, 300)}</pre> : null}</div><span className="text-xs text-ink-500 whitespace-nowrap">{fmtDate(h.createdAt)}</span></div>)}</div>}
    </div>
  );
}
