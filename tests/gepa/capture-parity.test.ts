// TDD: Task 8 — AC-4 capture-parity (on vs off).
// Correction vs plan: writeArtifact takes ArtifactFields, not { payload }. Uses
// real "handoff" dispatch kind so the tee fires and emits a Trial JSONL line.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArtifact } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function snapshot(root: string, filter: (rel: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  function walk(dir: string) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else {
        const rel = full.replace(root, "");
        if (filter(rel)) out[rel] = readFileSync(full, "utf8");
      }
    }
  }
  walk(root);
  return out;
}

describe("capture parity", () => {
  test("identical dispatches with/without capture → byte-identical non-gepa artifacts", async () => {
    const on = mkdtempSync(join(tmpdir(), "gepa-on-"));
    const off = mkdtempSync(join(tmpdir(), "gepa-off-"));
    try {
      writeFileSync(
        join(on, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
        }),
      );
      writeFileSync(
        join(off, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } }),
      );

      const fields: ArtifactFields = {
        title: "parity-run",
        owner: "fullstack-dev",
        slice: "S2",
        runTitle: "parity-run",
        cost: { usd: 0.05 },
      };
      await writeArtifact(on, "handoff", fields);
      await writeArtifact(off, "handoff", fields);

      const filter = (rel: string) =>
        rel.includes(".claude/artifacts/crew/") && !rel.includes("/gepa/");
      expect(snapshot(on, filter)).toEqual(snapshot(off, filter));

      const trialsFile = join(on, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      const trials = readFileSync(trialsFile, "utf8").trim().split("\n");
      expect(trials).toHaveLength(1);
    } finally {
      rmSync(on, { recursive: true, force: true });
      rmSync(off, { recursive: true, force: true });
    }
  });
});
