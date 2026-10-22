"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2, Upload, FileText, Download } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Alert, Field, Toggle, Modal } from "@/components/ui";
import { CompanySelect, type CompanyLite } from "./CompanySelect";
import { PRESENTATION_TYPES } from "@/lib/generation/types";
import { detectPresentationLanguage, parseContent } from "@/lib/content/parser";
import { StylePicker, type PickerStyle } from "@/components/styles/StylePicker";
import { TONES } from "@/lib/types";

export interface SetupValue {
  name: string; type: string; customType: string; language: "ar" | "en" | "ar-en" | "other"; orientation: "landscape" | "portrait"; content: string; contentSource: "paste" | "upload" | "import" | "saved";
  styleId: string | null; customDirection: string; threeStyleMode: boolean; aiImages: boolean; presentedByEnabled: boolean; presentedToEnabled: boolean; projectNotes: string;
  metadata: { date?: string; version?: string; preparedBy?: string; confidentiality?: string; projectName?: string; referenceNumber?: string; custom?: { label: string; value: string }[]; colorMode?: "auto" | "style" | "brand"; tone?: string; voice?: string };
  participants: { companyId: string; name: string; role: "primary" | "secondary" | "partner" | "sponsor" | "collaborator" | "other"; roleLabel?: string; instructions?: string }[];
  presentedBy: Entry[]; presentedTo: Entry[];
}
export interface Entry { companyId?: string | null; name: string; customName?: string | null; title?: string; contactName?: string; department?: string; logoAssetId?: string | null; showLogo: boolean; logos?: { id: string; name: string }[] }

export const emptySetup: SetupValue = { name: "", type: "Corporate Presentation", customType: "", language: "en", orientation: "landscape", content: "", contentSource: "paste", styleId: null, customDirection: "", threeStyleMode: false, aiImages: false, presentedByEnabled: true, presentedToEnabled: true, projectNotes: "", metadata: { colorMode: "auto" }, participants: [], presentedBy: [], presentedTo: [] };

const ROLES = ["primary", "secondary", "partner", "sponsor", "collaborator", "other"] as const;

