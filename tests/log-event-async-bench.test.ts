// tests/log-event-async-bench.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "scripts", "log_event.sh").replace(/\\/g, "/");
const RUNS = 100;

// Benchmark is meaningful only on a lightly-loaded local Linux machine.
// Windows has Cygwin bash cold-start floor ~57-70ms; CI runners see parallel-
// test load spikes that push p95 above the 20ms gate even on ubuntu-latest.
const IS_WINDOWS = process.platform === "win32";
const IS_CI = Boolean(process.env.CI);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

test(`log_event.sh foreground latency: p95 over ${RUNS} runs is <= 20ms`, {
  timeout: 60000,
  skip: IS_WINDOWS
    ? "skip on Windows — Cygwin bash cold-start floor makes p95 unreliable"
    : IS_CI
      ? "skip in CI — parallel test load makes p95 latency benchmarks unreliable; verify locally on a quiet Linux machine"
      : false
}, () => {
  const root = mkdtempSync(path.join(tmpdir(), "log-event-bench-"));
  const samples: number[] = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      const start = process.hrtime.bigint();
      const res = spawnSync("bash", [SCRIPT, "bench_event"], {
        cwd: root,
        env: { ...process.env, CLAUDE_PROJECT_DIR: root },
        input: '{"sample":true}\n'
      });
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      assert.equal(res.status, 0);
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
      assert.ok(p95 < 300, `Windows p95 ${p95.toFixed(1)}ms should be < 300ms`);
    } else {
      assert.ok(p95 <= 20, `Linux p95 ${p95.toFixed(1)}ms should be <= 20ms`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
