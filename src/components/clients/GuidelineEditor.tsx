"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { Toggle } from "@/components/ui";
const CATS: [string, string][] = [["logo_placement", "Logo placement"], ["logo_proportions", "Logo proportions"], ["clear_space", "Clear space"], ["color_usage", "Color usage"], ["typography", "Typography"], ["image_treatment", "Image treatment"], ["composition", "Composition"], ["restrictions", "Visual restrictions"], ["dos_donts", "Do's and don'ts"], ["other", "Other"]];
export function GuidelineEditor({ companyId, guidelines }: { companyId: string; guidelines: { id: string; category: string; rule: string; approved: boolean }[] }) {
  const router = useRouter(); const [cat, setCat] = useState("logo_placement"); const [rule, setRule] = useState("");
  const add = async () => { if (!rule.trim()) return; await api(`/api/companies/${companyId}/guidelines`, { method: "POST", json: { category: cat, rule } }); setRule(""); router.refresh(); };
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><select className="select w-52" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><input className="input" placeholder="e.g. Keep clear space equal to the logo's x-height on all sides." value={rule} onChange={(e) => setRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /><button className="btn-primary btn-sm" onClick={add}><Plus size={14} /> Add rule</button></div>
      <div className="divide-y divide-ink-700 card">{guidelines.length === 0 && <p className="p-3 text-sm text-ink-500">No brand rules yet. Rules are permanent brand guidelines, reused across projects (project-specific instructions live on each presentation).</p>}
        {guidelines.map((g) => <div key={g.id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="w-36 flex-none text-xs uppercase tracking-wider text-ink-500">{CATS.find((c) => c[0] === g.category)?.[1] || g.category}</span><span className={`flex-1 ${g.approved ? "" : "line-through text-ink-500"}`}>{g.rule}</span><Toggle on={g.approved} onChange={(b) => api(`/api/guidelines/${g.id}`, { method: "PATCH", json: { approved: b } }).then(() => router.refresh())} /><button className="btn-ghost btn-sm" onClick={() => api(`/api/guidelines/${g.id}`, { method: "DELETE" }).then(() => router.refresh())}><Trash2 size={13} /></button></div>)}
      </div>
    </div>
  );
}
