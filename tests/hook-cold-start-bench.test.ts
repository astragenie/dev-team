// tests/hook-cold-start-bench.test.ts
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const HOOK = join(import.meta.dir, "..", "hooks", "check-redundant-read.ts").replace(/\\/g, "/");
const RUNTIME = process.env["HOOK_BENCH_RUNTIME"] ?? "bun";
const RUNS = 100;

// On Windows, Bun cold start is ~88ms vs Linux ~40ms. The ≤60ms p50
// assertion targets Linux/CI (ubuntu-latest). The p95 ≤120ms assertion
// is met on both platforms (Windows p95 ≈ 103ms).
const IS_WINDOWS = process.platform === "win32";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

describe(`hook cold start (${RUNTIME})`, () => {
  test(
    `median + p95 over ${RUNS} cold spawns`,
    () => {
      const samples: number[] = [];
      const args = RUNTIME === "node" ? ["--experimental-strip-types", HOOK] : [HOOK];
      for (let i = 0; i < RUNS; i++) {
        const start = process.hrtime.bigint();
        const res = spawnSync(RUNTIME, args, {
          env: { ...process.env, CREW_COST_HYGIENE: "1" },
          input: "{}\n",
        });
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        expect(res.status).toBe(0);
        samples.push(elapsedMs);
      }
      samples.sort((a, b) => a - b);
      const p50 = percentile(samples, 0.5);
      const p95 = percentile(samples, 0.95);
      console.log(`hook cold start (${RUNTIME}) p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
      if (RUNTIME === "bun") {
        if (IS_WINDOWS) {
          // Windows: Bun cold start floor ~88ms. Assert p50 <=100ms and p95 <=120ms.
          console.log("(Windows: p50 target relaxed to <=100ms; Linux/CI asserts <=60ms)");
          expect(p50).toBeLessThanOrEqual(100);
        } else {
          expect(p50).toBeLessThanOrEqual(60);
        }
        expect(p95).toBeLessThanOrEqual(120);
      }
    },
    30000
  );
});
