export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumePendingJobs } = await import("./lib/jobs/runner");
    const { ensureDirs } = await import("./lib/storage");
    await ensureDirs();
    try { await resumePendingJobs(); } catch (e) { console.error("[jobs] resume failed", e); }
  }
}
