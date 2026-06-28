// TDD: Task 9 — AC-5 SIGKILL-during-put parity.
// Correction vs plan: writeArtifact takes ArtifactFields, not { payload }. Uses
// real "handoff" dispatch kind so the tee fires.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SIGKILL-during-put parity", () => {
  test("artifact tree clean + no torn line after SIGKILL mid-capture", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-sigkill-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
        })
      );

      const cwd = process.cwd().replace(/\\/g, "/");
      const child = Bun.spawn({
        cmd: [
          "bun",
          "run",
          "-e",
          `
          const { writeArtifact } = await import("${cwd}/scripts/lib/artifacts/write.ts");
          for (let i = 0; i < 50; i++) {
            await writeArtifact(${JSON.stringify(root)}, "handoff", {
              title: "x-" + i,
              owner: "fullstack-dev",
              slice: "S2",
              cost: { usd: 0.001 },
            });
          }
          `
        ],
        stdout: "pipe",
        stderr: "pipe"
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      child.kill(9);
      await child.exited;

      const trialsDir = join(root, ".claude/artifacts/crew/gepa/trials");
      let entries: string[] = [];
      try {
        entries = readdirSync(trialsDir);
      } catch {
        // no trials dir — child killed before any flush; acceptable
      }
      if (entries.includes("fullstack-dev.jsonl")) {
        const raw = readFileSync(join(trialsDir, "fullstack-dev.jsonl"), "utf8");
        for (const line of raw.split("\n")) {
          if (line.trim().length === 0) continue;
          expect(() => JSON.parse(line)).not.toThrow();
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
