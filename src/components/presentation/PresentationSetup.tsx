"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2, Upload, Download, ChevronDown, ChevronUp, Sparkles, Columns3 } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Alert, Field, Toggle, Modal, Spinner } from "@/components/ui";
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

/**
 * Create / edit a presentation. The essentials are: content, concept, generate.
 * Everything else lives behind "More details" with sensible defaults.
 */
export function PresentationSetup({ initial, presentationId, styles, customTypes, hasSlides }: { initial: SetupValue; presentationId?: string; styles: PickerStyle[]; customTypes: string[]; hasSlides?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<SetupValue>(initial);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<null | "save" | "generate">(null); const [langAuto, setLangAuto] = useState(!presentationId);
  const [importOpen, setImportOpen] = useState(false); const [prev, setPrev] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [more, setMore] = useState(!!presentationId);
  const set = <K extends keyof SetupValue>(k: K, val: SetupValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const blocks = useMemo(() => (v.content.trim() ? parseContent(v.content) : []), [v.content]);
  const detected = useMemo(() => (v.content.trim() ? detectPresentationLanguage(v.content) : null), [v.content]);
  useEffect(() => { if (langAuto && detected) set("language", detected); }, [detected, langAuto]);
  const suggestedName = blocks.find((b) => b.kind === "heading")?.text || blocks[0]?.text.slice(0, 60) || "";
  const types = [...PRESENTATION_TYPES.filter((t) => t !== "Custom"), ...customTypes, "Custom"];

  const [extracting, setExtracting] = useState(false);
  const onUpload = async (file: File) => { setError(null); setExtracting(true); try { const r = await upload<{ text: string; warnings: string[] }>("/api/content/extract", { file }); set("content", r.text); set("contentSource", "upload"); setUploadWarnings(r.warnings); } catch (e) { setError((e as Error).message); } finally { setExtracting(false); } };
  const openImport = async () => { setPrev(await api("/api/presentations")); setImportOpen(true); };
  const importFrom = async (id: string) => { const p = await api<{ sourceContent: string }>(`/api/presentations/${id}`); set("content", p.sourceContent); set("contentSource", "import"); setImportOpen(false); };

  const save = async (andGenerate: boolean) => {
    setBusy(andGenerate ? "generate" : "save"); setError(null);
    try {
      const name = v.name.trim() || suggestedName;
      if (!name) throw new Error("Add some content or a name first.");
      if (!v.content.trim()) throw new Error("Paste the presentation content first.");
      if (hasSlides && v.content !== initial.content && !confirm("Changing the content will discard the generated slides and require regeneration. Continue?")) { setBusy(null); return; }
      const payload = { ...v, name, customType: v.type === "Custom" ? v.customType : null, participants: v.participants.map(({ companyId, role, roleLabel, instructions }) => ({ companyId, role, roleLabel, instructions })), presentedBy: v.presentedBy.map(toEntry), presentedTo: v.presentedTo.map(toEntry) };
      let id = presentationId;
      if (id) await api(`/api/presentations/${id}`, { method: "PATCH", json: payload });
      else { const p = await api<{ id: string }>("/api/presentations", { method: "POST", json: payload }); id = p.id; }
      if (andGenerate) {
        if (!v.threeStyleMode && !v.styleId) throw new Error("Pick a concept, or switch on “Show me three concepts”.");
        await api(`/api/presentations/${id}/generate`, { method: "POST", json: v.threeStyleMode ? { mode: "three" } : { mode: "direct", styleId: v.styleId } });
      }
      router.push(`/presentations/${id}?tab=concept`); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {error && <Alert kind="error">{error}</Alert>}

      {/* 1. Content */}
      <section className="card-pad space-y-4">
        <div className="flex items-center gap-3"><span className="step">1</span><h2 className="h2">Your content</h2></div>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <Field label="Presentation name"><input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder={suggestedName || "e.g. Brand Strategy 2027"} /></Field>
          <Field label="Type"><select className="select" value={v.type} onChange={(e) => set("type", e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select>{v.type === "Custom" && <input className="input mt-2" placeholder="Custom type" value={v.customType} onChange={(e) => set("customType", e.target.value)} />}</Field>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <label className="btn-secondary btn-sm cursor-pointer">{extracting ? <Spinner /> : <Upload size={13} />} Upload a document (PDF, Word, PowerPoint, image…)<input type="file" className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.rtf,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>
            <button type="button" className="btn-secondary btn-sm" onClick={openImport}><Download size={13} /> Reuse a previous presentation</button>
            <span className="ml-auto text-xs text-ink-500">{blocks.length ? `${blocks.length} blocks · ${labelLang(v.language)}` : ""}</span>
          </div>
          {uploadWarnings.length > 0 && <Alert kind="warn">{uploadWarnings.join(" ")}</Alert>}
          <textarea className="textarea min-h-[260px]" dir="auto" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); onUpload(f); } }} value={v.content} onChange={(e) => { set("content", e.target.value); if (v.contentSource !== "paste") set("contentSource", "paste"); }} placeholder={"Paste the presentation content here, or upload a document above (PDF, Word, PowerPoint, text or an image — text is extracted for you). Your wording is never changed.\n\nBlank lines separate paragraphs; short standalone lines become headings; lines starting with - become bullet points."} />
        </div>
      </section>

      {/* 2. Concept */}
      <section className="card-pad space-y-4">
        <div className="flex flex-wrap items-center gap-3"><span className="step">2</span><h2 className="h2">Concept</h2><p className="muted text-sm">The art direction. Same content, any concept — brand identity stays intact.</p></div>
        <Toggle on={v.threeStyleMode} onChange={(b) => set("threeStyleMode", b)} label="Show me three concepts first" description="The studio renders a few representative slides in three different concepts; you pick one, then the full deck is generated." />
        {!v.threeStyleMode && <StylePicker styles={styles} value={v.styleId ? [v.styleId] : []} onChange={(ids) => set("styleId", ids[0] || null)} orientation={v.orientation} tone={v.metadata.tone} />}
      </section>

      {/* 3. More details (collapsed) */}
      <section className="card overflow-hidden">
        <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setMore(!more)}>
          <span className="flex items-center gap-3"><span className="step">3</span><span className="h2">More details</span><span className="muted text-sm hidden md:inline">brands, presented by / to, format, AI images, metadata — all optional</span></span>
          {more ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {more && (
          <div className="border-t border-ink-700 p-5 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Format"><div className="flex gap-2">{([["landscape", "Horizontal"], ["portrait", "Vertical"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set("orientation", k)} className={`card flex-1 px-3 py-2 text-sm ${v.orientation === k ? "border-accent ring-1 ring-accent/40" : ""}`}>{label}</button>)}</div></Field>
              <Field label="Language"><select className="select" value={v.language} onChange={(e) => { setLangAuto(false); set("language", e.target.value as SetupValue["language"]); }}><option value="ar">Arabic</option><option value="en">English</option><option value="ar-en">Arabic and English</option><option value="other">Other</option></select></Field>
              <Field label="Tone"><select className="select" value={v.metadata.tone || ""} onChange={(e) => set("metadata", { ...v.metadata, tone: e.target.value || undefined })}><option value="">Concept default</option>{TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></Field>
            </div>
            <Toggle on={v.aiImages} onChange={(b) => set("aiImages", b)} label="AI-generated images" description="Relevant slides get generated imagery you can review and replace. Off: only your uploaded brand images are used." />

            <div className="space-y-3">
              <h3 className="section-title">Brands in this presentation</h3>
              <CompanySelect clientsOnly placeholder="Search or create a brand…" exclude={v.participants.map((p) => p.companyId)} onPick={(c) => set("participants", [...v.participants, { companyId: c.id, name: c.name, role: v.participants.length ? "secondary" : "primary" }])} />
              {v.participants.map((p, i) => (
                <div key={p.companyId} className="card p-3 grid gap-2 md:grid-cols-[1fr_170px_auto] items-center">
                  <div className="font-medium text-sm">{p.name}</div>
                  <select className="select" value={p.role} onChange={(e) => set("participants", v.participants.map((x, j) => (j === i ? { ...x, role: e.target.value as typeof p.role } : x)))}>{ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => set("participants", v.participants.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <EntrySection title="Presented by" enabled={v.presentedByEnabled} onEnabled={(b) => set("presentedByEnabled", b)} entries={v.presentedBy} onChange={(e) => set("presentedBy", e)} contactFields={false} />
              <EntrySection title="Presented to" enabled={v.presentedToEnabled} onEnabled={(b) => set("presentedToEnabled", b)} entries={v.presentedTo} onChange={(e) => set("presentedTo", e)} contactFields />
            </div>

            <div className="space-y-3">
              <h3 className="section-title">Cover details (only shown if filled)</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {([["date", "Date"], ["version", "Version"], ["confidentiality", "Confidentiality label"]] as const).map(([k, label]) => <input key={k} className="input" placeholder={label} value={v.metadata[k] || ""} onChange={(e) => set("metadata", { ...v.metadata, [k]: e.target.value })} />)}
              </div>
              <textarea className="textarea min-h-[60px]" value={v.customDirection} onChange={(e) => set("customDirection", e.target.value)} placeholder="Anything else you want to say about this presentation (optional)" />
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-white/85 backdrop-blur border-t border-ink-700 py-3">
        <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => save(false)}>{presentationId ? "Save changes" : "Save as draft"}</button>
        <button type="button" className="btn-primary" disabled={!!busy} onClick={() => save(true)}>{v.threeStyleMode ? <Columns3 size={16} /> : <Sparkles size={16} />}{busy === "generate" ? "Starting…" : v.threeStyleMode ? "Show me three concepts" : "Generate presentation"}</button>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Reuse content from a previous presentation">
        <div className="divide-y divide-ink-700 max-h-80 overflow-auto">{prev.filter((p) => p.id !== presentationId).map((p) => <button key={p.id} type="button" className="nav-link w-full justify-between" onClick={() => importFrom(p.id)}><span>{p.name}</span><span className="text-xs text-ink-500">{new Date(p.updatedAt).toLocaleDateString()}</span></button>)}{prev.length === 0 && <p className="text-sm text-ink-500">No previous presentations.</p>}</div>
      </Modal>
    </div>
  );
}

function toEntry(e: Entry) { return { companyId: e.companyId || null, customName: e.companyId ? null : e.name, title: e.title, contactName: e.contactName, department: e.department, logoAssetId: e.logoAssetId || null, showLogo: e.showLogo }; }
function labelLang(l: string) { return { ar: "Arabic", en: "English", "ar-en": "Arabic & English", other: "Other" }[l] || l; }

function EntrySection({ title, enabled, onEnabled, entries, onChange, contactFields }: { title: string; enabled: boolean; onEnabled: (b: boolean) => void; entries: Entry[]; onChange: (e: Entry[]) => void; contactFields: boolean }) {
  const [custom, setCustom] = useState("");
  const move = (i: number, d: -1 | 1) => { const a = [...entries]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const upd = (i: number, patch: Partial<Entry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const pick = async (c: CompanyLite) => {
    const full = await api<{ assets: { id: string; kind: string; name: string }[] }>(`/api/companies/${c.id}`);
    const logos = full.assets.filter((a) => a.kind.includes("logo")).map((a) => ({ id: a.id, name: a.name }));
    onChange([...entries, { companyId: c.id, name: c.name, showLogo: true, logos, logoAssetId: logos[0]?.id || null }]);
  };
  return (
    <div className={`space-y-2 ${enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between"><h3 className="section-title">{title}</h3><Toggle on={enabled} onChange={onEnabled} label={enabled ? "Shown" : "Hidden"} /></div>
      {enabled && (<>
        <CompanySelect placeholder="Search or create a company…" exclude={entries.map((e) => e.companyId || "")} onPick={pick} />
        <div className="flex gap-2"><input className="input" placeholder="Or type a name" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onChange([...entries, { name: custom.trim(), showLogo: false }]); setCustom(""); } }} /><button type="button" className="btn-secondary btn-sm" onClick={() => { if (custom.trim()) { onChange([...entries, { name: custom.trim(), showLogo: false }]); setCustom(""); } }}>Add</button></div>
        {entries.map((e, i) => (
          <div key={i} className="card p-2.5 space-y-2">
            <div className="flex items-center gap-1"><span className="font-medium text-sm flex-1 pl-1">{e.name}</span><button type="button" className="btn-ghost btn-sm" onClick={() => move(i, -1)}><ArrowUp size={13} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => move(i, 1)}><ArrowDown size={13} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => onChange(entries.filter((_, j) => j !== i))}><Trash2 size={13} /></button></div>
            <div className="grid gap-2 md:grid-cols-3">
              <input className="input" placeholder="Title / role (optional)" value={e.title || ""} onChange={(ev) => upd(i, { title: ev.target.value })} />
              {contactFields && <input className="input" placeholder="Contact name" value={e.contactName || ""} onChange={(ev) => upd(i, { contactName: ev.target.value })} />}
              {contactFields && <input className="input" placeholder="Department" value={e.department || ""} onChange={(ev) => upd(i, { department: ev.target.value })} />}
              {e.companyId && <LogoField entry={e} onChange={(p) => upd(i, p)} />}
            </div>
          </div>
        ))}
      </>)}
    </div>
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
