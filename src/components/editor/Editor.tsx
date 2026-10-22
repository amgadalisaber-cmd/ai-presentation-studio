"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Undo2, Redo2, Save, Play, RefreshCw, Palette, Download, Copy, Trash2, Plus, ChevronUp, ChevronDown, ImageIcon, Type, Square, ArrowLeft, X, Layers, ShieldCheck } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Alert, Modal, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { SlideView } from "@/components/slide/SlideView";
import { AssetPicker } from "./AssetPicker";
import { CANVAS_H, CANVAS_W, type BlockModel, type ElementModel, type ImageProps, type ShapeProps, type SlideModel, type TextProps } from "@/lib/types";
import { fontStack, backgroundStyle } from "@/lib/render/html";
import type { IntegrityReport } from "@/lib/content/verify";

type Data = { presentation: { id: string; name: string; language: string; styleId: string | null; aiImages: boolean; status: string; integrityStatus: string; integrityReport: IntegrityReport | null }; slides: SlideModel[]; blocks: BlockModel[]; images: { id: string; status: string; storagePath?: string | null }[]; styles: { id: string; name: string; isBuiltIn: boolean }[] };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function Editor({ presentationId }: { presentationId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [slides, setSlides] = useState<SlideModel[]>([]);
  const [cur, setCur] = useState(0); const [multi, setMulti] = useState<Set<number>>(new Set());
  const [selEl, setSelEl] = useState<number | null>(null);
  const [history, setHistory] = useState<SlideModel[][]>([]); const [future, setFuture] = useState<SlideModel[][]>([]);
  const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [job, setJob] = useState<{ id: string; status: string; error?: string | null } | null>(null);
  const [styleModal, setStyleModal] = useState(false); const [styleChoice, setStyleChoice] = useState(""); const [styleScope, setStyleScope] = useState<"all" | "slides">("all");
  const [picker, setPicker] = useState<null | "replace" | "add" | "background">(null);
  const [preview, setPreview] = useState(false);
  const [scale, setScale] = useState(0.5); const canvasWrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => { const d = await api<Data>(`/api/presentations/${presentationId}/slides`); setData(d); setSlides(d.slides); setIntegrity(d.presentation.integrityReport); setDirty(false); setHistory([]); setFuture([]); setSelEl(null); setCur((c) => Math.min(c, Math.max(0, d.slides.length - 1))); }, [presentationId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const el = canvasWrap.current; if (!el) return; const ro = new ResizeObserver(() => setScale(Math.min((el.clientWidth - 48) / CANVAS_W, (el.clientHeight - 48) / CANVAS_H))); ro.observe(el); return () => ro.disconnect(); }, [data]);

  // job polling (regeneration / style change)
  useEffect(() => { if (!job || (job.status !== "queued" && job.status !== "running")) return; const t = setInterval(async () => { const j = await api<typeof job>(`/api/jobs/${job.id}`); setJob(j); if (j && (j.status === "completed" || j.status === "failed")) { clearInterval(t); if (j.status === "completed") { await load(); setMsg("Slides regenerated."); } else setError(j.error || "Regeneration failed"); } }, 1500); return () => clearInterval(t); }, [job?.id, job?.status, load]);

  const commit = (next: SlideModel[]) => { setHistory((h) => [...h.slice(-60), slides]); setFuture([]); setSlides(next); setDirty(true); };
  const undo = () => { if (!history.length) return; const prev = history[history.length - 1]; setFuture((f) => [slides, ...f]); setHistory((h) => h.slice(0, -1)); setSlides(prev); setDirty(true); setSelEl(null); };
  const redo = () => { if (!future.length) return; const nxt = future[0]; setHistory((h) => [...h, slides]); setFuture((f) => f.slice(1)); setSlides(nxt); setDirty(true); setSelEl(null); };

  const save = useCallback(async () => {
    if (!dirty) return; setSaving(true); setError(null);
    try { const r = await api<{ slides: SlideModel[]; integrity: IntegrityReport }>(`/api/presentations/${presentationId}/slides`, { method: "PUT", json: { slides } }); setSlides(r.slides); setIntegrity(r.integrity); setDirty(false); setMsg("Saved"); router.refresh(); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }, [dirty, slides, presentationId, router]);
  useEffect(() => { if (!dirty) return; const t = setTimeout(save, 4000); return () => clearTimeout(t); }, [dirty, slides, save]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); } if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } if (e.key === "Escape") { setSelEl(null); setPreview(false); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); } }, [msg]);

  const slide = slides[cur];
  const updateSlide = (fn: (s: SlideModel) => SlideModel) => commit(slides.map((s, i) => (i === cur ? fn(clone(s)) : s)));
  const updateEl = (patch: Partial<ElementModel> | ((e: ElementModel) => ElementModel)) => { if (selEl == null) return; updateSlide((s) => { s.elements = s.elements.map((e, i) => (i === selEl ? (typeof patch === "function" ? patch(e) : { ...e, ...patch }) : e)); return s; }); };
  const updateProps = (patch: Record<string, unknown>) => updateEl((e) => ({ ...e, props: { ...(e.props as object), ...patch } as unknown as ElementModel["props"] }));

  // slide ops
  const addSlide = () => { const s: SlideModel = { index: cur + 1, layoutKey: "blank", purpose: "content", background: { color: slide?.background.color || "#111111" }, styleId: data?.presentation.styleId, elements: [] }; const next = [...slides]; next.splice(cur + 1, 0, s); commit(next.map((x, i) => ({ ...x, index: i }))); setCur(cur + 1); };
  const duplicateSlide = () => { const s = clone(slide); delete s.id; s.elements = s.elements.map((e) => { const c = { ...e }; delete c.id; return c; }); const next = [...slides]; next.splice(cur + 1, 0, s); commit(next.map((x, i) => ({ ...x, index: i }))); setCur(cur + 1); };
  const deleteSlides = () => { const set = multi.size ? multi : new Set([cur]); if (!confirm(`Delete ${set.size} slide(s)? Text on them will be reported as missing by the integrity check.`)) return; const next = slides.filter((_, i) => !set.has(i)).map((x, i) => ({ ...x, index: i })); commit(next); setCur(Math.max(0, Math.min(cur, next.length - 1))); setMulti(new Set()); };
  const moveSlide = (from: number, to: number) => { if (to < 0 || to >= slides.length) return; const next = [...slides]; const [s] = next.splice(from, 1); next.splice(to, 0, s); commit(next.map((x, i) => ({ ...x, index: i }))); setCur(to); };
  const dragFrom = useRef<number | null>(null);

  // element ops
  const addText = () => { const dir = data?.presentation.language === "ar" ? "rtl" : "ltr"; const el: ElementModel = { type: "text", origin: "user", x: 200, y: 200, w: 800, h: 120, z: (Math.max(0, ...slide.elements.map((e) => e.z)) + 1), props: { text: "", fontFamily: dir === "rtl" ? "Cairo" : "Inter", fontSize: 32, fontWeight: 400, color: textColorFor(slide), align: dir === "rtl" ? "right" : "left", dir, lang: dir === "rtl" ? "ar" : "en", lineHeight: 1.4, role: "body" } as TextProps }; updateSlide((s) => { s.elements.push(el); return s; }); setSelEl(slide.elements.length); };
  const addShape = () => { const el: ElementModel = { type: "shape", origin: "user", x: 200, y: 200, w: 400, h: 200, z: 0, props: { shape: "rect", fill: "#888888", radius: 0 } as ShapeProps }; updateSlide((s) => { s.elements.unshift(el); return s; }); setSelEl(0); };
  const addImage = (a: { id: string }) => { const el: ElementModel = { type: "image", origin: "user", x: 1100, y: 160, w: 700, h: 760, z: (Math.max(0, ...slide.elements.map((e) => e.z)) + 1), props: { src: `/api/files/asset/${a.id}`, fit: "cover" } as ImageProps, assetId: a.id }; updateSlide((s) => { s.elements.push(el); return s; }); setSelEl(slide.elements.length); setPicker(null); };
  const replaceImage = async (a: { id: string }) => { const e = slide.elements[selEl!]; if (e.generatedImageId) { /* replace the generated image slot via upload of the chosen asset */ const blob = await (await fetch(`/api/files/asset/${a.id}`)).blob(); await upload(`/api/images/${e.generatedImageId}/replace`, { file: new File([blob], "replacement.png", { type: blob.type }) }); await load(); } else updateEl((x) => ({ ...x, assetId: a.id, generatedImageId: null, props: { ...(x.props as ImageProps), src: `/api/files/asset/${a.id}`, placeholder: false } })); setPicker(null); };
  const setBackgroundImage = (a: { id: string }) => { updateSlide((s) => { s.background = { ...s.background, imageSrc: `/api/files/asset/${a.id}`, imageAssetId: a.id, generatedImageId: undefined }; return s; }); setPicker(null); };
  const reorderZ = (d: 1 | -1) => updateEl((e) => ({ ...e, z: Math.max(0, e.z + d) }));
  const deleteEl = () => { if (selEl == null) return; const e = slide.elements[selEl]; if (e.blockId && !confirm("This element holds source content. Deleting it will be flagged as missing text by the integrity check. Continue?")) return; updateSlide((s) => { s.elements.splice(selEl, 1); return s; }); setSelEl(null); };

  // regenerate / style
  const regenerate = async (ids: string[], styleId?: string | null) => { setError(null); if (dirty) await save(); try { const j = await api<typeof job>(`/api/presentations/${presentationId}/regenerate`, { method: "POST", json: { slideIds: ids, styleId: styleId ?? null } }); setJob(j); } catch (e) { setError((e as Error).message); } };
  const regenerateAll = async () => { if (!confirm("Regenerate the entire presentation? Each slide is re-laid out from its content; manual edits are lost.")) return; await regenerate(slides.map((s) => s.id!).filter(Boolean)); };
  const changeStyle = async () => { if (!styleChoice) return; setError(null); if (dirty) await save(); try { const j = await api<typeof job>(`/api/presentations/${presentationId}/style`, { method: "POST", json: { styleId: styleChoice, scope: styleScope, slideIds: styleScope === "slides" ? [...(multi.size ? multi : new Set([cur]))].map((i) => slides[i].id).filter(Boolean) : undefined } }); setJob(j); setStyleModal(false); } catch (e) { setError((e as Error).message); } };
  const selectedIds = [...(multi.size ? multi : new Set([cur]))].map((i) => slides[i]?.id).filter(Boolean) as string[];

  // canvas interactions
  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; orig: ElementModel; idx: number } | null>(null);
  const onDown = (e: React.MouseEvent, idx: number, mode: "move" | "resize" = "move") => { e.stopPropagation(); setSelEl(idx); drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: clone(slide.elements[idx]), idx }; };
  useEffect(() => {
    const mv = (e: MouseEvent) => { const d = drag.current; if (!d) return; const dx = (e.clientX - d.startX) / scale, dy = (e.clientY - d.startY) / scale; setSlides((prev) => prev.map((s, i) => (i !== cur ? s : { ...s, elements: s.elements.map((el, j) => (j !== d.idx ? el : d.mode === "move" ? { ...el, x: Math.round(d.orig.x + dx), y: Math.round(d.orig.y + dy) } : { ...el, w: Math.max(20, Math.round(d.orig.w + dx)), h: Math.max(20, Math.round(d.orig.h + dy)) })) }))); };
    const up = () => { if (drag.current) { const d = drag.current; drag.current = null; setSlides((prev) => { const el = prev[cur].elements[d.idx]; if (el && (el.x !== d.orig.x || el.y !== d.orig.y || el.w !== d.orig.w || el.h !== d.orig.h)) { setHistory((h) => [...h.slice(-60), prev.map((s, i) => (i === cur ? { ...s, elements: s.elements.map((x, j) => (j === d.idx ? d.orig : x)) } : s))]); setFuture([]); setDirty(true); } return prev; }); } };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up); return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [cur, scale]);

  if (!data) return <div className="p-10"><Spinner /></div>;
  if (!slides.length) return <div className="p-10 space-y-3"><p>This presentation has no slides yet.</p><Link className="btn-primary" href={`/presentations/${presentationId}?tab=generate`}>Go to generation</Link></div>;
  const sel = selEl != null ? slide.elements[selEl] : null;
  const block = sel?.blockId ? data.blocks.find((b) => b.id === sel.blockId) : null;
  const running = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="flex h-screen flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2 text-sm">
        <Link href={`/presentations/${presentationId}`} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</Link>
        <span className="font-medium truncate max-w-[280px]">{data.presentation.name}</span>
        <span className="text-xs text-ink-500">Slide {cur + 1} / {slides.length}</span>
        <div className="mx-2 h-5 w-px bg-ink-700" />
        <button className="btn-ghost btn-sm" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"><Undo2 size={14} /></button>
        <button className="btn-ghost btn-sm" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)"><Redo2 size={14} /></button>
        <button className="btn-secondary btn-sm" onClick={save} disabled={!dirty || saving}>{saving ? <Spinner /> : <Save size={14} />} {dirty ? "Save" : "Saved"}</button>
        <button className="btn-secondary btn-sm" onClick={() => setPreview(true)}><Play size={14} /> Preview</button>
        <div className="mx-2 h-5 w-px bg-ink-700" />
        <button className="btn-secondary btn-sm" disabled={!!running} onClick={() => regenerate(selectedIds)}><RefreshCw size={14} /> Regenerate {selectedIds.length > 1 ? `${selectedIds.length} slides` : "slide"}</button>
        <button className="btn-secondary btn-sm" disabled={!!running} onClick={regenerateAll}><RefreshCw size={14} /> Entire deck</button>
        <button className="btn-secondary btn-sm" onClick={() => { setStyleChoice(data.presentation.styleId || ""); setStyleModal(true); }}><Palette size={14} /> Change style</button>
        <div className="ml-auto flex items-center gap-2">
          {running && <span className="flex items-center gap-1 text-xs text-ink-400"><Spinner /> Regenerating…</span>}
          {msg && <span className="text-xs text-emerald-300">{msg}</span>}
          <span className="flex items-center gap-1 text-xs"><ShieldCheck size={13} className="text-ink-500" /><StatusBadge status={integrity ? (integrity.ok ? "verified" : "issues") : "unverified"} /></span>
          <Link href={`/presentations/${presentationId}?tab=export`} className="btn-primary btn-sm"><Download size={14} /> Export</Link>
        </div>
      </div>
      {error && <div className="px-3 pt-2"><Alert kind="error">{error} <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button></Alert></div>}
      <div className="flex flex-1 overflow-hidden">
        {/* thumbnails */}
        <aside className="w-56 flex-none overflow-auto border-r border-ink-700 bg-ink-900 p-2 space-y-2">
          <div className="flex gap-1"><button className="btn-ghost btn-sm" title="Add blank slide" onClick={addSlide}><Plus size={13} /></button><button className="btn-ghost btn-sm" title="Duplicate slide" onClick={duplicateSlide}><Copy size={13} /></button><button className="btn-ghost btn-sm" title="Delete slide(s)" onClick={deleteSlides}><Trash2 size={13} /></button><button className="btn-ghost btn-sm" onClick={() => moveSlide(cur, cur - 1)} title="Move up"><ChevronUp size={13} /></button><button className="btn-ghost btn-sm" onClick={() => moveSlide(cur, cur + 1)} title="Move down"><ChevronDown size={13} /></button></div>
          {slides.map((s, i) => (
            <div key={s.id || `new-${i}`} draggable onDragStart={() => { dragFrom.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragFrom.current != null) moveSlide(dragFrom.current, i); dragFrom.current = null; }}
              onClick={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) { const m = new Set(multi.size ? multi : [cur]); m.has(i) ? m.delete(i) : m.add(i); setMulti(m); } else { setMulti(new Set()); } setCur(i); setSelEl(null); }}
              className={`cursor-pointer rounded border-2 ${i === cur ? "border-accent" : multi.has(i) ? "border-accent/50" : "border-transparent hover:border-ink-600"}`}>
              <div className="flex items-center justify-between px-1 text-[10px] text-ink-500"><span>{i + 1}</span><span>{s.purpose}</span></div>
              <SlideView slide={s} />
            </div>
          ))}
        </aside>
        {/* canvas */}
        <div ref={canvasWrap} className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink-950 p-6" onMouseDown={() => setSelEl(null)}>
          <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }} className="relative shadow-2xl">
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CANVAS_W, height: CANVAS_H, position: "relative", overflow: "hidden", ...cssToObj(backgroundStyle(slide.background, (s) => s)) }}>
              {slide.elements.map((el, i) => <CanvasElement key={el.id || i} el={el} selected={selEl === i} onDown={(e, mode) => onDown(e, i, mode)} />)}
            </div>
          </div>
        </div>
        {/* properties */}
        <aside className="w-80 flex-none overflow-auto border-l border-ink-700 bg-ink-900 p-3 space-y-4 text-sm">
          <div className="flex gap-1"><button className="btn-secondary btn-sm" onClick={addText}><Type size={13} /> Text</button><button className="btn-secondary btn-sm" onClick={addShape}><Square size={13} /> Shape</button><button className="btn-secondary btn-sm" onClick={() => setPicker("add")}><ImageIcon size={13} /> Image</button></div>
          {!sel ? (
            <div className="space-y-3">
              <h3 className="section-title">Slide {cur + 1} · {slide.purpose}</h3>
              <label className="label">Background color</label><div className="flex gap-2"><input type="color" value={toHex(slide.background.color)} onChange={(e) => updateSlide((s) => { s.background = { ...s.background, color: e.target.value }; return s; })} /><input className="input" value={slide.background.color || ""} onChange={(e) => updateSlide((s) => { s.background = { ...s.background, color: e.target.value }; return s; })} /></div>
              <div className="flex gap-1"><button className="btn-secondary btn-sm" onClick={() => setPicker("background")}><ImageIcon size={13} /> Background image</button>{slide.background.imageSrc && <button className="btn-ghost btn-sm" onClick={() => updateSlide((s) => { s.background = { ...s.background, imageSrc: undefined, imageAssetId: undefined, generatedImageId: undefined }; return s; })}><X size={13} /> Remove</button>}</div>
              {slide.background.gradient && <p className="text-xs text-ink-500">Gradient: {slide.background.gradient} <button className="underline" onClick={() => updateSlide((s) => { s.background = { ...s.background, gradient: undefined }; return s; })}>remove</button></p>}
              <label className="label">Slide notes</label><textarea className="textarea min-h-[60px]" value={slide.notes || ""} onChange={(e) => updateSlide((s) => { s.notes = e.target.value; return s; })} />
              <div className="border-t border-ink-700 pt-3"><h3 className="section-title mb-2"><Layers size={12} className="inline mr-1" />Layers</h3><div className="space-y-0.5 max-h-72 overflow-auto">{[...slide.elements].map((e, i) => ({ e, i })).sort((a, b) => b.e.z - a.e.z).map(({ e, i }) => <button key={e.id || i} className="nav-link w-full text-xs py-1" onClick={() => setSelEl(i)}><span className="text-ink-500 w-10">{e.type}</span><span className="truncate">{e.type === "text" ? (e.props as TextProps).text.slice(0, 40) || "(empty)" : e.type === "image" || e.type === "logo" ? (e.props as ImageProps).src?.split("/").pop() || "placeholder" : (e.props as ShapeProps).shape}</span></button>)}</div></div>
              {integrity && !integrity.ok && <div className="border-t border-ink-700 pt-3 text-xs text-red-200">{integrity.issues.filter((i) => i.severity === "error").length} integrity error(s). See Export tab.</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="section-title">{sel.type} · {sel.origin.replace("_", " ")}</h3><button className="btn-ghost btn-sm" onClick={() => setSelEl(null)}><X size={13} /></button></div>
              {block && <div className="rounded border border-ink-700 bg-ink-800/60 p-2 text-xs text-ink-400">Source block {block.index + 1} ({block.kind}){sel.fragmentCount && sel.fragmentCount > 1 ? `, fragment ${(sel.fragmentIndex || 0) + 1}/${sel.fragmentCount}` : ""}. Editing the wording is your decision; the integrity check will report any difference from the source.</div>}
              <div className="grid grid-cols-4 gap-1">{(["x", "y", "w", "h"] as const).map((k) => <label key={k} className="text-xs"><span className="text-ink-500 uppercase">{k}</span><input type="number" className="input px-1.5 py-1" value={Math.round(sel[k])} onChange={(e) => updateEl({ [k]: Number(e.target.value) })} /></label>)}</div>
              <div className="flex gap-1"><button className="btn-secondary btn-sm" onClick={() => reorderZ(1)}>Bring forward</button><button className="btn-secondary btn-sm" onClick={() => reorderZ(-1)}>Send back</button><button className="btn-danger btn-sm ml-auto" onClick={deleteEl}><Trash2 size={13} /></button></div>
              {sel.type === "text" && <TextProperties p={sel.props as TextProps} onChange={updateProps} />}
              {(sel.type === "image" || sel.type === "logo") && <div className="space-y-2">
                <button className="btn-secondary btn-sm" onClick={() => setPicker("replace")}><ImageIcon size={13} /> Replace image</button>
                {sel.generatedImageId && <p className="text-xs text-ink-500">AI image slot · <Link className="text-accent" href={`/presentations/${presentationId}?tab=images`}>review / regenerate</Link></p>}
                <label className="label">Fit</label><select className="select" value={(sel.props as ImageProps).fit} onChange={(e) => updateProps({ fit: e.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option></select>
                <label className="label">Corner radius</label><input type="number" className="input" value={(sel.props as ImageProps).radius || 0} onChange={(e) => updateProps({ radius: Number(e.target.value) })} />
                <label className="label">Opacity</label><input type="range" min={0} max={1} step={0.05} value={(sel.props as ImageProps).opacity ?? 1} onChange={(e) => updateProps({ opacity: Number(e.target.value) })} />
              </div>}
              {sel.type === "shape" && <div className="space-y-2">
                <label className="label">Shape</label><select className="select" value={(sel.props as ShapeProps).shape} onChange={(e) => updateProps({ shape: e.target.value })}><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option></select>
                <label className="label">Fill</label><div className="flex gap-2"><input type="color" value={toHex((sel.props as ShapeProps).fill)} onChange={(e) => updateProps({ fill: e.target.value })} /><input className="input" value={(sel.props as ShapeProps).fill || ""} onChange={(e) => updateProps({ fill: e.target.value })} /></div>
                <label className="label">Stroke</label><input className="input" value={(sel.props as ShapeProps).stroke || ""} placeholder="none" onChange={(e) => updateProps({ stroke: e.target.value || undefined })} />
                <label className="label">Radius</label><input type="number" className="input" value={(sel.props as ShapeProps).radius || 0} onChange={(e) => updateProps({ radius: Number(e.target.value) })} />
                <label className="label">Opacity</label><input type="range" min={0} max={1} step={0.05} value={(sel.props as ShapeProps).opacity ?? 1} onChange={(e) => updateProps({ opacity: Number(e.target.value) })} />
              </div>}
            </div>
          )}
        </aside>
      </div>

      <AssetPicker open={picker !== null} onClose={() => setPicker(null)} onPick={(a) => (picker === "replace" ? replaceImage(a) : picker === "background" ? setBackgroundImage(a) : addImage(a))} />
      <Modal open={styleModal} onClose={() => setStyleModal(false)} title="Change visual style">
        <div className="space-y-3">
          <select className="select" value={styleChoice} onChange={(e) => setStyleChoice(e.target.value)}><option value="">— choose a style —</option>{data.styles.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isBuiltIn ? "" : " (custom)"}</option>)}</select>
          <Toggle on={styleScope === "all"} onChange={(b) => setStyleScope(b ? "all" : "slides")} label={styleScope === "all" ? "Apply to the entire presentation" : `Apply to ${selectedIds.length} selected slide(s) only`} description="Slides are re-laid out in the new style. Content, brand identity and approved images are preserved." />
          <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setStyleModal(false)}>Cancel</button><button className="btn-primary" disabled={!styleChoice} onClick={changeStyle}>Apply style</button></div>
        </div>
      </Modal>
      {preview && <Preview slides={slides} start={cur} onClose={() => setPreview(false)} />}
    </div>
  );
}

