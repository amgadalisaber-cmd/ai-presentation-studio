import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Plus } from "lucide-react";
import { SlideView } from "@/components/slide/SlideView";
import { previewSlides } from "@/lib/styles/preview";
import { normalizeSpec } from "@/lib/styles/spec";
export default async function StylesPage() {
  const user = await requireUser();
  const list = await prisma.visualStyle.findMany({ where: { OR: [{ userId: user.id }, { isBuiltIn: true }] }, orderBy: [{ isBuiltIn: "desc" }, { updatedAt: "desc" }], include: { _count: { select: { presentations: true, companyLinks: true } } } });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="h1">Visual Styles</h1><p className="muted text-sm mt-1">Reusable art directions, independent of any client. Duplicate a built-in style to customise it, or create one from scratch.</p></div><Link href="/styles/new" className="btn-primary"><Plus size={16} /> New style</Link></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((s) => { const slides = previewSlides(normalizeSpec(s.spec), s.name); return (
        <Link key={s.id} href={`/styles/${s.id}`} className="card overflow-hidden hover:border-ink-500">
          <div className="grid grid-cols-2 gap-px bg-ink-700">{slides.slice(0, 4).map((sl, i) => <SlideView key={i} slide={sl} />)}</div>
          <div className="p-3"><div className="flex items-center justify-between"><span className="font-medium">{s.name}</span>{s.isBuiltIn ? <span className="badge-draft">built-in</span> : <span className="badge-completed">custom</span>}</div><p className="mt-1 text-xs text-ink-400 line-clamp-2">{s.description}</p><p className="mt-1 text-xs text-ink-500">{s._count.presentations} presentations · {s._count.companyLinks} clients</p></div>
        </Link>); })}</div>
    </div>
  );
}
