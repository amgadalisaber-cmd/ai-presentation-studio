"use client";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function Toggle({ on, onChange, label, description }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={on} className="toggle mt-0.5" data-on={on} onClick={() => onChange(!on)}><span /></button>
      {(label || description) && <span className="text-sm"><span className="font-medium text-ink-100">{label}</span>{description && <span className="block text-xs text-ink-400 mt-0.5">{description}</span>}</span>}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { draft: "Draft", processing: "Processing", awaiting_review: "Awaiting review", completed: "Completed", failed: "Failed", exporting: "Exporting", ready: "Ready to download", queued: "Queued", running: "Running", checking: "Checking", pending: "Pending", generating: "Generating", approved: "Approved", rejected: "Rejected", verified: "Verified", issues: "Issues found", unverified: "Unverified" };
  const cls = ["draft", "processing", "awaiting_review", "completed", "failed", "exporting", "ready", "verified", "issues", "unverified"].includes(status) ? `badge-${status}` : status === "queued" || status === "running" || status === "checking" || status === "pending" || status === "generating" ? "badge-processing" : status === "approved" ? "badge-completed" : status === "rejected" ? "badge-failed" : "badge-draft";
  return <span className={cls}>{labels[status] || status}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`card w-full ${wide ? "max-w-5xl" : "max-w-lg"} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3"><h3 className="h2">{title}</h3><button className="btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const cls = { info: "border-blue-900 bg-blue-950/40 text-blue-100", warn: "border-amber-900 bg-amber-950/40 text-amber-100", error: "border-red-900 bg-red-950/40 text-red-100", success: "border-emerald-900 bg-emerald-950/40 text-emerald-100" }[kind];
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}</div>;
}

export function useAsync<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const run = async (...args: T) => { setBusy(true); setError(null); try { await fn(...args); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return { run, busy, error, setError };
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="card border-dashed p-10 text-center"><p className="font-medium text-ink-200">{title}</p>{children && <div className="mt-2 text-sm text-ink-400">{children}</div>}</div>;
}

export function Spinner({ className = "" }: { className?: string }) { return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-500 border-t-accent ${className}`} />; }
