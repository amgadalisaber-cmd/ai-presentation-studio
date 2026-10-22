"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function InitDbButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); setMsg(null); try { const r = await fetch("/api/setup/db", { method: "POST" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsg(`Tables created, ${j.seededStyles} styles seeded.`); router.refresh(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Initializing…" : "Create tables & seed styles"}</button>
      {msg && <span className="text-xs text-ink-400">{msg}</span>}
    </span>
  );
}
