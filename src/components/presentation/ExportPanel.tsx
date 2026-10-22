"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileDown, ShieldCheck } from "lucide-react";
import { api, fmtBytes, fmtDate } from "@/lib/client";
import { Alert, Spinner, StatusBadge } from "@/components/ui";
import { IntegrityView } from "./IntegrityView";
import type { IntegrityReport } from "@/lib/content/verify";

type ExportJob = { id: string; formats: string[]; status: string; verified: boolean; warnings: string[]; error?: string | null; integrity?: IntegrityReport | null; createdAt: string; files: { id: string; format: string; fileName: string; size: number }[] };

export function ExportPanel({ presentationId, slides, integrityReport, integrityStatus }: { presentationId: string; slides: number; integrityReport: IntegrityReport | null; integrityStatus: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<"pptx" | "pdf" | "both">("both");
  const [jobs, setJobs] = useState<ExportJob[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [report, setReport] = useState<IntegrityReport | null>(integrityReport);
  const load = async () => setJobs(await api(`/api/presentations/${presentationId}/export-jobs`));
  useEffect(() => { load(); }, [presentationId]);
  useEffect(() => { if (!jobs.some((j) => ["queued", "checking", "running"].includes(j.status))) return; const t = setInterval(load, 1500); return () => clearInterval(t); }, [jobs]);
  const check = async () => { setBusy(true); setError(null); try { setReport(await api(`/api/presentations/${presentationId}/integrity`, { method: "POST" })); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const start = async () => {
    setBusy(true); setError(null);
    try { await api(`/api/presentations/${presentationId}/export`, { method: "POST", json: { formats: choice === "both" ? ["pptx", "pdf"] : [choice] } }); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <div className="card-pad space-y-4">
        <div className="flex items-start justify-between gap-4"><div><h3 className="h2">Content integrity</h3><p className="muted text-sm">The export pipeline re-verifies every rendered text element against the immutable source and validates rendering (overflow, images) before producing files.</p></div><button className="btn-secondary btn-sm" disabled={busy || slides === 0} onClick={check}><ShieldCheck size={14} /> Run check now</button></div>
        <IntegrityView report={report} />
        {integrityStatus === "issues" && <p className="text-xs text-amber-200/90">Exports still run, but the files are marked <em>not verified</em> until the discrepancies above are resolved (regenerate the affected slides or restore the text in the editor).</p>}
      </div>
      <div className="card-pad space-y-4">
        <h3 className="h2">Export</h3>
        {slides === 0 && <Alert kind="warn">Generate the presentation first.</Alert>}
        <div className="grid gap-3 md:grid-cols-3">
          {([["pptx", "PowerPoint (.pptx)", "Editable text boxes, separate images and shapes, correct Arabic (RTL) text runs."], ["pdf", "PDF (.pdf)", "High-quality vector pages with selectable text and embedded fonts; opens in Illustrator."], ["both", "Both formats", "Generates both files; separate downloads."]] as const).map(([k, title, desc]) => <button key={k} type="button" onClick={() => setChoice(k)} className={`card p-4 text-left hover:border-ink-500 ${choice === k ? "border-accent ring-1 ring-accent/40" : ""}`}><div className="font-medium">{title}</div><div className="mt-1 text-xs text-ink-400">{desc}</div></button>)}
        </div>
        <div className="text-xs text-ink-500 space-y-1">
          <p><strong className="text-ink-300">Known limitations:</strong> PPTX files reference fonts (Inter, Cairo) but cannot embed them — install them on the viewing machine for identical rendering. Gradient/overlay backgrounds are rasterized to a background image in PPTX (all text, logos and shapes stay editable). Uppercase heading styling is not applied in PPTX so the stored wording stays exact. CSS image filters are PDF-only.</p>
          <p>PDF text is real text with embedded font subsets; Illustrator editability depends on its font matching — install the same fonts for best results. Effects such as transparency overlays become separate objects.</p>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <button className="btn-primary" disabled={busy || slides === 0 || jobs.some((j) => ["queued", "checking", "running"].includes(j.status))} onClick={start}><FileDown size={16} /> Check & export {choice === "both" ? "PowerPoint + PDF" : choice.toUpperCase()}</button>
      </div>
      <div className="space-y-2">
        <h3 className="section-title">Export history</h3>
        {jobs.length === 0 && <p className="text-sm text-ink-500">No exports yet.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="card p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">{["queued", "checking", "running"].includes(j.status) && <Spinner />}<span className="font-medium">{(j.formats || []).map((f) => f.toUpperCase()).join(" + ")}</span><StatusBadge status={j.status} />{j.status === "completed" && <span className={j.verified ? "badge-verified" : "badge-issues"}>{j.verified ? "Content verified" : "Not verified"}</span>}<span className="text-xs text-ink-500">{fmtDate(j.createdAt)}</span></div>
            {j.status === "checking" && <p className="text-xs text-ink-400">Running content-integrity check and render validation…</p>}
            {j.status === "running" && <p className="text-xs text-ink-400">Generating files…</p>}
            {j.error && <Alert kind="error">{j.error}</Alert>}
            {j.warnings?.length > 0 && <details className="text-xs"><summary className="cursor-pointer text-amber-200">{j.warnings.length} warning(s) — review before sharing</summary><ul className="mt-1 space-y-0.5 text-ink-400">{j.warnings.map((w, i) => <li key={i}>· {w}</li>)}</ul></details>}
            {j.files.length > 0 && <div className="flex flex-wrap gap-2">{j.files.map((f) => <a key={f.id} href={`/api/files/export/${f.id}`} className="btn-secondary btn-sm"><Download size={13} /> {f.fileName} <span className="text-ink-500">({fmtBytes(f.size)})</span></a>)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
