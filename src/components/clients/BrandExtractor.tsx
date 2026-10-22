"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, Wand2 } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";

/** Upload guidelines / logos / any document, or enter a website, and the brand is filled in automatically. */
export function BrandExtractor({ companyId, compact }: { companyId: string; compact?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]); const [website, setWebsite] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<{ applied: string[]; notes: string[] } | null>(null); const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!files.length && !website.trim()) { setError("Add files or a website first."); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData(); for (const f of files) fd.append("files", f); if (website.trim()) fd.append("website", website.trim());
      const res = await fetch(`/api/companies/${companyId}/extract`, { method: "POST", body: fd }); const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Extraction failed");
      setResult(j); setFiles([]); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={`card ${compact ? "p-4" : "p-5"} space-y-3 border-accent/40 bg-accent-soft/20`}>
      <div className="flex items-center gap-2"><Wand2 size={16} className="text-accent-dim" /><h3 className="font-semibold">Build this brand automatically</h3></div>
      <p className="text-sm text-ink-400">Drop in brand guidelines (PDF, Word, PowerPoint), logos or any images, or enter the website. Logo, colors, fonts, description and rules are filled in for you — then change or remove anything.</p>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <label className={`flex min-h-[72px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 text-sm ${files.length ? "border-accent bg-white" : "border-ink-600 bg-white/60 hover:border-accent-light"}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}>
          <input type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.svg,.gif" onChange={(e) => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
          <span className="flex items-center gap-2 text-ink-300"><Upload size={16} />{files.length ? `${files.length} file(s): ${files.map((f) => f.name).join(", ").slice(0, 80)}` : "Drop files here or click to choose (guidelines, logos, images)"}</span>
        </label>
        <div className="flex items-center gap-2"><Globe size={16} className="text-ink-400" /><input className="input w-56" placeholder="brand-website.com" value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy} onClick={run}>{busy ? <Spinner /> : <Wand2 size={14} />} {busy ? "Extracting…" : "Extract & apply"}</button>{files.length > 0 && <button className="btn-ghost btn-sm" onClick={() => setFiles([])}>Clear files</button>}</div>
      {error && <Alert kind="error">{error}</Alert>}
      {result && <Alert kind="success"><div className="space-y-1"><div className="font-medium">Applied to the brand:</div>{result.applied.length ? <ul className="text-sm list-disc list-inside">{result.applied.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p className="text-sm">Nothing new was found.</p>}{result.notes.length > 0 && <ul className="text-xs opacity-80 list-disc list-inside">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}<p className="text-xs opacity-80">Review the Profile, Assets and Brand rules tabs to change or remove anything.</p></div></Alert>}
    </div>
  );
}
