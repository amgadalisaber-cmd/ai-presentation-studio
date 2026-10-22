"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const db = /prisma|database|P100|ECONNREFUSED|5432/i.test(error.message);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card shadow-pop max-w-lg p-6 space-y-3">
        <h1 className="h1">Something went wrong</h1>
        <p className="text-sm text-ink-300 break-words">{error.message || "Unexpected error"}</p>
        {db && <p className="text-sm text-ink-400">This looks like a database problem. Check that PostgreSQL is running, that <code>DATABASE_URL</code> in <code>.env</code> is correct, and that you ran <code>npm run setup</code> once to create the tables.</p>}
        <p className="text-xs text-ink-500">Production builds hide the exact message. The diagnostics page shows what is wrong without exposing secrets.</p>
        <div className="flex gap-2"><a href="/status" className="btn-primary">Open diagnostics (/status)</a><button className="btn-secondary" onClick={reset}>Try again</button></div>
      </div>
    </div>
  );
}