export function PresentationSetup({ initial, presentationId, styles, customTypes, hasSlides }: { initial: SetupValue; presentationId?: string; styles: PickerStyle[]; customTypes: string[]; hasSlides?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<SetupValue>(initial);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [langAuto, setLangAuto] = useState(!presentationId);
  const [importOpen, setImportOpen] = useState(false); const [prev, setPrev] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const set = <K extends keyof SetupValue>(k: K, val: SetupValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const blocks = useMemo(() => (v.content.trim() ? parseContent(v.content) : []), [v.content]);
  const detected = useMemo(() => (v.content.trim() ? detectPresentationLanguage(v.content) : null), [v.content]);
  useEffect(() => { if (langAuto && detected) set("language", detected); }, [detected, langAuto]);
  const types = [...PRESENTATION_TYPES.filter((t) => t !== "Custom"), ...customTypes, "Custom"];

  const onUpload = async (file: File) => {
    setError(null);
    try { const r = await upload<{ text: string; warnings: string[] }>("/api/content/extract", { file }); set("content", r.text); set("contentSource", "upload"); setUploadWarnings(r.warnings); }
    catch (e) { setError((e as Error).message); }
  };
  const openImport = async () => { setPrev(await api("/api/presentations")); setImportOpen(true); };
  const importFrom = async (id: string) => { const p = await api<{ sourceContent: string }>(`/api/presentations/${id}`); set("content", p.sourceContent); set("contentSource", "import"); setImportOpen(false); };

  const save = async (next?: "generate") => {
    setBusy(true); setError(null);
    try {
      if (!v.name.trim()) throw new Error("Presentation name is required.");
      if (!v.type) throw new Error("Presentation type is required.");
      if (v.type === "Custom" && !v.customType.trim()) throw new Error("Enter the custom presentation type.");
      if (hasSlides && v.content !== initial.content && !confirm("Changing the content will discard the generated slides and require regeneration. Continue?")) { setBusy(false); return; }
      const payload = { ...v, customType: v.type === "Custom" ? v.customType : null, participants: v.participants.map(({ companyId, role, roleLabel, instructions }) => ({ companyId, role, roleLabel, instructions })), presentedBy: v.presentedBy.map(toEntry), presentedTo: v.presentedTo.map(toEntry) };
      let id = presentationId;
      if (id) await api(`/api/presentations/${id}`, { method: "PATCH", json: payload });
      else { const p = await api<{ id: string }>("/api/presentations", { method: "POST", json: payload }); id = p.id; }
      router.push(`/presentations/${id}${next === "generate" ? "?tab=generate" : ""}`); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {error && <Alert kind="error">{error}</Alert>}
      {/* A. Presentation information */}
      <section className="card-pad space-y-4">
        <h2 className="h2">A. Presentation information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Presentation name *"><input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Brand Strategy 2027" /></Field>
          <Field label="Presentation type *" hint="Influences structure and layout suggestions only; never changes your content."><div className="flex gap-2"><select className="select" value={v.type} onChange={(e) => set("type", e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select>{v.type === "Custom" && <input className="input" placeholder="Custom type" value={v.customType} onChange={(e) => set("customType", e.target.value)} />}</div></Field>
          <Field label="Presentation language" hint={detected ? `Detected: ${labelLang(detected)}${langAuto ? " (auto)" : " — manual override"}` : "Detected automatically from the content; you can override it."}>
            <select className="select" value={v.language} onChange={(e) => { setLangAuto(false); set("language", e.target.value as SetupValue["language"]); }}><option value="ar">Arabic</option><option value="en">English</option><option value="ar-en">Arabic and English</option><option value="other">Other</option></select>
          </Field>
          <Field label="Orientation" hint="Horizontal 16:9 (1920×1080) for screens; vertical 9:16 (1080×1920) for stories, mobile and print-like decks.">
            <div className="grid grid-cols-2 gap-2">{([["landscape", "Horizontal", "w-10 h-6"], ["portrait", "Vertical", "w-6 h-10"]] as const).map(([k, label, box]) => <button key={k} type="button" onClick={() => set("orientation", k)} className={`card flex items-center gap-3 px-3 py-2 text-sm hover:border-ink-500 ${v.orientation === k ? "border-accent ring-1 ring-accent/40" : ""}`}><span className={`${box} rounded-sm border-2 ${v.orientation === k ? "border-accent" : "border-ink-500"}`} />{label}</button>)}</div>
          </Field>
          <Field label="Content source"><select className="select" value={v.contentSource} onChange={(e) => set("contentSource", e.target.value as SetupValue["contentSource"])}><option value="paste">Paste content</option><option value="upload">Upload a document</option><option value="import">Import from a previous presentation</option><option value="saved">Use saved project content</option></select></Field>
        </div>
        <Field label="Presentation content" hint={`${blocks.length} content block${blocks.length === 1 ? "" : "s"} detected (headings, paragraphs, list items). Wording, numbers and punctuation are preserved exactly; markdown '#' headings and '-' bullets are recognised as structure.`}>
          <div className="flex flex-wrap gap-2 mb-2">
            <label className="btn-secondary btn-sm cursor-pointer"><Upload size={13} /> Upload .txt / .md / .docx<input type="file" className="hidden" accept=".txt,.md,.markdown,.docx" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>
            <button type="button" className="btn-secondary btn-sm" onClick={openImport}><Download size={13} /> Import from previous presentation</button>
            {presentationId && <span className="btn-ghost btn-sm text-ink-500"><FileText size={13} /> Saved project content is loaded</span>}
          </div>
          {uploadWarnings.length > 0 && <Alert kind="warn">{uploadWarnings.join(" ")}</Alert>}
          <textarea className="textarea min-h-[280px] font-[inherit]" dir="auto" value={v.content} onChange={(e) => { set("content", e.target.value); if (v.contentSource === "upload" || v.contentSource === "import") set("contentSource", "paste"); }} placeholder={"Paste the full presentation script here.\n\nUse blank lines between paragraphs. Short standalone lines become headings; lines starting with - or • become list items."} />
        </Field>
      </section>

      {/* B. Clients and brands */}
      <section className="card-pad space-y-4">
        <div><h2 className="h2">B. Client and brand selection</h2><p className="muted text-sm">Select every client, brand, partner or stakeholder involved. Each keeps its own brand profile; identities are never merged.</p></div>
        <CompanySelect clientsOnly placeholder="Search or create a client profile…" exclude={v.participants.map((p) => p.companyId)} onPick={(c) => set("participants", [...v.participants, { companyId: c.id, name: c.name, role: v.participants.length ? "secondary" : "primary" }])} />
        <div className="space-y-2">
          {v.participants.map((p, i) => (
            <div key={p.companyId} className="card p-3 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto] items-start">
              <div className="font-medium text-sm pt-2">{p.name}</div>
              <select className="select" value={p.role} onChange={(e) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, role: e.target.value as typeof p.role } : x)))}>{ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}{r === "primary" ? " client" : r === "secondary" ? " client" : ""}</option>)}</select>
              <div className="space-y-1">{p.role === "other" && <input className="input" placeholder="Role label" value={p.roleLabel || ""} onChange={(e) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, roleLabel: e.target.value } : x)))} />}<input className="input" placeholder="Project-specific instructions for this brand (optional)" value={p.instructions || ""} onChange={(e) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} /></div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => set("participants", v.participants.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          {v.participants.length === 0 && <p className="text-sm text-ink-500">No clients selected. You can still generate a presentation without a client profile.</p>}
        </div>
      </section>

      {/* C / D. Presented by / to */}
      <div className="grid gap-6 lg:grid-cols-2">
        <EntrySection title="C. Presented by" description="Who is presenting: agency, company, organization or individual. Not assumed to be the client." enabled={v.presentedByEnabled} onEnabled={(b) => set("presentedByEnabled", b)} entries={v.presentedBy} onChange={(e) => set("presentedBy", e)} contactFields={false} />
        <EntrySection title="D. Presented to" description="Who receives the presentation: client, audience, government entity, stakeholders." enabled={v.presentedToEnabled} onEnabled={(b) => set("presentedToEnabled", b)} entries={v.presentedTo} onChange={(e) => set("presentedTo", e)} contactFields />
      </div>

      {/* E. Metadata */}
      <section className="card-pad space-y-4">
        <div><h2 className="h2">E. Presentation metadata</h2><p className="muted text-sm">Optional. Only fields you fill in appear in the presentation.</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          {([["date", "Presentation date"], ["version", "Version number"], ["preparedBy", "Prepared by"], ["confidentiality", "Confidentiality label"], ["projectName", "Project name"], ["referenceNumber", "Reference number"]] as const).map(([k, label]) => <Field key={k} label={label}><input className="input" value={v.metadata[k] || ""} onChange={(e) => set("metadata", { ...v.metadata, [k]: e.target.value })} /></Field>)}
        </div>
        <div className="space-y-2">
          <label className="label">Custom metadata</label>
          {(v.metadata.custom || []).map((c, i) => <div key={i} className="flex gap-2"><input className="input" placeholder="Label" value={c.label} onChange={(e) => set("metadata", { ...v.metadata, custom: (v.metadata.custom || []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /><input className="input" placeholder="Value" value={c.value} onChange={(e) => set("metadata", { ...v.metadata, custom: (v.metadata.custom || []).map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} /><button type="button" className="btn-ghost btn-sm" onClick={() => set("metadata", { ...v.metadata, custom: (v.metadata.custom || []).filter((_, j) => j !== i) })}><Trash2 size={14} /></button></div>)}
          <button type="button" className="btn-secondary btn-sm" onClick={() => set("metadata", { ...v.metadata, custom: [...(v.metadata.custom || []), { label: "", value: "" }] })}>Add field</button>
        </div>
      </section>

      {/* Visual direction */}
      <section className="card-pad space-y-4">
        <div><h2 className="h2">Visual direction</h2><p className="muted text-sm">Brand identity (from client profiles) is separate from art direction (visual style). Any style can be used with any client.</p></div>
        <Field label="Visual style" hint="Pick a saved direction (previews use your orientation and tone). Leave empty to be asked at generation time, or run the three-example comparison.">
          <StylePicker styles={styles} value={v.styleId ? [v.styleId] : []} onChange={(ids) => set("styleId", ids[0] || null)} orientation={v.orientation} tone={v.metadata.tone} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tone & voice" hint="Overrides the style's own tone; shapes image prompts and visual knobs (weight, rounding, spacing). Never changes wording."><select className="select" value={v.metadata.tone || ""} onChange={(e) => set("metadata", { ...v.metadata, tone: e.target.value || undefined })}><option value="">Style default</option>{TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></Field>
          <Field label="Voice description (optional)"><input className="input" placeholder="e.g. confident, witty, no corporate clichés" value={v.metadata.voice || ""} onChange={(e) => set("metadata", { ...v.metadata, voice: e.target.value })} /></Field>
          <Field label="Brand color behaviour" hint="Auto follows the style's own rule; override to force the style palette or let the primary brand's colors dominate."><select className="select" value={v.metadata.colorMode || "auto"} onChange={(e) => set("metadata", { ...v.metadata, colorMode: e.target.value as "auto" | "style" | "brand" })}><option value="auto">Auto (style decides)</option><option value="style">Style palette only (brand colors in logos)</option><option value="brand">Primary brand colors dominate</option></select></Field>
        </div>
        <Field label="Custom art direction (optional)" hint="Free-text direction applied on top of the selected style (used for image prompts and notes)."><textarea className="textarea min-h-[80px]" value={v.customDirection} onChange={(e) => set("customDirection", e.target.value)} placeholder="e.g. Cinematic, desert-at-dusk palette, no stock-photo feel, keep imagery abstract." /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Toggle on={v.threeStyleMode} onChange={(b) => set("threeStyleMode", b)} label="Generate three style examples first" description="Preview three meaningfully different directions on representative slides, then pick one. Off = generate directly with the selected style." />
          <Toggle on={v.aiImages} onChange={(b) => set("aiImages", b)} label="AI-generated images (Nano Banana Pro)" description="ON: relevant slides get generated imagery for review. OFF: only approved uploaded assets are used." />
        </div>
        <Field label="Project notes (kept separate from permanent brand guidelines)"><textarea className="textarea min-h-[60px]" value={v.projectNotes} onChange={(e) => set("projectNotes", e.target.value)} /></Field>
      </section>

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-white/85 backdrop-blur border-t border-ink-700 py-3">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => save()}>{presentationId ? "Save changes" : "Save as draft"}</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => save("generate")}>{presentationId ? "Save & go to generation" : "Create & continue to generation"}</button>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import content from a previous presentation">
        <div className="divide-y divide-ink-700 max-h-80 overflow-auto">{prev.filter((p) => p.id !== presentationId).map((p) => <button key={p.id} type="button" className="nav-link w-full justify-between" onClick={() => importFrom(p.id)}><span>{p.name}</span><span className="text-xs text-ink-500">{new Date(p.updatedAt).toLocaleDateString()}</span></button>)}{prev.length === 0 && <p className="text-sm text-ink-500">No previous presentations.</p>}</div>
      </Modal>
    </div>
  );
}

function toEntry(e: Entry) { return { companyId: e.companyId || null, customName: e.companyId ? null : e.name, title: e.title, contactName: e.contactName, department: e.department, logoAssetId: e.logoAssetId || null, showLogo: e.showLogo }; }
function labelLang(l: string) { return { ar: "Arabic", en: "English", "ar-en": "Arabic and English", other: "Other" }[l] || l; }

function EntrySection({ title, description, enabled, onEnabled, entries, onChange, contactFields }: { title: string; description: string; enabled: boolean; onEnabled: (b: boolean) => void; entries: Entry[]; onChange: (e: Entry[]) => void; contactFields: boolean }) {
  const [custom, setCustom] = useState("");
  const move = (i: number, d: -1 | 1) => { const a = [...entries]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const upd = (i: number, patch: Partial<Entry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const pick = async (c: CompanyLite) => {
    const full = await api<{ assets: { id: string; kind: string; name: string }[] }>(`/api/companies/${c.id}`);
    const logos = full.assets.filter((a) => a.kind.includes("logo")).map((a) => ({ id: a.id, name: a.name }));
    onChange([...entries, { companyId: c.id, name: c.name, showLogo: true, logos, logoAssetId: logos[0]?.id || null }]);
  };
  return (
    <section className={`card-pad space-y-3 ${enabled ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="h2">{title}</h2><p className="muted text-sm">{description}</p></div><Toggle on={enabled} onChange={onEnabled} label={enabled ? "Enabled" : "Disabled"} /></div>
      {enabled && (<>
        <CompanySelect placeholder="Search or create a company…" exclude={entries.map((e) => e.companyId || "")} onPick={pick} />
        <div className="flex gap-2"><input className="input" placeholder="Or enter a custom name / title (no profile)" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChange([...entries, { name: custom.trim(), showLogo: false }]); setCustom(""); } }} /><button type="button" className="btn-secondary btn-sm" onClick={() => { if (custom.trim()) { onChange([...entries, { name: custom.trim(), showLogo: false }]); setCustom(""); } }}>Add</button></div>
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="card p-3 space-y-2">
              <div className="flex items-center gap-2"><span className="font-medium text-sm flex-1">{e.name}{!e.companyId && <span className="ml-2 text-xs text-ink-500">custom</span>}</span><button type="button" className="btn-ghost btn-sm" onClick={() => move(i, -1)}><ArrowUp size={13} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => move(i, 1)}><ArrowDown size={13} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => onChange(entries.filter((_, j) => j !== i))}><Trash2 size={13} /></button></div>
              <div className="grid gap-2 md:grid-cols-3">
                <input className="input" placeholder="Title / role (optional)" value={e.title || ""} onChange={(ev) => upd(i, { title: ev.target.value })} />
                {contactFields && <input className="input" placeholder="Contact name" value={e.contactName || ""} onChange={(ev) => upd(i, { contactName: ev.target.value })} />}
                {contactFields && <input className="input" placeholder="Department" value={e.department || ""} onChange={(ev) => upd(i, { department: ev.target.value })} />}
                {e.companyId && <LogoField entry={e} onChange={(p) => upd(i, p)} />}
              </div>
            </div>
          ))}
        </div>
      </>)}
    </section>
  );
}

function LogoField({ entry, onChange }: { entry: Entry; onChange: (p: Partial<Entry>) => void }) {
  const [busy, setBusy] = useState(false);
  const up = async (file: File) => { setBusy(true); try { const a = await upload<{ id: string; name: string }>("/api/assets", { file, companyId: entry.companyId || undefined, kind: "logo_variation", name: file.name }); onChange({ logoAssetId: a.id, logos: [...(entry.logos || []), { id: a.id, name: a.name }], showLogo: true }); } finally { setBusy(false); } };
  return (
    <div className="flex items-center gap-2">
      <select className="select" value={entry.showLogo ? entry.logoAssetId || "" : "__none"} onChange={(e) => { if (e.target.value === "__none") onChange({ showLogo: false }); else onChange({ showLogo: true, logoAssetId: e.target.value || null }); }}>
        <option value="__none">No logo</option>{(entry.logos || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <label className="btn-secondary btn-sm cursor-pointer whitespace-nowrap">{busy ? "…" : <Upload size={13} />}<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && up(e.target.files[0])} /></label>
      {entry.showLogo && entry.logoAssetId && <img src={`/api/files/asset/${entry.logoAssetId}`} alt="" className="h-7 max-w-[90px] object-contain rounded bg-white/90 px-1" />}
    </div>
  );
}
