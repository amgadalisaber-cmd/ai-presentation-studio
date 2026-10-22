"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, Upload } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Alert, Field, Spinner } from "@/components/ui";
import { SlideView } from "@/components/slide/SlideView";
import type { StyleSpec } from "@/lib/styles/spec";
import { previewSlides } from "@/lib/styles/preview";
import { FontSelect } from "@/components/FontSelect";
import { TONES } from "@/lib/types";

export interface StyleValue { name: string; description: string; tone: string; voice: string; spec: StyleSpec; composition: string; layoutRules: string; typography: string; imageTreatment: string; backgroundTreatment: string; colorBehavior: string; lighting: string; density: string; decorative: string; negative: string }
type Ref = { id: string; url?: string | null; note?: string | null; asset?: { id: string; name: string; mimeType: string } | null };

export function StyleForm({ initial, id, isBuiltIn, references = [] }: { initial: StyleValue; id?: string; isBuiltIn?: boolean; references?: Ref[] }) {
  const router = useRouter(); const [v, setV] = useState(initial); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [refNote, setRefNote] = useState(""); const [refUrl, setRefUrl] = useState("");
  const set = <K extends keyof StyleValue>(k: K, val: StyleValue[K]) => setV((s) => ({ ...s, [k]: val }));
  const spec = <K extends keyof StyleSpec>(k: K, patch: Partial<StyleSpec[K]>) => setV((s) => ({ ...s, spec: { ...s.spec, [k]: typeof s.spec[k] === "object" && !Array.isArray(s.spec[k]) ? { ...(s.spec[k] as object), ...patch } : patch } }));
  const readOnly = !!isBuiltIn;
  const save = async () => {
    setBusy(true); setError(null);
    try { if (!v.name.trim()) throw new Error("Name is required"); if (id) { await api(`/api/styles/${id}`, { method: "PATCH", json: v }); router.refresh(); } else { const s = await api<{ id: string }>("/api/styles", { method: "POST", json: v }); router.push(`/styles/${s.id}`); router.refresh(); } }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const duplicate = async () => { const s = await api<{ id: string }>(`/api/styles/${id}/duplicate`, { method: "POST" }); router.push(`/styles/${s.id}`); router.refresh(); };
  const del = async () => { if (!confirm(`Delete style "${v.name}"?`)) return; await api(`/api/styles/${id}`, { method: "DELETE" }); router.push("/styles"); router.refresh(); };
  const addRefFile = async (file: File) => { setBusy(true); try { const a = await upload<{ id: string }>("/api/assets", { file, kind: "style_reference", name: file.name }); await api(`/api/styles/${id}/references`, { method: "POST", json: { assetId: a.id, note: refNote } }); setRefNote(""); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const addRefUrl = async () => { if (!refUrl.trim()) return; await api(`/api/styles/${id}/references`, { method: "POST", json: { url: refUrl.trim(), note: refNote } }); setRefUrl(""); setRefNote(""); router.refresh(); };
  const preview = previewSlides(v.spec, v.name, "landscape", v.tone || undefined);
  const P = v.spec.palette; const C = v.spec.composition; const D = v.spec.decorative; const F = v.spec.fonts; const S = v.spec.scale; const I = v.spec.imageTreatment;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        {error && <Alert kind="error">{error}</Alert>}
        {readOnly && <Alert kind="info">Built-in style (read-only). <button className="underline" onClick={duplicate}>Duplicate</button> it to customise.</Alert>}
        <div className="grid gap-4 md:grid-cols-2"><Field label="Style name *"><input className="input" disabled={readOnly} value={v.name} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Description"><input className="input" disabled={readOnly} value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Tone" hint="Default mood of this direction; a presentation can override it."><select className="select" disabled={readOnly} value={v.tone} onChange={(e) => setV((x) => ({ ...x, tone: e.target.value, spec: { ...x.spec, tone: e.target.value || undefined } }))}><option value="">— none —</option>{TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select></Field>
          <Field label="Voice" hint="How the direction should feel, in words (used in image prompts)."><input className="input" disabled={readOnly} value={v.voice} onChange={(e) => setV((x) => ({ ...x, voice: e.target.value, spec: { ...x.spec, voice: e.target.value || undefined } }))} placeholder="e.g. serious, understated, premium" /></Field></div>
        <fieldset disabled={readOnly} className="space-y-5">
          <section className="card-pad space-y-3"><h3 className="section-title">Palette & color behaviour</h3>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">{(["background", "surface", "text", "muted", "accent", "accent2"] as const).map((k) => <label key={k} className="text-xs"><span className="text-ink-500">{k}</span><div className="flex gap-1"><input type="color" value={P[k]} onChange={(e) => spec("palette", { [k]: e.target.value })} /><input className="input px-1.5" value={P[k]} onChange={(e) => spec("palette", { [k]: e.target.value })} /></div></label>)}</div>
            <Field label="How brand colors interact with this style" hint="brand-accent: brand primary becomes the accent · brand-dominant: brand primary becomes the background · style-dominant / monochrome: style palette only (brand colors in logos)."><select className="select" value={v.spec.colorBehavior} onChange={(e) => setV((s) => ({ ...s, spec: { ...s.spec, colorBehavior: e.target.value as StyleSpec["colorBehavior"] } }))}><option value="brand-accent">brand-accent</option><option value="brand-dominant">brand-dominant</option><option value="style-dominant">style-dominant</option><option value="monochrome">monochrome</option></select></Field>
            <Field label="Color behaviour notes"><input className="input" value={v.colorBehavior} onChange={(e) => set("colorBehavior", e.target.value)} /></Field>
          </section>
          <section className="card-pad space-y-3"><h3 className="section-title">Composition & layout rules</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Cover layout"><select className="select" value={C.coverLayout} onChange={(e) => spec("composition", { coverLayout: e.target.value as StyleSpec["composition"]["coverLayout"] })}>{["left-stack", "centered", "split", "bottom-band", "poster", "grid"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Content layout"><select className="select" value={C.contentLayout} onChange={(e) => spec("composition", { contentLayout: e.target.value as StyleSpec["composition"]["contentLayout"] })}>{["two-column", "single-column", "sidebar", "editorial", "card-grid", "full-bleed"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Heading placement"><select className="select" value={C.headingPlacement} onChange={(e) => spec("composition", { headingPlacement: e.target.value as StyleSpec["composition"]["headingPlacement"] })}>{["top", "side", "bottom"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Alignment"><select className="select" value={C.alignment} onChange={(e) => spec("composition", { alignment: e.target.value as StyleSpec["composition"]["alignment"] })}><option value="start">start</option><option value="center">center</option></select></Field>
              <Field label="Image placement"><select className="select" value={C.imagePlacement} onChange={(e) => spec("composition", { imagePlacement: e.target.value as StyleSpec["composition"]["imagePlacement"] })}>{["right-half", "left-half", "full-bleed", "top-band", "inset", "none"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="List style"><select className="select" value={C.listStyle} onChange={(e) => spec("composition", { listStyle: e.target.value as StyleSpec["composition"]["listStyle"] })}>{["bullets", "cards", "numbered-rows", "columns"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Density & whitespace"><select className="select" value={v.spec.density} onChange={(e) => setV((s) => ({ ...s, spec: { ...s.spec, density: e.target.value as StyleSpec["density"] } }))}><option value="airy">airy</option><option value="balanced">balanced</option><option value="dense">dense</option></select></Field>
            </div>
            <Field label="Composition principles"><textarea className="textarea min-h-[60px]" value={v.composition} onChange={(e) => set("composition", e.target.value)} /></Field>
            <Field label="Layout rules"><textarea className="textarea min-h-[60px]" value={v.layoutRules} onChange={(e) => set("layoutRules", e.target.value)} /></Field>
            <Field label="Density notes"><input className="input" value={v.density} onChange={(e) => set("density", e.target.value)} /></Field>
          </section>
          <section className="card-pad space-y-3"><h3 className="section-title">Typography treatment</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Heading font"><FontSelect disabled={readOnly} value={F.heading} onChange={(f) => spec("fonts", { heading: f })} /></Field><Field label="Body font"><FontSelect disabled={readOnly} value={F.body} onChange={(f) => spec("fonts", { body: f })} /></Field>
              <Field label="Arabic heading font"><FontSelect arabic disabled={readOnly} value={F.arabicHeading} onChange={(f) => spec("fonts", { arabicHeading: f })} /></Field><Field label="Arabic body font"><FontSelect arabic disabled={readOnly} value={F.arabicBody} onChange={(f) => spec("fonts", { arabicBody: f })} /></Field>
              <Field label="Heading weight"><select className="select" value={F.headingWeight} onChange={(e) => spec("fonts", { headingWeight: Number(e.target.value) })}>{[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
              <Field label="Heading case"><select className="select" value={F.headingTransform} onChange={(e) => spec("fonts", { headingTransform: e.target.value as "uppercase" | "none" })}><option value="none">as written</option><option value="uppercase">uppercase (visual)</option></select></Field>
              <Field label="Heading tracking (px)"><input type="number" className="input" value={F.headingLetterSpacing} onChange={(e) => spec("fonts", { headingLetterSpacing: Number(e.target.value) })} /></Field>
              <Field label="Line height"><input type="number" step={0.05} className="input" value={S.lineHeight} onChange={(e) => spec("scale", { lineHeight: Number(e.target.value) })} /></Field>
              {(["h1", "h2", "h3", "body", "caption"] as const).map((k) => <Field key={k} label={`${k} size (px @1920)`}><input type="number" className="input" value={S[k]} onChange={(e) => spec("scale", { [k]: Number(e.target.value) })} /></Field>)}
            </div>
            <Field label="Typography notes"><textarea className="textarea min-h-[60px]" value={v.typography} onChange={(e) => set("typography", e.target.value)} /></Field>
          </section>
          <section className="card-pad space-y-3"><h3 className="section-title">Image, background, lighting</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Image style (short)"><input className="input" value={I.style} onChange={(e) => spec("imageTreatment", { style: e.target.value })} /></Field>
              <Field label="Image aspect"><select className="select" value={I.aspect} onChange={(e) => spec("imageTreatment", { aspect: e.target.value as StyleSpec["imageTreatment"]["aspect"] })}>{["16:9", "4:3", "1:1", "3:4"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Image prompt prefix (Nano Banana Pro)" className="md:col-span-2"><textarea className="textarea min-h-[60px]" value={I.promptPrefix} onChange={(e) => spec("imageTreatment", { promptPrefix: e.target.value })} /></Field>
              <Field label="Negative prompt"><input className="input" value={I.negativePrompt} onChange={(e) => spec("imageTreatment", { negativePrompt: e.target.value })} /></Field>
              <Field label="CSS image filter (PDF/preview only)"><input className="input" value={I.cssFilter || ""} onChange={(e) => spec("imageTreatment", { cssFilter: e.target.value || undefined })} /></Field>
              <Field label="Background treatment"><select className="select" value={v.spec.background.treatment} onChange={(e) => spec("background", { treatment: e.target.value as StyleSpec["background"]["treatment"] })}>{["solid", "gradient", "image-dark", "image-light", "paper", "grid"].map((o) => <option key={o}>{o}</option>)}</select></Field>
              <Field label="Background CSS gradient"><input className="input" value={v.spec.background.gradient || ""} onChange={(e) => spec("background", { gradient: e.target.value || undefined })} placeholder="linear-gradient(…)" /></Field>
              <Field label="Image overlay (CSS gradient)" className="md:col-span-2"><input className="input" value={v.spec.background.overlay || ""} onChange={(e) => spec("background", { overlay: e.target.value || undefined })} /></Field>
              <Field label="Lighting and atmosphere"><input className="input" value={v.spec.lighting || ""} onChange={(e) => setV((s) => ({ ...s, spec: { ...s.spec, lighting: e.target.value }, lighting: e.target.value }))} /></Field>
            </div>
            <Field label="Image treatment notes"><textarea className="textarea min-h-[50px]" value={v.imageTreatment} onChange={(e) => set("imageTreatment", e.target.value)} /></Field>
            <Field label="Background treatment notes"><input className="input" value={v.backgroundTreatment} onChange={(e) => set("backgroundTreatment", e.target.value)} /></Field>
          </section>
          <section className="card-pad space-y-3"><h3 className="section-title">Decorative elements & negative instructions</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-sm">{(["rules", "slideNumbers", "sectionNumbers", "frames", "gridLines", "largeIndex"] as const).map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={D[k]} onChange={(e) => spec("decorative", { [k]: e.target.checked })} />{k}</label>)}</div>
            <div className="grid gap-3 md:grid-cols-2"><Field label="Divider style"><select className="select" value={D.dividerStyle} onChange={(e) => spec("decorative", { dividerStyle: e.target.value as StyleSpec["decorative"]["dividerStyle"] })}><option>line</option><option>block</option><option>none</option></select></Field><Field label="Client logo position (content slides)"><select className="select" value={D.logoPosition} onChange={(e) => spec("decorative", { logoPosition: e.target.value as StyleSpec["decorative"]["logoPosition"] })}>{["top-left", "top-right", "bottom-left", "bottom-right"].map((o) => <option key={o}>{o}</option>)}</select></Field></div>
            <Field label="Decorative elements notes"><input className="input" value={v.decorative} onChange={(e) => set("decorative", e.target.value)} /></Field>
            <Field label="Negative instructions (one per line)"><textarea className="textarea min-h-[60px]" value={v.spec.negative.join("\n")} onChange={(e) => setV((s) => ({ ...s, spec: { ...s.spec, negative: e.target.value.split("\n").filter(Boolean) }, negative: e.target.value }))} /></Field>
          </section>
        </fieldset>
        <div className="flex items-center gap-2">{!readOnly && <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Spinner /> : null}{id ? "Save style" : "Create style"}</button>}{id && <button className="btn-secondary" onClick={duplicate}><Copy size={14} /> Duplicate</button>}{id && !readOnly && <button className="btn-danger ml-auto" onClick={del}><Trash2 size={14} /> Delete</button>}</div>
      </div>
      <div className="space-y-4">
        <div className="card-pad space-y-2"><h3 className="section-title">Live preview</h3><p className="text-xs text-ink-500">Sample slides rendered with this spec (cover, section, content, list).</p>{preview.map((s, i) => <SlideView key={i} slide={s} className="rounded border border-ink-700" />)}</div>
        {id && <div className="card-pad space-y-3"><h3 className="section-title">Visual references & approved examples</h3>
          <div className="grid grid-cols-2 gap-2">{references.map((r) => <div key={r.id} className="card overflow-hidden text-xs"><div className="aspect-video bg-ink-800 flex items-center justify-center">{r.asset?.mimeType.startsWith("image/") ? <img src={`/api/files/asset/${r.asset.id}`} alt="" className="h-full w-full object-cover" /> : <a href={r.url || "#"} target="_blank" rel="noreferrer" className="text-accent px-2 break-all">{r.asset?.name || r.url}</a>}</div><div className="flex items-center justify-between p-1.5"><span className="truncate">{r.note || r.asset?.name || "reference"}</span>{!readOnly && <button className="text-ink-500 hover:text-red-300" onClick={() => api(`/api/style-references/${r.id}`, { method: "DELETE" }).then(() => router.refresh())}><Trash2 size={12} /></button>}</div></div>)}</div>
          {!readOnly && <div className="space-y-2"><input className="input" placeholder="Note (optional)" value={refNote} onChange={(e) => setRefNote(e.target.value)} /><div className="flex gap-2"><label className="btn-secondary btn-sm cursor-pointer"><Upload size={13} /> Upload image / PDF / PPTX<input type="file" className="hidden" accept="image/*,.pdf,.pptx" onChange={(e) => e.target.files?.[0] && addRefFile(e.target.files[0])} /></label></div><div className="flex gap-2"><input className="input" placeholder="https://reference-url" value={refUrl} onChange={(e) => setRefUrl(e.target.value)} /><button className="btn-secondary btn-sm" onClick={addRefUrl}>Add URL</button></div></div>}
        </div>}
      </div>
    </div>
  );
}
