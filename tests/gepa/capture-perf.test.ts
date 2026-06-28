// TDD: Task 10 — AC-6 capture-perf micro-benchmark.
// Correction vs plan: captureTee takes (repoPath, ArtifactRecord, ArtifactFields)
// — 3 args, not the 2-arg payload shape in the plan draft.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

describe("capture-perf", () => {
  test("1000-iter capture: p50 ≤ 50ms, p99 ≤ 200ms, max ≤ 2000ms", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-perf-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
        })
      );
      const record: ArtifactRecord = {
        kind: "handoff",
        path: "/tmp/fake-handoff.md",
        title: "perf-iter"
      };
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const fields: ArtifactFields = {
          title: "perf-iter",
          owner: "fullstack-dev",
          slice: "S2",
          cost: { usd: 0.001 }
        };
        const t0 = performance.now();
        await captureTee(root, record, fields);
        samples.push(performance.now() - t0);
      }
      const p50 = percentile(samples, 50);
      const p99 = percentile(samples, 99);
      const max = Math.max(...samples);
      console.log({ p50, p99, max });
      expect(p50).toBeLessThanOrEqual(50);
      expect(p99).toBeLessThanOrEqual(200);
      expect(max).toBeLessThanOrEqual(2000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
