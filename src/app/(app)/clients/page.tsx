import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Plus } from "lucide-react";
export default async function ClientsPage() {
  const user = await requireUser();
  const list = await prisma.company.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { assets: { where: { kind: "primary_logo", approved: true }, take: 1 }, _count: { select: { assets: true, guidelines: true, participants: true, presentationCompanies: true, styleLinks: true } } } });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="h1">Brands</h1><p className="muted text-sm mt-1">Logos, colors, fonts and rules for each client or partner. Used automatically in any concept.</p></div><Link href="/clients/new" className="btn-primary"><Plus size={16} /> New brand</Link></div>
      {list.length === 0 ? <div className="card border-dashed p-10 text-center text-sm text-ink-400">No brands yet. Add one with its logo and colors.</div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((c) => { const colors = (c.colors as { hex: string }[]) || []; return (
          <Link key={c.id} href={`/clients/${c.id}`} className="card p-4 flex gap-4 hover:border-ink-500">
            <div className="h-16 w-16 flex-none rounded bg-white/90 flex items-center justify-center overflow-hidden">{c.assets[0] ? <img src={`/api/files/asset/${c.assets[0].id}`} alt="" className="max-h-full max-w-full object-contain p-1" /> : <span className="text-xl font-semibold text-ink-700">{c.name.slice(0, 2).toUpperCase()}</span>}</div>
            <div className="min-w-0 flex-1"><div className="font-medium truncate">{c.name}{!c.isClient && <span className="ml-2 text-[10px] uppercase text-ink-500">company</span>}</div><div className="text-xs text-ink-500 truncate">{c.industry || "—"}</div><div className="mt-2 flex gap-1">{colors.slice(0, 6).map((col, i) => <span key={i} className="h-4 w-4 rounded-sm border border-ink-600" style={{ background: col.hex }} />)}</div><div className="mt-2 text-xs text-ink-500">{c._count.assets} assets · {c._count.guidelines} rules · {c._count.styleLinks} styles · {c._count.participants + c._count.presentationCompanies} presentations</div></div>
          </Link>); })}</div>
      )}
    </div>
  );
}
