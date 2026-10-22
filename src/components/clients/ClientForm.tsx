"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Alert, Field, Toggle } from "@/components/ui";

export interface ClientValue { name: string; legalName: string; isClient: boolean; industry: string; description: string; website: string; positioning: string; personality: string; targetAudience: string; colors: { name?: string; hex: string; role?: string }[]; typography: { headingFont?: string; bodyFont?: string; arabicHeadingFont?: string; arabicBodyFont?: string; notes?: string } }
export const emptyClient: ClientValue = { name: "", legalName: "", isClient: true, industry: "", description: "", website: "", positioning: "", personality: "", targetAudience: "", colors: [], typography: {} };

export function ClientForm({ initial, id }: { initial: ClientValue; id?: string }) {
  const router = useRouter(); const [v, setV] = useState(initial); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = <K extends keyof ClientValue>(k: K, val: ClientValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const save = async () => {
    setBusy(true); setError(null);
    try { if (!v.name.trim()) throw new Error("Name is required"); if (id) { await api(`/api/companies/${id}`, { method: "PATCH", json: v }); router.refresh(); } else { const c = await api<{ id: string }>("/api/companies", { method: "POST", json: v }); router.push(`/clients/${c.id}`); router.refresh(); } }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Client / brand name *"><input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Company (legal) name"><input className="input" value={v.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
        <Field label="Industry"><input className="input" value={v.industry} onChange={(e) => set("industry", e.target.value)} /></Field>
        <Field label="Website"><input className="input" value={v.website} onChange={(e) => set("website", e.target.value)} /></Field>
      </div>
      <Toggle on={v.isClient} onChange={(b) => set("isClient", b)} label="Client brand profile" description="On: appears in client selection with its brand assets. Off: a plain company used in Presented By / To only." />
      <Field label="Description"><textarea className="textarea" value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Brand positioning"><textarea className="textarea min-h-[80px]" value={v.positioning} onChange={(e) => set("positioning", e.target.value)} /></Field>
        <Field label="Brand personality"><textarea className="textarea min-h-[80px]" value={v.personality} onChange={(e) => set("personality", e.target.value)} /></Field>
        <Field label="Target audience"><textarea className="textarea min-h-[80px]" value={v.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} /></Field>
      </div>
      <div>
        <label className="label">Brand colors (HEX)</label>
        <div className="space-y-2">{v.colors.map((c, i) => <div key={i} className="flex items-center gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} /><input className="input w-32" value={c.hex} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} placeholder="#000000" /><input className="input" value={c.name || ""} placeholder="Name" onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><select className="select w-40" value={c.role || ""} onChange={(e) => set("colors", v.colors.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}><option value="">role…</option><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="accent">Accent</option><option value="background">Background</option><option value="text">Text</option></select><button className="btn-ghost btn-sm" onClick={() => set("colors", v.colors.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>)}
          <button className="btn-secondary btn-sm" onClick={() => set("colors", [...v.colors, { hex: "#000000", role: v.colors.length ? "" : "primary" }])}>Add color</button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Heading font (Latin)" hint="Font name as installed on viewers' machines; bundled: Inter, Cairo."><input className="input" value={v.typography.headingFont || ""} onChange={(e) => set("typography", { ...v.typography, headingFont: e.target.value })} /></Field>
        <Field label="Body font (Latin)"><input className="input" value={v.typography.bodyFont || ""} onChange={(e) => set("typography", { ...v.typography, bodyFont: e.target.value })} /></Field>
        <Field label="Arabic heading font"><input className="input" value={v.typography.arabicHeadingFont || ""} onChange={(e) => set("typography", { ...v.typography, arabicHeadingFont: e.target.value })} /></Field>
        <Field label="Arabic body font"><input className="input" value={v.typography.arabicBodyFont || ""} onChange={(e) => set("typography", { ...v.typography, arabicBodyFont: e.target.value })} /></Field>
      </div>
      <Field label="Typography notes"><textarea className="textarea min-h-[60px]" value={v.typography.notes || ""} onChange={(e) => set("typography", { ...v.typography, notes: e.target.value })} /></Field>
      <div className="flex justify-end"><button className="btn-primary" disabled={busy} onClick={save}>{id ? "Save profile" : "Create profile"}</button></div>
    </div>
  );
}