function CanvasElement({ el, selected, onDown }: { el: ElementModel; selected: boolean; onDown: (e: React.MouseEvent, mode: "move" | "resize") => void }) {
  const base: React.CSSProperties = { position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, outline: selected ? "3px solid #e8c66b" : undefined, cursor: "move", boxSizing: "border-box" };
  let inner: React.ReactNode = null;
  if (el.type === "text") {
    const p = el.props as TextProps;
    const st: React.CSSProperties = { fontFamily: fontStack(p.fontFamily), fontSize: p.fontSize, fontWeight: p.fontWeight, color: p.color, textAlign: p.align, direction: p.dir, lineHeight: p.lineHeight, letterSpacing: p.letterSpacing || 0, textTransform: p.textTransform || "none", fontStyle: p.italic ? "italic" : "normal", opacity: p.opacity ?? 1, display: "flex", flexDirection: "column", justifyContent: p.valign === "middle" ? "center" : p.valign === "bottom" ? "flex-end" : "flex-start", width: "100%", height: "100%" };
    inner = <div style={st} lang={p.lang === "ar" ? "ar" : undefined} dir={p.dir}>{p.bullet ? <div style={{ display: "flex", gap: "0.6em", alignItems: "flex-start" }}><span style={{ flex: "none" }}>{p.bulletChar || ""}</span><span style={{ whiteSpace: "pre-wrap", unicodeBidi: "plaintext" }}>{p.text}</span></div> : <span style={{ whiteSpace: "pre-wrap", unicodeBidi: "plaintext", display: "block" }}>{p.text || (selected ? "" : "")}</span>}</div>;
  } else if (el.type === "shape") {
    const p = el.props as ShapeProps;
    inner = <div style={{ width: "100%", height: "100%", background: p.gradient || p.fill, border: p.stroke ? `${p.strokeWidth || 1}px solid ${p.stroke}` : undefined, borderRadius: p.shape === "ellipse" ? "50%" : p.radius || 0, opacity: p.opacity ?? 1, boxSizing: "border-box" }} />;
  } else {
    const p = el.props as ImageProps;
    inner = p.src ? <img src={p.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: p.fit, filter: p.cssFilter, borderRadius: p.radius || 0, opacity: p.opacity ?? 1, display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(45deg,rgba(128,128,128,0.12) 0 12px,rgba(128,128,128,0.22) 12px 24px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 22, borderRadius: p.radius || 0 }}>{p.concept ? "AI image pending" : "Image"}</div>;
  }
  return <div style={base} onMouseDown={(e) => onDown(e, "move")}>{inner}{selected && <div onMouseDown={(e) => onDown(e, "resize")} style={{ position: "absolute", right: -8, bottom: -8, width: 18, height: 18, background: "#e8c66b", cursor: "nwse-resize", borderRadius: 3 }} />}</div>;
}

