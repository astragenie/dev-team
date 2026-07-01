// tests/hook-cold-start-bench.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK = path.join(__dirname, "..", "hooks", "check-redundant-read.ts").replace(/\\/g, "/");
const RUNTIME = process.env["HOOK_BENCH_RUNTIME"] ?? "bun";
const RUNS = 100;

// Cold-start thresholds are load-aware:
//  - Linux/CI (ubuntu-latest): p50 ≤ 60ms, p95 ≤ 120ms (tight target — spec-gating).
//  - Windows local: floor ~88ms, p95 ~103ms.
//  - Windows GitHub Actions runner: shared VM adds ~5-7× spawn overhead; observed
//    p50 ~135ms / p95 ~700ms (2026-07-01, run 28550292795). Windows thresholds
//    reflect the runner ceiling, not local dev.
const IS_WINDOWS = process.platform === "win32";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

test(`hook cold start (${RUNTIME}): median + p95 over ${RUNS} cold spawns`, {
  timeout: 30000
}, () => {
  const samples: number[] = [];
  const args = RUNTIME === "node" ? ["--experimental-strip-types", HOOK] : [HOOK];
  for (let i = 0; i < RUNS; i++) {
    const start = process.hrtime.bigint();
    const res = spawnSync(RUNTIME, args, {
      env: { ...process.env },
      input: "{}\n"
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    assert.equal(res.status, 0);
    samples.push(elapsedMs);
  }
  samples.sort((a, b) => a - b);
  const p50 = percentile(samples, 0.5);
  const p95 = percentile(samples, 0.95);
  console.log(`hook cold start (${RUNTIME}) p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  if (RUNTIME === "bun") {
    if (IS_WINDOWS) {
      // Windows: Bun cold start floor ~88ms standalone. Local dev meets tighter
      // ceilings, but the GitHub Actions Windows runner adds shared-VM overhead
      // (observed p95 ~700ms 2026-07-01). Linux/CI is the gating environment
      // for the tight spec target — Windows uses runner-tolerant thresholds.
      console.log(
        "(Windows: p50 target <=250ms, p95 <=900ms; Linux/CI asserts <=60ms / <=120ms)"
      );
      assert.ok(p50 <= 250, `Windows p50 ${p50.toFixed(1)}ms should be <= 250ms`);
      assert.ok(p95 <= 900, `Windows p95 ${p95.toFixed(1)}ms should be <= 900ms`);
    } else {
      assert.ok(p50 <= 60, `Linux p50 ${p50.toFixed(1)}ms should be <= 60ms`);
      assert.ok(p95 <= 120, `Linux p95 ${p95.toFixed(1)}ms should be <= 120ms`);
    }
  }
});
