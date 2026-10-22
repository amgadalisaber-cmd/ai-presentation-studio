import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
export default async function HistoryPage() {
  const user = await requireUser();
  const [gen, exp, img] = await Promise.all([
    prisma.generationJob.findMany({ where: { presentation: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 60, include: { presentation: { select: { id: true, name: true } } } }),
    prisma.exportJob.findMany({ where: { presentation: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 60, include: { presentation: { select: { id: true, name: true } }, files: true } }),
    prisma.generatedImage.findMany({ where: { presentation: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 60, include: { presentation: { select: { id: true, name: true } } } }),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="h1">Generation History</h1>
      <section><h2 className="section-title mb-2">Generation jobs</h2><div className="card divide-y divide-ink-700">{gen.length === 0 && <p className="p-4 text-sm text-ink-500">None yet.</p>}{gen.map((j) => <div key={j.id} className="px-4 py-2.5 text-sm"><div className="flex items-center justify-between"><span><Link href={`/presentations/${j.presentation.id}`} className="hover:text-accent">{j.presentation.name}</Link><span className="ml-2 text-xs text-ink-500">{j.kind}</span></span><span className="flex items-center gap-2 text-xs text-ink-500"><StatusBadge status={j.status} />{fmtDate(j.createdAt)}</span></div>{j.error && <p className="text-xs text-red-300 mt-1">{j.error}</p>}{(j.result as { logs?: string[] } | null)?.logs && <p className="text-xs text-ink-500 mt-1">{(j.result as { logs?: string[] }).logs!.join(" · ")}</p>}</div>)}</div></section>
      <section><h2 className="section-title mb-2">Exports</h2><div className="card divide-y divide-ink-700">{exp.length === 0 && <p className="p-4 text-sm text-ink-500">None yet.</p>}{exp.map((j) => <div key={j.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span><Link href={`/presentations/${j.presentation.id}?tab=export`} className="hover:text-accent">{j.presentation.name}</Link><span className="ml-2 text-xs text-ink-500">{(j.formats as string[]).join(" + ").toUpperCase()}</span>{j.status === "completed" && <span className={`ml-2 ${j.verified ? "badge-verified" : "badge-issues"}`}>{j.verified ? "verified" : "not verified"}</span>}</span><span className="flex items-center gap-2 text-xs">{j.files.map((f) => <a key={f.id} href={`/api/files/export/${f.id}`} className="text-accent">{f.format.toUpperCase()}</a>)}<StatusBadge status={j.status} /><span className="text-ink-500">{fmtDate(j.createdAt)}</span></span></div>)}</div></section>
      <section><h2 className="section-title mb-2">Image generation</h2><div className="card divide-y divide-ink-700">{img.length === 0 && <p className="p-4 text-sm text-ink-500">None yet.</p>}{img.map((i) => <div key={i.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"><span className="min-w-0"><Link href={`/presentations/${i.presentation.id}?tab=images`} className="hover:text-accent">{i.presentation.name}</Link><span className="ml-2 text-xs text-ink-500 truncate">{i.concept?.slice(0, 80)}</span>{i.error && <span className="block text-xs text-red-300">{i.error}</span>}</span><span className="flex items-center gap-2 text-xs text-ink-500 whitespace-nowrap"><StatusBadge status={i.status} />{i.attempts} attempt(s) · {fmtDate(i.createdAt)}</span></div>)}</div></section>
    </div>
  );
}
