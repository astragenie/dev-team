// TDD: Task 5 — walltime/error drop path
// Verifies that when fileStore.put() throws (or walltime expires),
// captureTee logs a gepa_capture_drop event and never propagates the error.
//
// Approach: block file-store by placing a regular FILE at the path where
// fileStore expects to create a DIRECTORY (.claude/artifacts/crew/gepa/trials).
// This causes mkdirSync inside fileStore to throw ENOTDIR immediately —
// which satisfies the "drop + log" invariant without relying on timing.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function fullstackRecord(): ArtifactRecord {
  return {
    kind: "handoff",
    path: "/tmp/fake-handoff.md",
    title: "walltime test handoff",
  };
}

function fullstackFields(): ArtifactFields {
  return {
    owner: "fullstack-dev",
    slice: "S2",
    cost: { usd: 0.01 },
  };
}

describe("captureTee walltime / error drop", () => {
  test("store error → drop trial + log gepa_capture_drop (file-collision block)", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-walltime-"));
    try {
      // Ensure .claude/logs exists so the event logger can write.
      mkdirSync(join(root, ".claude/logs"), { recursive: true });
      // Ensure parent dirs for the trials path exist up to "gepa/" level.
      mkdirSync(join(root, ".claude/artifacts/crew/gepa"), { recursive: true });

      // Place a REGULAR FILE where fileStore expects a DIRECTORY.
      // fileStore calls mkdirSync(root) → ENOTDIR → put() throws.
      writeFileSync(join(root, ".claude/artifacts/crew/gepa/trials"), "BLOCKED");

      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, walltime_ms: 2000 },
          storage: {
            backend: "file",
            file_root: ".claude/artifacts/crew/gepa/trials",
          },
        }),
      );

      // captureTee must complete without throwing even though fileStore throws.
      await captureTee(root, fullstackRecord(), fullstackFields());

      // The drop event must appear in the events log.
      const logPath = join(root, ".claude/logs/events.jsonl");
      const log = readFileSync(logPath, "utf8");
      expect(log).toContain("gepa_capture_drop");

      // Parse the event line and verify required fields.
      const events = log
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const dropEvent = events.find(
        (e: { event: string }) => e.event === "gepa_capture_drop",
      );
      expect(dropEvent).toBeDefined();
      expect(typeof dropEvent.trial_id).toBe("string");
      expect(dropEvent.agent).toBe("fullstack-dev");
      expect(typeof dropEvent.reason).toBe("string");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
