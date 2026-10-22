"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Globe, Wand2 } from "lucide-react";
import { api } from "@/lib/client";
import { Alert, Field, Spinner } from "@/components/ui";

export function NewBrand() {
  const router = useRouter();
  const [name, setName] = useState(""); const [website, setWebsite] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setError(null);
    try {
      if (!name.trim() && !website.trim()) throw new Error("Enter a brand name (or a website).");
      setBusy("Creating brand…");
      const c = await api<{ id: string }>("/api/companies", { method: "POST", json: { name: name.trim() || website.replace(/^https?:\/\//, "").split("/")[0], isClient: true, website: website.trim() || undefined } });
      if (files.length || website.trim()) {
        setBusy("Extracting logo, colors, fonts and rules…");
        const fd = new FormData(); for (const f of files) fd.append("files", f); if (website.trim()) fd.append("website", website.trim());
        const res = await fetch(`/api/companies/${c.id}/extract`, { method: "POST", body: fd }); const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Extraction failed");
      }
      router.push(`/clients/${c.id}`); router.refresh();
    } catch (e) { setError((e as Error).message); setBusy(null); }
  };
  return (
    <div className="card-pad space-y-4">
      {error && <Alert kind="error">{error}</Alert>}
      <Field label="Brand name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HALFLENS" /></Field>
      <Field label="Website (optional)"><div className="flex items-center gap-2"><Globe size={16} className="text-ink-400" /><input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="brand-website.com" /></div></Field>
      <Field label="Files (optional)" hint="Brand guidelines (PDF, Word, PowerPoint), logos, images — anything that shows the identity.">
        <label className={`flex min-h-[90px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 text-sm ${files.length ? "border-accent" : "border-ink-600 hover:border-accent-light"}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}>
          <input type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.svg,.gif" onChange={(e) => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
          <span className="flex items-center gap-2 text-ink-300"><Upload size={16} />{files.length ? files.map((f) => f.name).join(", ").slice(0, 100) : "Drop files here or click to choose"}</span>
        </label>
      </Field>
      <div className="flex items-center gap-3"><button className="btn-primary" disabled={!!busy} onClick={create}>{busy ? <Spinner /> : <Wand2 size={14} />} {busy || "Create brand"}</button><span className="text-xs text-ink-500">Everything detected can be changed or removed on the brand page.</span></div>
    </div>
  );
}
