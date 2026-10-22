"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";
export function SettingsForm({ customTypes }: { customTypes: string[] }) {
  const router = useRouter(); const [types, setTypes] = useState(customTypes); const [val, setVal] = useState(""); const [saved, setSaved] = useState(false);
  const save = async (next: string[]) => { setTypes(next); await api("/api/settings", { method: "PATCH", json: { customTypes: next } }); setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh(); };
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">{types.map((t) => <span key={t} className="card flex items-center gap-2 px-3 py-1.5 text-sm">{t}<button className="text-ink-500 hover:text-red-300" onClick={() => save(types.filter((x) => x !== t))}><Trash2 size={12} /></button></span>)}{types.length === 0 && <span className="text-sm text-ink-500">No custom types.</span>}</div>
      <div className="flex gap-2"><input className="input max-w-sm" value={val} placeholder="e.g. Tender Response" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { save([...types, val.trim()]); setVal(""); } }} /><button className="btn-secondary" onClick={() => { if (val.trim()) { save([...types, val.trim()]); setVal(""); } }}>Add type</button>{saved && <span className="text-xs text-emerald-300 self-center">Saved</span>}</div>
    </div>
  );
}
