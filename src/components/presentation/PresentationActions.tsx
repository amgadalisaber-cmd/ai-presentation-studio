"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { api } from "@/lib/client";
import { Modal } from "@/components/ui";

export function PresentationActions({ id, name, compact }: { id: string; name: string; compact?: boolean }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false); const [newName, setNewName] = useState(name); const [open, setOpen] = useState(false);
  const rename = async () => { await api(`/api/presentations/${id}`, { method: "PATCH", json: { name: newName } }); setRenaming(false); router.refresh(); };
  const duplicate = async () => { const c = await api<{ id: string }>(`/api/presentations/${id}/duplicate`, { method: "POST" }); router.push(`/presentations/${c.id}`); router.refresh(); };
  const del = async () => { if (!confirm(`Delete "${name}"? This removes its slides, generated images and exports.`)) return; await api(`/api/presentations/${id}`, { method: "DELETE" }); router.push("/presentations"); router.refresh(); };
  return (
    <div className="relative">
      {compact ? <button className="btn-ghost btn-sm" onClick={() => setOpen(!open)}><MoreHorizontal size={14} /></button> : (
        <div className="flex gap-1"><button className="btn-secondary btn-sm" onClick={() => setRenaming(true)}><Pencil size={13} /> Rename</button><button className="btn-secondary btn-sm" onClick={duplicate}><Copy size={13} /> Duplicate</button><button className="btn-danger btn-sm" onClick={del}><Trash2 size={13} /> Delete</button></div>
      )}
      {compact && open && <div className="absolute right-0 z-20 mt-1 w-36 card p-1 text-sm" onMouseLeave={() => setOpen(false)}><button className="nav-link w-full" onClick={() => { setOpen(false); setRenaming(true); }}><Pencil size={13} /> Rename</button><button className="nav-link w-full" onClick={duplicate}><Copy size={13} /> Duplicate</button><button className="nav-link w-full text-red-600" onClick={del}><Trash2 size={13} /> Delete</button></div>}
      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename presentation"><div className="space-y-3"><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} /><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRenaming(false)}>Cancel</button><button className="btn-primary" onClick={rename}>Save</button></div></div></Modal>
    </div>
  );
}
