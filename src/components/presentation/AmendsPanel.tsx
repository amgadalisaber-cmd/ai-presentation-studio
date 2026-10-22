"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Undo2, Sparkles, MessageSquare } from "lucide-react";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

type Amend = { id: string; role: string; message: string; status: string; interpreter?: string | null; createdAt: string; snapshot?: unknown };

/** Per-slide (or presentation-wide) revision chat. */
export function AmendsPanel({ presentationId, slideId, slideLabel, onApplied, compact, disabled }: { presentationId: string; slideId: string | null; slideLabel?: string; onApplied?: () => void | Promise<void>; compact?: boolean; disabled?: boolean }) {
  const [items, setItems] = useState<Amend[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [interp, setInterp] = useState<"ai" | "rules">("rules");
  const bottom = useRef<HTMLDivElement>(null);
  const load = async () => { const r = await api<{ interpreter: "ai" | "rules"; amends: Amend[] }>(`/api/presentations/${presentationId}/amends?slideId=${slideId ?? ""}`); setItems(r.amends); setInterp(r.interpreter); };
  useEffect(() => { load(); }, [presentationId, slideId]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [items.length, busy]);
  const send = async () => {
    const m = text.trim(); if (!m || busy || disabled) return;
    setBusy(true); setError(null); setText("");
    setItems((x) => [...x, { id: "tmp", role: "user", message: m, status: "none", createdAt: new Date().toISOString() }]);
    try { await api(`/api/presentations/${presentationId}/amends`, { method: "POST", json: { slideId, message: m } }); await load(); await onApplied?.(); }
    catch (e) { setError((e as Error).message); setText(m); } finally { setBusy(false); }
  };
  const undo = async (id: string) => { setBusy(true); setError(null); try { await api(`/api/amends/${id}/undo`, { method: "POST" }); await load(); await onApplied?.(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const statusCls: Record<string, string> = { applied: "text-emerald-300", partial: "text-amber-300", failed: "text-red-300", unclear: "text-ink-400", undone: "text-ink-500 line-through" };
  return (
    <div className={`flex flex-col ${compact ? "h-full" : "card"}`}>
      {!compact && <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5 text-sm"><span className="flex items-center gap-2 font-medium"><MessageSquare size={14} /> Amends · {slideLabel || (slideId ? "this slide" : "whole presentation")}</span><span className="text-[11px] text-ink-500" title={interp === "ai" ? "Interpreted by the Gemini text model (validated), rules as fallback" : "Interpreted by built-in rules (set GEMINI_API_KEY for natural-language understanding)"}>{interp === "ai" ? <><Sparkles size={11} className="inline" /> AI interpreter</> : "Rule interpreter"}</span></div>}
      <div className={`flex-1 overflow-auto px-3 py-3 space-y-3 text-sm ${compact ? "" : "max-h-[420px] min-h-[160px]"}`}>
        {items.length === 0 && <p className="text-xs text-ink-500">Write what you want changed on {slideId ? "this slide" : "the presentation"} — e.g. “make the heading bigger”, “move the image to the left”, “dark background”, “split this slide”, “regenerate in Cinematic”, “change the heading to "…"”. Wording is only changed when you dictate it in quotes; everything else is design.</p>}
        {items.map((a) => (
          <div key={a.id} className={`flex ${a.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-lg px-3 py-2 ${a.role === "user" ? "bg-accent/15 border border-accent/30" : "bg-ink-800 border border-ink-700"}`} dir="auto">
              <div className="whitespace-pre-wrap leading-relaxed">{a.message}</div>
              {a.role === "assistant" && <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px]"><span className={statusCls[a.status] || "text-ink-500"}>{a.status}{a.interpreter ? ` · ${a.interpreter}` : ""}</span>{(a.status === "applied" || a.status === "partial") && !!a.snapshot && <button className="btn-ghost btn-sm py-0.5" disabled={busy} onClick={() => undo(a.id)}><Undo2 size={11} /> Undo</button>}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-ink-400"><Spinner /> Interpreting and applying…</div>}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div ref={bottom} />
      </div>
      {disabled && <p className="px-3 pb-1 text-[11px] text-amber-300">A regeneration is running — amends resume when it finishes.</p>}
      <div className="border-t border-ink-700 p-2 flex gap-2">
        <textarea className="textarea min-h-[44px] max-h-32 py-2" dir="auto" rows={1} placeholder={slideId ? "Amend this slide…" : "Amend the whole presentation…"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn-primary px-3" disabled={busy || disabled || !text.trim()} onClick={send}><Send size={14} /></button>
      </div>
    </div>
  );
}