function TextProperties({ p, onChange }: { p: TextProps; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <label className="label">Text</label><textarea className="textarea min-h-[100px]" dir={p.dir} lang={p.lang === "ar" ? "ar" : undefined} value={p.text} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs"><span className="text-ink-500">Font</span><select className="select" value={p.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>{["Inter", "Cairo", "Georgia", "Arial", "Helvetica", "Times New Roman"].includes(p.fontFamily) ? null : <option value={p.fontFamily}>{p.fontFamily}</option>}<option>Inter</option><option>Cairo</option><option>Georgia</option><option>Arial</option><option>Helvetica</option><option>Times New Roman</option></select></label>
        <label className="text-xs"><span className="text-ink-500">Size (px)</span><input type="number" className="input" value={p.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} /></label>
        <label className="text-xs"><span className="text-ink-500">Weight</span><select className="select" value={p.fontWeight} onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}>{[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
        <label className="text-xs"><span className="text-ink-500">Line height</span><input type="number" step={0.05} className="input" value={p.lineHeight} onChange={(e) => onChange({ lineHeight: Number(e.target.value) })} /></label>
        <label className="text-xs"><span className="text-ink-500">Align</span><select className="select" value={p.align} onChange={(e) => onChange({ align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label className="text-xs"><span className="text-ink-500">Direction</span><select className="select" value={p.dir} onChange={(e) => onChange({ dir: e.target.value, lang: e.target.value === "rtl" ? "ar" : p.lang === "ar" ? "en" : p.lang })}><option value="ltr">LTR</option><option value="rtl">RTL</option></select></label>
        <label className="text-xs"><span className="text-ink-500">Vertical</span><select className="select" value={p.valign || "top"} onChange={(e) => onChange({ valign: e.target.value })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
        <label className="text-xs"><span className="text-ink-500">Transform</span><select className="select" value={p.textTransform || "none"} onChange={(e) => onChange({ textTransform: e.target.value })}><option value="none">None</option><option value="uppercase">Uppercase (visual only)</option></select></label>
      </div>
      <label className="label">Color</label><div className="flex gap-2"><input type="color" value={toHex(p.color)} onChange={(e) => onChange({ color: e.target.value })} /><input className="input" value={p.color} onChange={(e) => onChange({ color: e.target.value })} /></div>
      <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!p.bullet} onChange={(e) => onChange({ bullet: e.target.checked, bulletChar: e.target.checked ? p.bulletChar || "•" : undefined })} /> Bullet</label>
      <label className="text-xs"><span className="text-ink-500">Letter spacing</span><input type="number" className="input" value={p.letterSpacing || 0} onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })} /></label>
    </div>
  );
}

function Preview({ slides, start, onClose }: { slides: SlideModel[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === " ") setI((x) => Math.min(slides.length - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [slides.length]);
  const w = typeof window !== "undefined" ? Math.min(window.innerWidth, (window.innerHeight * 16) / 9) : 1280;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}><SlideView slide={slides[i]} width={w} /><button className="absolute right-4 top-4 btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>Close (Esc)</button><span className="absolute bottom-4 right-4 text-xs text-ink-400">{i + 1} / {slides.length}</span></div>;
}

function toHex(c?: string) { if (!c) return "#000000"; if (/^#[0-9a-f]{6}$/i.test(c)) return c; const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`; if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`; return "#000000"; }
function textColorFor(s: SlideModel) { const first = s.elements.find((e) => e.type === "text" && (e.props as TextProps).role === "body"); return first ? (first.props as TextProps).color : "#ffffff"; }
function cssToObj(css: string): React.CSSProperties { const o: Record<string, string> = {}; for (const part of css.split(";")) { const i = part.indexOf(":"); if (i < 0) continue; const k = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()); o[k] = part.slice(i + 1).trim(); } return o as React.CSSProperties; }
