"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Alert, Field } from "@/components/ui";
import { FontSelect } from "@/components/FontSelect";

export interface ClientValue { name: string; legalName: string; isClient: boolean; industry: string; description: string; website: string; positioning: string; personality: string; targetAudience: string; colors: { name?: string; hex: string; role?: string }[]; typography: { headingFont?: string; bodyFont?: string; arabicHeadingFont?: string; arabicBodyFont?: string; notes?: string } }
export const emptyClient: ClientValue = { name: "", legalName: "", isClient: true, industry: "", description: "", website: "", positioning: "", personality: "", targetAudience: "", colors: [], typography: {} };

/** Brand profile: name, website, one optional note, colors, fonts. Logos and rules live in their own tabs. */
export function ClientForm({ initial, id }: { initial: ClientValue; id?: string }) {
  const router = useRouter(); const [v, setV] = useState(initial); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  const set = <K extends keyof ClientValue>(k: K, val: ClientValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try { if (!v.name.trim()) throw new Error("Name is required"); if (id) { await api(`/api/companies/${id}`, { method: "PATCH", json: v }); setSaved(true); router.refresh(); } else { const c = await api<{ id: string }>("/api/companies", { method: "POST", json: v }); router.push(`/clients/${c.id}`); router.refresh(); } }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card-pad space-y-5">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Brand name *"><input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Website"><input className="input" value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="brand-website.com" /></Field>
      </div>
      <Field label="About this brand (optional)" hint="Anything useful in one place: what they do, how they want to look, things to avoid."><textarea className="textarea min-h-[90px]" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Premium coffee roaster in Riyadh. Warm, minimal look. Never use red." /></Field>
      <div>
        <label className="label">Colors</label>
        <div className="flex flex-wrap items-center gap-2">
          {v.colors.map((c, i) => (
            <div key={i} className="card flex items-center gap-2 px-2 py-1.5">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
              <input className="input w-24 py-1" value={c.hex} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
              <select className="select w-32 py-1" value={c.role || ""} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}><option value="">use…</option><option value="primary">Main</option><option value="secondary">Second</option><option value="accent">Accent</option><option value="background">Background</option><option value="text">Text</option></select>
              <button className="btn-ghost btn-sm" onClick={() => set("colors", v.colors.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn-secondary btn-sm" onClick={() => set("colors", [...v.colors, { hex: "#2563eb", role: v.colors.length ? "" : "primary" }])}>Add color</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Heading font"><FontSelect value={v.typography.headingFont || ""} onChange={(f) => set("typography", { ...v.typography, headingFont: f })} /></Field>
        <Field label="Body font"><FontSelect value={v.typography.bodyFont || ""} onChange={(f) => set("typography", { ...v.typography, bodyFont: f })} /></Field>
        <Field label="Arabic heading"><FontSelect arabic value={v.typography.arabicHeadingFont || ""} onChange={(f) => set("typography", { ...v.typography, arabicHeadingFont: f })} /></Field>
        <Field label="Arabic body"><FontSelect arabic value={v.typography.arabicBodyFont || ""} onChange={(f) => set("typography", { ...v.typography, arabicBodyFont: f })} /></Field>
      </div>
      <div className="flex items-center justify-end gap-3">{saved && <span className="text-xs text-emerald-600">Saved</span>}<button className="btn-primary" disabled={busy} onClick={save}>{id ? "Save" : "Create brand"}</button></div>
    </div>
  );
}
