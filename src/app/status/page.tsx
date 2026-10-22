export const dynamic = "force-dynamic";
import Link from "next/link";
import { checkHealth } from "@/lib/health";
import { InitDbButton } from "@/components/InitDbButton";

/** Public, read-only deployment status page (no secrets are shown). */
export default async function StatusPage() {
  const h = await checkHealth();
  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-light to-accent text-white font-bold mb-3">AI</span><h1 className="h1">Deployment status</h1><p className="muted text-sm mt-1">{h.ok ? "Everything required is in place." : "The application cannot run until the items marked below are fixed."}</p></div>
        <div className="card divide-y divide-ink-700">
          {h.checks.map((c) => (
            <div key={c.key} className="flex items-start gap-4 px-5 py-4">
              <span className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${c.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{c.ok ? "✓" : "!"}</span>
              <div className="min-w-0 flex-1"><div className="font-medium">{c.label}</div><div className="text-sm text-ink-400 break-words">{c.detail}</div>{!c.ok && c.fix && <div className="mt-1 text-sm text-ink-200"><span className="font-medium">Fix:</span> {c.fix}</div>}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {h.ok ? <Link href="/" className="btn-primary">Open the studio</Link> : <Link href="/status" className="btn-secondary">Re-check</Link>}
          {h.checks.some((c) => c.key === "schema" && !c.ok) && h.checks.some((c) => c.key === "db" && c.ok) && <InitDbButton />}
          <span className="text-ink-500">Checked {new Date(h.checkedAt).toLocaleString()} · On the server you can also run <code>npm run doctor</code>.</span>
        </div>
        {!h.ok && <div className="card-pad text-sm space-y-2"><p className="font-medium">Typical first-run sequence on a server</p><pre className="rounded bg-ink-800 p-3 text-xs overflow-auto">{`cp .env.example .env   # set DATABASE_URL (PostgreSQL)\nnpm ci\nnpm run setup          # creates tables + seeds built-in styles\nnpm run build && npm start`}</pre><p className="text-ink-400">Or <code>docker compose up --build</code>, which includes PostgreSQL and Chromium. Serverless platforms (e.g. Vercel functions) are not supported: the app needs a persistent disk and background jobs.</p></div>}
      </div>
    </div>
  );
}
