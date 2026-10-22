"use client";
import type { IntegrityReport } from "@/lib/content/verify";
import { StatusBadge } from "@/components/ui";
export function IntegrityView({ report, compact }: { report: IntegrityReport | null | undefined; compact?: boolean }) {
  if (!report) return <div className="flex items-center gap-2 text-sm"><StatusBadge status="unverified" /><span className="muted">Content integrity has not been verified yet.</span></div>;
  const errors = report.issues.filter((i) => i.severity === "error"); const warns = report.issues.filter((i) => i.severity !== "error");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={report.ok ? "verified" : "issues"} /><span>{report.matchedBlocks}/{report.totalBlocks} source blocks rendered exactly</span><span className="text-xs text-ink-500">checked {new Date(report.checkedAt).toLocaleString()}</span></div>
      {report.ok && <p className="text-emerald-700">All supplied text is present, unchanged and in order. Visual reflow (splitting across slides, whitespace) is the only difference.</p>}
      {!compact && errors.length > 0 && <ul className="space-y-1">{errors.map((i, k) => <li key={k} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800"><span className="font-medium uppercase text-[10px] tracking-wider mr-2">{i.code}</span>{i.message}{i.expected && <div className="mt-1 text-xs text-red-700/80">Expected: “{i.expected}”</div>}{i.actual && <div className="text-xs text-red-700/80">Rendered: “{i.actual}”</div>}</li>)}</ul>}
      {!compact && warns.length > 0 && <ul className="space-y-1">{warns.map((i, k) => <li key={k} className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800 text-xs"><span className="font-medium uppercase text-[10px] tracking-wider mr-2">{i.code}</span>{i.message}</li>)}</ul>}
      {compact && (errors.length > 0 || warns.length > 0) && <p className="text-xs text-ink-400">{errors.length} error(s), {warns.length} warning(s). See the Export tab for details.</p>}
    </div>
  );
}
