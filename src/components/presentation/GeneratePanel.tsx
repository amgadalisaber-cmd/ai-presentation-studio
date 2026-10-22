"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Columns3, Check, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { Alert, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { SlideView } from "@/components/slide/SlideView";
import type { SlideModel } from "@/lib/types";

type Style = { id: string; name: string; isBuiltIn: boolean; description?: string | null };
type Job = { id: string; kind: string; status: string; error?: string | null; result?: { logs?: string[] } | null; createdAt: string };
type Proposal = { id: string; order: number; selected: boolean; slides: SlideModel[]; style: { id: string; name: string; description?: string | null } };

export function GeneratePanel({ presentation, styles, proposals, jobs }: { presentation: { id: string; styleId: string | null; threeStyleMode: boolean; aiImages: boolean; status: string; blocks: number; slides: number; customDirection?: string | null }; styles: Style[]; proposals: Proposal[]; jobs: Job[] }) {
  const router = useRouter();
  const [three, setThree] = useState(presentation.threeStyleMode);
  const [styleId, setStyleId] = useState(presentation.styleId || "");
  const [pick, setPick] = useState<string[]>(() => { const ids = presentation.styleId ? [presentation.styleId] : []; for (const n of ["Cinematic", "Bold Editorial", "Modern Minimal", "Corporate Premium"]) { const s = styles.find((x) => x.name === n); if (s && ids.length < 3 && !ids.includes(s.id)) ids.push(s.id); } return ids; });
  const [aiImages, setAiImages] = useState(presentation.aiImages);
  const [job, setJob] = useState<Job | null>(jobs.find((j) => j.status === "queued" || j.status === "running") || null);
  const [error, setError] = useState<string | null>(null); const [askDefault, setAskDefault] = useState(false); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const t = setInterval(async () => { const j = await api<Job>(`/api/jobs/${job.id}`); setJob(j); if (j.status === "completed" || j.status === "failed") { clearInterval(t); router.refresh(); } }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status, router]);

  const start = async (useDefaultStyle = false) => {
    setBusy(true); setError(null); setAskDefault(false);
    try {
      await api(`/api/presentations/${presentation.id}`, { method: "PATCH", json: { aiImages, threeStyleMode: three, styleId: styleId || null } });
      const j = await api<Job>(`/api/presentations/${presentation.id}/generate`, { method: "POST", json: three ? { mode: "three", styleIds: pick.length === 3 ? pick : undefined } : { mode: "direct", styleId: styleId || null, useDefaultStyle } });
      setJob(j); router.refresh();
    } catch (e) { const err = e as { status?: number; message: string }; if (err.status === 422) setAskDefault(true); else setError(err.message); } finally { setBusy(false); }
  };
  const select = async (proposalId: string) => { setBusy(true); setError(null); try { const j = await api<Job>(`/api/presentations/${presentation.id}/proposals/select`, { method: "POST", json: { proposalId } }); setJob(j); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const running = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="space-y-6">
      {presentation.blocks === 0 && <Alert kind="warn">This presentation has no content yet. Add content in the Setup tab before generating.</Alert>}
      <div className="card-pad space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <Toggle on={three} onChange={setThree} label="Mode A — Generate three style examples" description="Representative slides in three distinct directions, compared side by side. Then pick one and generate the rest." />
            {three && <div className="space-y-2"><p className="label">Three directions to compare</p>{[0, 1, 2].map((i) => <select key={i} className="select" value={pick[i] || ""} onChange={(e) => { const n = [...pick]; n[i] = e.target.value; setPick(n); }}><option value="">Auto-pick</option>{styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>)}<p className="text-xs text-ink-500">Leave as auto-pick to let the studio choose three meaningfully different directions.</p></div>}
            {!three && <div className="space-y-2"><p className="label">Mode B — Generate directly with</p><select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}><option value="">— choose a saved style —</option>{styles.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isBuiltIn ? "" : " (custom)"}</option>)}</select>{styleId && <p className="text-xs text-ink-500">{styles.find((s) => s.id === styleId)?.description}</p>}{presentation.customDirection && <p className="text-xs text-ink-400">Custom direction: “{presentation.customDirection}”</p>}</div>}
          </div>
          <div className="space-y-4">
            <Toggle on={aiImages} onChange={setAiImages} label={`AI-generated images: ${aiImages ? "ON" : "OFF"}`} description={aiImages ? "Slides that benefit from imagery get a Nano Banana Pro image request for review. Text never goes inside images." : "No AI images. Approved uploaded assets of the primary client are used where a layout has an image slot."} />
            <div className="rounded-md border border-ink-700 bg-ink-800/50 p-3 text-xs text-ink-400 space-y-1"><p><strong className="text-ink-200">Content preservation:</strong> wording, numbers, punctuation and order are kept exactly; the engine only positions, sizes, splits across slides and styles your text. Every result is verified against the immutable source.</p>{presentation.slides > 0 && <p className="text-amber-200/90">Generating again replaces the current {presentation.slides} slides (and their generated images). Use the editor's per-slide regeneration to keep the rest.</p>}</div>
          </div>
        </div>
        {askDefault && <Alert kind="warn"><div className="flex flex-wrap items-center gap-3"><span>No visual style is selected. Use <strong>Modern Minimal</strong> as the default direction?</span><button className="btn-primary btn-sm" onClick={() => start(true)}>Yes, use Modern Minimal</button><button className="btn-secondary btn-sm" onClick={() => setAskDefault(false)}>No, I'll choose</button></div></Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy || !!running || presentation.blocks === 0} onClick={() => start()}>{three ? <Columns3 size={16} /> : <Sparkles size={16} />}{three ? "Generate three examples" : presentation.slides ? "Regenerate entire presentation" : "Generate presentation"}</button>
          {presentation.slides > 0 && <Link href={`/presentations/${presentation.id}/editor`} className="btn-secondary">Open editor ({presentation.slides} slides)</Link>}
        </div>
      </div>

      {job && (
        <div className="card-pad space-y-2">
          <div className="flex items-center gap-2 text-sm">{running ? <Spinner /> : null}<span className="font-medium">{job.kind === "three_styles" ? "Three-style comparison" : job.kind === "full" ? "Full generation" : "Slide regeneration"}</span><StatusBadge status={job.status} /><span className="text-xs text-ink-500">{new Date(job.createdAt).toLocaleTimeString()}</span></div>
          {job.result?.logs && <ul className="text-xs text-ink-400 space-y-0.5">{job.result.logs.map((l, i) => <li key={i}>· {l}</li>)}</ul>}
          {job.error && <Alert kind="error">{job.error} <button className="underline ml-2" onClick={() => start()}><RefreshCw size={12} className="inline" /> Retry</button></Alert>}
          {job.status === "completed" && job.kind === "full" && <Link href={`/presentations/${presentation.id}/editor`} className="btn-primary btn-sm mt-2">Review in editor</Link>}
        </div>
      )}

      {proposals.length > 0 && (
        <div className="space-y-3">
          <div><h3 className="h2">Compare the three directions</h3><p className="muted text-sm">Same content, same brands — three different compositions, type treatments and image approaches. Select one to generate the full presentation.</p></div>
          <div className="grid gap-4 lg:grid-cols-3">
            {proposals.map((p) => (
              <div key={p.id} className={`card overflow-hidden ${p.selected ? "border-accent" : ""}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700"><div><div className="font-medium">{p.style.name}</div><div className="text-xs text-ink-500 line-clamp-2">{p.style.description}</div></div>{p.selected ? <span className="badge-completed"><Check size={12} className="mr-1" />Selected</span> : <button className="btn-primary btn-sm" disabled={busy || !!running} onClick={() => select(p.id)}>Select</button>}</div>
                <div className="p-3 space-y-2 bg-ink-950">{p.slides.map((s, i) => <SlideView key={i} slide={s} className="rounded border border-ink-700" />)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
