"use client";
import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Modal, Field, Alert, Spinner } from "@/components/ui";

export type FontOption = { family: string; source: "bundled" | "uploaded" | "system"; weights: number[]; supportsArabic: boolean };
let cache: FontOption[] | null = null; const listeners = new Set<(f: FontOption[]) => void>();
export async function loadFonts(force = false) { if (!cache || force) { const r = await api<{ options: FontOption[] }>("/api/fonts"); cache = r.options; listeners.forEach((l) => l(cache!)); } return cache; }
export function useFonts() { const [fonts, setFonts] = useState<FontOption[]>(cache || []); useEffect(() => { listeners.add(setFonts); loadFonts().then(setFonts); return () => { listeners.delete(setFonts); }; }, []); return fonts; }

/** Font family picker: bundled + uploaded + system fonts, with inline upload. */
export function FontSelect({ value, onChange, arabic, disabled, className }: { value: string; onChange: (family: string) => void; arabic?: boolean; disabled?: boolean; className?: string }) {
  const fonts = useFonts(); const [open, setOpen] = useState(false);
  const groups: [string, FontOption[]][] = [["Bundled (embedded in PDF)", fonts.filter((f) => f.source === "bundled")], ["Uploaded (embedded in PDF)", fonts.filter((f) => f.source === "uploaded")], ["System (must be installed on the viewing machine)", fonts.filter((f) => f.source === "system")]];
  return (
    <div className={`flex gap-1 ${className || ""}`}>
      <select className="select" disabled={disabled} value={value} onChange={(e) => { if (e.target.value === "__upload") { setOpen(true); return; } onChange(e.target.value); }} style={{ fontFamily: `'${value}', sans-serif` }}>
        {value && !fonts.some((f) => f.family === value) && <option value={value}>{value}</option>}
        {groups.map(([label, list]) => list.length ? <optgroup key={label} label={label}>{list.map((f) => <option key={f.family} value={f.family} style={{ fontFamily: `'${f.family}'` }}>{f.family}{f.supportsArabic ? " · عربي" : arabic ? " (no Arabic)" : ""}</option>)}</optgroup> : null)}
        <option value="__upload">⤒ Upload a font…</option>
      </select>
      <FontUploadModal open={open} onClose={() => setOpen(false)} onUploaded={(family) => { onChange(family); setOpen(false); }} />
    </div>
  );
}

export function FontUploadModal({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: (family: string) => void }) {
  const [file, setFile] = useState<File | null>(null); const [family, setFamily] = useState(""); const [weight, setWeight] = useState(400); const [style, setStyle] = useState("normal"); const [ar, setAr] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!file) return; setBusy(true); setError(null);
    try { const f = await upload<{ family: string }>("/api/fonts", { file, family: family || undefined, weight: String(weight), style, supportsArabic: String(ar) }); await loadFonts(true); onUploaded(f.family); setFile(null); setFamily(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Upload a font">
      <div className="space-y-3">
        {error && <Alert kind="error">{error}</Alert>}
        <label className="btn-secondary cursor-pointer"><Upload size={14} /> {file ? file.name : "Choose .ttf / .otf / .woff / .woff2"}<input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f && !family) setFamily(f.name.replace(/\.[^.]+$/, "").replace(/[-_](regular|bold|light|medium|semibold|black|italic)$/i, "")); }} /></label>
        <Field label="Family name" hint="Upload each weight/style of the same family under the same name."><input className="input" value={family} onChange={(e) => setFamily(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Weight"><select className="select" value={weight} onChange={(e) => setWeight(Number(e.target.value))}>{[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}</select></Field><Field label="Style"><select className="select" value={style} onChange={(e) => setStyle(e.target.value)}><option value="normal">Normal</option><option value="italic">Italic</option></select></Field></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ar} onChange={(e) => setAr(e.target.checked)} /> Supports Arabic script</label>
        <p className="text-xs text-ink-500">Uploaded fonts render in the editor and are embedded in PDF exports. PowerPoint references the family name; install the font on the viewing machine. Make sure you hold a licence that allows embedding.</p>
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!file || busy} onClick={submit}>{busy ? <Spinner /> : null} Upload</button></div>
      </div>
    </Modal>
  );
}

export function FontManager() {
  const [data, setData] = useState<{ uploaded: { id: string; family: string; weight: number; style: string; fileName: string; supportsArabic: boolean; size: number }[] } | null>(null); const [open, setOpen] = useState(false);
  const load = async () => setData(await api("/api/fonts"));
  useEffect(() => { load(); }, []);
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm text-ink-400">Bundled: Inter, Cairo (Arabic). Upload brand fonts to use them in styles, client profiles and the editor.</p><button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Upload size={13} /> Upload font</button></div>
      {!data ? <Spinner /> : data.uploaded.length === 0 ? <p className="text-sm text-ink-500">No uploaded fonts yet.</p> : (
        <div className="divide-y divide-ink-700">{data.uploaded.map((f) => <div key={f.id} className="flex items-center justify-between py-2 text-sm"><span><span style={{ fontFamily: `'${f.family}'` }} className="text-lg">{f.family}</span><span className="ml-2 text-xs text-ink-500">{f.weight} {f.style} · {f.fileName}{f.supportsArabic ? " · Arabic" : ""}</span><span className="ml-3 text-base" style={{ fontFamily: `'${f.family}'` }}>Aa Bb — {f.supportsArabic ? "أبجد هوز" : "0123"}</span></span><button className="btn-ghost btn-sm text-red-300" onClick={async () => { if (confirm(`Delete font ${f.family} ${f.weight}?`)) { await api(`/api/fonts/${f.id}`, { method: "DELETE" }); await loadFonts(true); load(); } }}>Delete</button></div>)}</div>
      )}
      <FontUploadModal open={open} onClose={() => setOpen(false)} onUploaded={() => { setOpen(false); load(); }} />
    </div>
  );
}
