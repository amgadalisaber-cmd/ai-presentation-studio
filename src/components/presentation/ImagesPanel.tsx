"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, Upload, X } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Alert, StatusBadge, Spinner } from "@/components/ui";

type Img = { id: string; prompt: string; concept?: string | null; status: string; error?: string | null; storagePath?: string | null; model?: string | null; attempts: number; slide?: { id: string; index: number; purpose: string } | null; updatedAt: string };
type Provider = { configured: boolean; provider: string; model: string };

export function ImagesPanel({ presentationId, aiImages }: { presentationId: string; aiImages: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{ provider: Provider; images: Img[] } | null>(null); const [error, setError] = useState<string | null>(null); const [editing, setEditing] = useState<string | null>(null); const [concept, setConcept] = useState("");
  const load = async () => setData(await api(`/api/presentations/${presentationId}/images`));
  useEffect(() => { load(); const t = setInterval(() => { load(); }, 3000); return () => clearInterval(t); }, [presentationId]);
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); router.refresh(); } catch (e) { setError((e as Error).message); } };
  if (!data) return <Spinner />;
  const pending = data.images.filter((i) => i.status === "pending" || i.status === "generating").length;
  return (
    <div className="space-y-4">
      {!aiImages && <Alert kind="info">AI-generated images are <strong>OFF</strong> for this presentation. Turn them on in the Generate tab before generating to request imagery.</Alert>}
      {!data.provider.configured && <Alert kind="warn"><strong>Nano Banana Pro setup required.</strong> Set <code>GEMINI_API_KEY</code> on the server (see Settings & Integrations). Image requests are queued and will fail until the key is configured; nothing is simulated.</Alert>}
      {data.provider.configured && <p className="text-xs text-ink-500">Provider: {data.provider.provider} · model {data.provider.model}{pending ? ` · ${pending} in progress` : ""}</p>}
      {error && <Alert kind="error">{error}</Alert>}
      {data.images.length === 0 && <p className="text-sm text-ink-500">No image requests yet.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.images.map((img) => (
          <div key={img.id} className="card overflow-hidden flex flex-col">
            <div className="aspect-video bg-ink-800 flex items-center justify-center">{img.storagePath ? <img src={`/api/files/generated/${img.id}?t=${new Date(img.updatedAt).getTime()}`} alt="" className="h-full w-full object-cover" /> : img.status === "generating" || img.status === "pending" ? <span className="flex items-center gap-2 text-xs text-ink-400"><Spinner /> {img.status === "generating" ? "Generating…" : "Queued"}</span> : <span className="text-xs text-ink-500">No image</span>}</div>
            <div className="p-3 space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between"><span className="font-medium text-sm">Slide {img.slide ? img.slide.index + 1 : "—"} <span className="text-ink-500">· {img.slide?.purpose}</span></span><StatusBadge status={img.status} /></div>
              <p className="text-ink-300 line-clamp-2"><span className="text-ink-500">Concept:</span> {img.concept}</p>
              <details><summary className="cursor-pointer text-ink-500">Prompt</summary><p className="mt-1 text-ink-400 whitespace-pre-wrap">{img.prompt}</p></details>
              {img.error && <p className="text-red-300">{img.error}</p>}
              {editing === img.id && <div className="space-y-1"><textarea className="textarea min-h-[60px]" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Describe a new visual concept (no text in image)…" /><div className="flex gap-1"><button className="btn-primary btn-sm" onClick={() => act(async () => { await api(`/api/images/${img.id}/regenerate`, { method: "POST", json: { concept } }); setEditing(null); })}>Regenerate with concept</button><button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button></div></div>}
            </div>
            <div className="flex flex-wrap gap-1 border-t border-ink-700 p-2">
              <button className="btn-secondary btn-sm" disabled={img.status === "generating" || img.status === "pending"} onClick={() => act(() => api(`/api/images/${img.id}/regenerate`, { method: "POST", json: {} }))}><RefreshCw size={12} /> Regenerate</button>
              <button className="btn-secondary btn-sm" onClick={() => { setEditing(img.id); setConcept(img.concept || ""); }}>Edit concept</button>
              <label className="btn-secondary btn-sm cursor-pointer"><Upload size={12} /> Replace<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && act(() => upload(`/api/images/${img.id}/replace`, { file: e.target.files![0] }))} /></label>
              {img.storagePath && img.status !== "approved" && <button className="btn-primary btn-sm" onClick={() => act(() => api(`/api/images/${img.id}/approve`, { method: "POST" }))}><Check size={12} /> Approve</button>}
              {img.status !== "rejected" && <button className="btn-ghost btn-sm" onClick={() => act(() => api(`/api/images/${img.id}/reject`, { method: "POST" }))}><X size={12} /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
