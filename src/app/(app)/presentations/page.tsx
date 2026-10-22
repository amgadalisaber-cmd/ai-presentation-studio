import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui";
import { PresentationActions } from "@/components/presentation/PresentationActions";
import { fmtDate } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function PresentationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireUser(); const sp = await searchParams;
  const list = await prisma.presentation.findMany({ where: { userId: user.id, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" } } : {}), ...(sp.status ? { status: sp.status } : {}) }, orderBy: { updatedAt: "desc" }, include: { style: { select: { name: true } }, participants: { include: { company: { select: { name: true } } } }, _count: { select: { slides: true, exportJobs: true } } } });
  const statuses = ["draft", "processing", "awaiting_review", "completed", "exporting", "ready", "failed"];
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><h1 className="h1">Presentations</h1><Link href="/presentations/new" className="btn-primary"><Plus size={16} /> New presentation</Link></div>
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Search presentations…" className="input max-w-sm" /><select name="status" defaultValue={sp.status || ""} className="select w-48"><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select><button className="btn-secondary">Filter</button></form>
      <div className="card overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-ink-800 text-left text-xs uppercase tracking-wider text-ink-400"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Clients</th><th className="px-4 py-2.5">Style</th><th className="px-4 py-2.5">Slides</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Updated</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody className="divide-y divide-ink-700">{list.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-400">No presentations found.</td></tr>}
            {list.map((p) => <tr key={p.id} className="hover:bg-ink-800/60"><td className="px-4 py-2.5"><Link href={`/presentations/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link></td><td className="px-4 py-2.5 text-ink-300">{p.type === "Custom" && p.customType ? p.customType : p.type}</td><td className="px-4 py-2.5 text-ink-300">{p.participants.map((x) => x.company.name).join(", ") || "—"}</td><td className="px-4 py-2.5 text-ink-300">{p.style?.name || "—"}</td><td className="px-4 py-2.5 text-ink-300">{p._count.slides}</td><td className="px-4 py-2.5"><StatusBadge status={p.status} /></td><td className="px-4 py-2.5 text-ink-400 text-xs">{fmtDate(p.updatedAt)}</td><td className="px-4 py-2.5"><PresentationActions id={p.id} name={p.name} compact /></td></tr>)}
          </tbody></table>
      </div>
    </div>
  );
}
