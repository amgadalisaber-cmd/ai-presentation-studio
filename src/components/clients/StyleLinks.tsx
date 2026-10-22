"use client";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api } from "@/lib/client";
import Link from "next/link";
export function StyleLinks({ companyId, linked, all }: { companyId: string; linked: { id: string; name: string }[]; all: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">{linked.map((s) => <span key={s.id} className="card flex items-center gap-2 px-3 py-1.5 text-sm"><Link href={`/styles/${s.id}`} className="hover:text-accent">{s.name}</Link><button className="text-ink-500 hover:text-red-300" onClick={() => api(`/api/companies/${companyId}/styles`, { method: "DELETE", json: { styleId: s.id } }).then(() => router.refresh())}><X size={12} /></button></span>)}{linked.length === 0 && <span className="text-sm text-ink-500">No saved directions for this client yet. Any style can still be used.</span>}</div>
      <select className="select w-72" value="" onChange={(e) => e.target.value && api(`/api/companies/${companyId}/styles`, { method: "POST", json: { styleId: e.target.value } }).then(() => router.refresh())}><option value="">Link a visual direction…</option>{all.filter((s) => !linked.some((l) => l.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    </div>
  );
}
