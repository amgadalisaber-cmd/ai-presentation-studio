"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/client";

export interface CompanyLite { id: string; name: string; isClient: boolean; industry?: string | null; assets?: { id: string; kind: string; name: string }[] }

/** Searchable company picker with inline creation. */
export function CompanySelect({ onPick, placeholder = "Search companies…", exclude = [], clientsOnly = false, allowCreate = true }: { onPick: (c: CompanyLite) => void; placeholder?: string; exclude?: string[]; clientsOnly?: boolean; allowCreate?: boolean }) {
  const [q, setQ] = useState(""); const [list, setList] = useState<CompanyLite[]>([]); const [open, setOpen] = useState(false); const [creating, setCreating] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => { const r = await api<CompanyLite[]>(`/api/companies?q=${encodeURIComponent(q)}${clientsOnly ? "&clients=1" : ""}`); if (alive) setList(r); }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [q, clientsOnly, open]);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const create = async () => {
    if (!q.trim()) return; setCreating(true);
    try { const c = await api<CompanyLite>("/api/companies", { method: "POST", json: { name: q.trim(), isClient: clientsOnly } }); onPick(c); setQ(""); setOpen(false); } finally { setCreating(false); }
  };
  const visible = list.filter((c) => !exclude.includes(c.id));
  return (
    <div ref={box} className="relative">
      <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-8" value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} /></div>
      {open && (
        <div className="absolute z-30 mt-1 w-full card max-h-64 overflow-auto p-1 text-sm">
          {visible.map((c) => <button key={c.id} type="button" className="nav-link w-full justify-between" onClick={() => { onPick(c); setQ(""); setOpen(false); }}><span>{c.name}</span><span className="text-xs text-ink-500">{c.isClient ? "client" : "company"}{c.industry ? ` · ${c.industry}` : ""}</span></button>)}
          {visible.length === 0 && <div className="px-3 py-2 text-ink-500">No matches.</div>}
          {allowCreate && q.trim() && !visible.some((c) => c.name.toLowerCase() === q.trim().toLowerCase()) && <button type="button" disabled={creating} className="nav-link w-full text-accent" onClick={create}><Plus size={14} /> Create “{q.trim()}”</button>}
        </div>
      )}
    </div>
  );
}
