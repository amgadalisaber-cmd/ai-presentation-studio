import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui";
import { PresentationActions } from "@/components/presentation/PresentationActions";
import { fmtDate } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function Dashboard() {
  const user = await requireUser();
  const [recent, clients, styles, jobs, exportsJobs, counts] = await Promise.all([
    prisma.presentation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 8, include: { style: { select: { name: true } }, participants: { include: { company: { select: { name: true } } } }, _count: { select: { slides: true } } } }),
    prisma.company.findMany({ where: { userId: user.id, isClient: true }, orderBy: { updatedAt: "desc" }, take: 8, include: { _count: { select: { assets: true, participants: true } } } }),
    prisma.visualStyle.findMany({ where: { OR: [{ userId: user.id }, { isBuiltIn: true }] }, orderBy: [{ isBuiltIn: "asc" }, { updatedAt: "desc" }], take: 12 }),
    prisma.generationJob.findMany({ where: { presentation: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 6, include: { presentation: { select: { id: true, name: true } } } }),
    prisma.exportJob.findMany({ where: { presentation: { userId: user.id } }, orderBy: { createdAt: "desc" }, take: 4, include: { presentation: { select: { id: true, name: true } }, files: true } }),
    Promise.all([prisma.presentation.count({ where: { userId: user.id, status: "draft" } }), prisma.presentation.count({ where: { userId: user.id, status: { in: ["completed", "ready"] } } }), prisma.presentation.count({ where: { userId: user.id } })]),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between"><div><h1 className="h1">Dashboard</h1><p className="muted text-sm mt-1">{counts[2]} presentations · {counts[0]} drafts · {counts[1]} completed</p></div><Link href="/presentations/new" className="btn-primary"><Plus size={16} /> Create new presentation</Link></div>
      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="section-title">Recent presentations</h2><Link href="/presentations" className="text-xs text-accent">View all</Link></div>
        {recent.length === 0 ? <div className="card border-dashed p-8 text-center text-sm text-ink-400">No presentations yet. Create one to get started.</div> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recent.map((p) => (
              <div key={p.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2"><Link href={`/presentations/${p.id}`} className="font-medium hover:text-accent line-clamp-2">{p.name}</Link><StatusBadge status={p.status} /></div>
                <div className="text-xs text-ink-400">{p.type}{p.style ? ` · ${p.style.name}` : ""} · {p._count.slides} slides</div>
                <div className="text-xs text-ink-500 truncate">{p.participants.map((x) => x.company.name).join(", ") || "No clients"}</div>
                <div className="mt-auto flex items-center justify-between text-xs text-ink-500"><span>{fmtDate(p.updatedAt)}</span><PresentationActions id={p.id} name={p.name} compact /></div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="section-title">Saved clients & brands</h2><Link href="/clients" className="text-xs text-accent">Manage</Link></div>
          <div className="card divide-y divide-ink-700">{clients.length === 0 && <div className="p-4 text-sm text-ink-400">No client profiles yet.</div>}{clients.map((c) => <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-ink-800"><span>{c.name}<span className="ml-2 text-xs text-ink-500">{c.industry}</span></span><span className="text-xs text-ink-500">{c._count.assets} assets · {c._count.participants} presentations</span></Link>)}</div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="section-title">Saved visual styles</h2><Link href="/styles" className="text-xs text-accent">Manage</Link></div>
          <div className="flex flex-wrap gap-2">{styles.map((s) => { const spec = s.spec as { palette?: { background?: string; accent?: string; text?: string } }; return <Link key={s.id} href={`/styles/${s.id}`} className="card flex items-center gap-2 px-3 py-2 text-sm hover:border-ink-500"><span className="h-5 w-5 rounded border border-ink-600" style={{ background: `linear-gradient(135deg, ${spec.palette?.background || "#222"} 50%, ${spec.palette?.accent || "#888"} 50%)` }} />{s.name}{s.isBuiltIn && <span className="text-[10px] uppercase text-ink-500">built-in</span>}</Link>; })}</div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="section-title">Recent generation activity</h2><Link href="/history" className="text-xs text-accent">History</Link></div>
          <div className="card divide-y divide-ink-700">{jobs.length === 0 && <div className="p-4 text-sm text-ink-400">No generation jobs yet.</div>}{jobs.map((j) => <div key={j.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span><Link href={`/presentations/${j.presentation.id}`} className="hover:text-accent">{j.presentation.name}</Link><span className="ml-2 text-xs text-ink-500">{j.kind}</span></span><span className="flex items-center gap-2 text-xs text-ink-500"><StatusBadge status={j.status} />{fmtDate(j.createdAt)}</span></div>)}</div>
        </section>
        <section>
          <h2 className="section-title mb-3">Recent exports</h2>
          <div className="card divide-y divide-ink-700">{exportsJobs.length === 0 && <div className="p-4 text-sm text-ink-400">No exports yet.</div>}{exportsJobs.map((j) => <div key={j.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span><Link href={`/presentations/${j.presentation.id}`} className="hover:text-accent">{j.presentation.name}</Link><span className="ml-2 text-xs text-ink-500">{(j.formats as string[]).join(" + ").toUpperCase()}</span></span><span className="flex items-center gap-2">{j.files.map((f) => <a key={f.id} href={`/api/files/export/${f.id}`} className="text-xs text-accent">{f.format.toUpperCase()}</a>)}<StatusBadge status={j.status} /></span></div>)}</div>
        </section>
      </div>
    </div>
  );
}
