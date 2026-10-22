/* Runs the non-browser test suites. Use `npm run test:browser` (server must be running) for the UI flow. */
import { spawnSync } from "child_process";
for (const t of ["tests/e2e-core.ts", "tests/long-content.ts", "tests/amends.ts", "tests/portrait.ts"]) {
  console.log(`\n=== ${t} ===`);
  const r = spawnSync("npx", ["tsx", t], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`FAILED: ${t}`); process.exit(1); }
}
console.log("\nAll core tests passed.");
