"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Check, X } from "lucide-react";
import { api, upload, fmtBytes } from "@/lib/client";
import { Alert, Spinner } from "@/components/ui";

export const ASSET_KINDS: [string, string][] = [["primary_logo", "Primary logo"], ["secondary_logo", "Secondary logo"], ["logo_variation", "Logo variation"], ["icon", "Icon"], ["product_image", "Product image"], ["photo", "Approved photograph"], ["reference_presentation", "Reference presentation"], ["guideline_doc", "Brand guidelines document"], ["font", "Font file"], ["document", "Document"], ["style_reference", "Style reference"], ["other", "Other"]];
export type Asset = { id: string; name: string; kind: string; mimeType: string; size: number; width?: number | null; height?: number | null; approved: boolean; notes?: string | null; company?: { id: string; name: string } | null; companyId?: string | null; createdAt: string };

export function AssetManager({ assets, companyId, showCompany }: { assets: Asset[]; companyId?: string; showCompany?: boolean }) {
  const router = useRouter(); const [kind, setKind] = useState(companyId ? "primary_logo" : "photo"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [filter, setFilter] = useState("");
  const up = async (files: FileList) => { setBusy(true); setError(null); try { for (const f of Array.from(files)) await upload("/api/assets", { file: f, kind, companyId, name: f.name }); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const patch = async (id: string, data: Record<string, unknown>) => { try { await api(`/api/assets/${id}`, { method: "PATCH", json: data }); router.refresh(); } catch (e) { setError((e as Error).message); } };
  const del = async (a: Asset) => { if (!confirm(`Delete "${a.name}"?`)) return; await api(`/api/assets/${a.id}`, { method: "DELETE" }); router.refresh(); };
  const list = assets.filter((a) => !filter || a.kind === filter);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><select className="select w-56" value={kind} onChange={(e) => setKind(e.target.value)}>{ASSET_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><label className="btn-primary btn-sm cursor-pointer">{busy ? <Spinner /> : <Upload size={14} />} Upload files<input type="file" multiple className="hidden" onChange={(e) => e.target.files && up(e.target.files)} /></label><span className="text-xs text-ink-500">PNG, JPG, WEBP, SVG, PDF, PPTX, DOCX, TTF/OTF · 50 MB max</span><select className="select w-44 ml-auto" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All kinds</option>{ASSET_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      {error && <Alert kind="error">{error}</Alert>}
      {list.length === 0 && <p className="text-sm text-ink-500">No assets yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((a) => (
          <div key={a.id} className={`card overflow-hidden ${a.approved ? "" : "opacity-60"}`}>
            <div className="aspect-video bg-[repeating-conic-gradient(#1a1b22_0_25%,#121217_0_50%)] bg-[length:16px_16px] flex items-center justify-center">{a.mimeType.startsWith("image/") ? <img src={`/api/files/asset/${a.id}`} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-ink-400 uppercase">{a.mimeType.split("/").pop()?.slice(0, 12)}</span>}</div>
            <div className="p-2.5 space-y-1.5 text-xs">
              <div className="truncate font-medium text-sm" title={a.name}>{a.name}</div>
              <div className="text-ink-500">{fmtBytes(a.size)}{a.width ? ` · ${a.width}×${a.height}` : ""}{showCompany && a.company ? ` · ${a.company.name}` : ""}</div>
              <select className="select py-1" value={a.kind} onChange={(e) => patch(a.id, { kind: e.target.value })}>{ASSET_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <div className="flex gap-1"><button className={`btn-sm ${a.approved ? "btn-secondary" : "btn-primary"}`} onClick={() => patch(a.id, { approved: !a.approved })}>{a.approved ? <><X size={12} /> Unapprove</> : <><Check size={12} /> Approve</>}</button><button className="btn-ghost btn-sm ml-auto" onClick={() => del(a)}><Trash2 size={12} /></button></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
