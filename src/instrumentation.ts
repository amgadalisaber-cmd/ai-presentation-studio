export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumePendingJobs } = await import("./lib/jobs/runner");
    const { ensureDirs } = await import("./lib/storage");
    try { await ensureDirs(); } catch { /* reported on /status */ }
    try { await resumePendingJobs(); } catch (e) { console.error("[jobs] resume failed — database unavailable? open /status", (e as Error).message); }
  }
}
