"use client";
import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { api, upload } from "@/lib/client";
import { Modal, Spinner } from "@/components/ui";
type Asset = { id: string; name: string; kind: string; mimeType: string; width?: number | null; height?: number | null; company?: { name: string } | null };
export function AssetPicker({ open, onClose, onPick, companyFilter }: { open: boolean; onClose: () => void; onPick: (a: Asset) => void; companyFilter?: string | null }) {
  const [assets, setAssets] = useState<Asset[] | null>(null); const [busy, setBusy] = useState(false); const [q, setQ] = useState("");
  const load = async () => setAssets((await api<Asset[]>(`/api/assets?q=${encodeURIComponent(q)}`)).filter((a) => a.mimeType.startsWith("image/")));
  useEffect(() => { if (open) load(); }, [open, q]);
  const up = async (file: File) => { setBusy(true); try { const a = await upload<Asset>("/api/assets", { file, kind: "photo", name: file.name, companyId: companyFilter || undefined }); onPick(a); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Choose an image" wide>
      <div className="flex gap-2 mb-3"><input className="input" placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} /><label className="btn-secondary cursor-pointer whitespace-nowrap">{busy ? <Spinner /> : <Upload size={14} />} Upload new<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && up(e.target.files[0])} /></label></div>
      {!assets ? <Spinner /> : assets.length === 0 ? <p className="text-sm text-ink-500">No image assets yet. Upload one.</p> : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">{assets.map((a) => <button key={a.id} type="button" className="card overflow-hidden text-left hover:border-accent" onClick={() => onPick(a)}><div className="aspect-video bg-ink-800 flex items-center justify-center"><img src={`/api/files/asset/${a.id}`} alt="" className="max-h-full max-w-full object-contain" /></div><div className="p-2 text-xs"><div className="truncate">{a.name}</div><div className="text-ink-500">{a.kind.replace("_", " ")}{a.company ? ` · ${a.company.name}` : ""}</div></div></button>)}</div>
      )}
    </Modal>
  );
}
