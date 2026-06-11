// tests/log-event-async-bench.test.ts
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "log_event.sh").replace(/\\/g, "/");
const RUNS = 100;

// On Windows, Cygwin bash cold start is ~57-70ms — the ≤20ms assertion is
// meaningful only on Linux (bash cold start ~5ms). CI runs ubuntu-latest.
const IS_WINDOWS = process.platform === "win32";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

describe("log_event.sh foreground latency", () => {
  test(
    `p95 foreground latency over ${RUNS} runs is <= 20ms`,
    () => {
      const root = mkdtempSync(join(tmpdir(), "log-event-bench-"));
      const samples: number[] = [];
      try {
        for (let i = 0; i < RUNS; i++) {
          const start = process.hrtime.bigint();
          const res = spawnSync("bash", [SCRIPT, "bench_event"], {
            cwd: root,
            env: { ...process.env, CLAUDE_PROJECT_DIR: root },
            input: '{"sample":true}\n',
          });
          const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          expect(res.status).toBe(0);
          samples.push(elapsedMs);
        }
        samples.sort((a, b) => a - b);
        const p50 = percentile(samples, 0.5);
        const p95 = percentile(samples, 0.95);
        console.log(`log_event.sh foreground p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
        if (IS_WINDOWS) {
          // Windows/Cygwin bash cold start floor is ~57ms; assert only that
          // the async-fire actually helped (p95 < synchronous baseline of ~337ms).
          console.log("(Windows: skipping <=20ms p95 assertion; Cygwin bash floor ~57ms)");
          expect(p95).toBeLessThan(300);
        } else {
          expect(p95).toBeLessThanOrEqual(20);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    30000
  );
});
