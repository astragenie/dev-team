// TDD: Task 4 — captureTee happy-path + no-op branches
// Uses real ArtifactRecord + ArtifactFields shapes (Correction 2 applied).

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureTee } from "../../scripts/lib/gepa/capture-tee.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function sampleRecord(): ArtifactRecord {
  return {
    kind: "handoff",
    path: "/tmp/fake-handoff.md",
    title: "test handoff"
  };
}

function sampleFields(overrides: Partial<ArtifactFields> = {}): ArtifactFields {
  return {
    owner: "fullstack-dev",
    slice: "S2",
    cost: { usd: 0.01 },
    ...overrides
  };
}

function enabledConfig(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    capture: { enabled: true, walltime_ms: 2000 },
    storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
    ...extra
  });
}

describe("captureTee", () => {
  test("writes a Trial line when capture is enabled and agent is fullstack-dev", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      await captureTee(root, sampleRecord(), sampleFields());

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      const lines = readFileSync(trialFile, "utf8").trim().split("\n");
      expect(lines).toHaveLength(1);
      const trial = JSON.parse(lines[0]!);
      expect(trial.agent).toBe("fullstack-dev");
      expect(trial.source).toBe("captured");
      expect(trial.phase).toBe("build");
      expect(typeof trial.id).toBe("string");
      expect(trial.pareto_rank).toBeNull();
      expect(trial.score.pass).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when gepa.config.json is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      await captureTee(root, sampleRecord(), sampleFields());
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when capture.enabled is false", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } })
      );
      await captureTee(root, sampleRecord(), sampleFields());
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when agent is in capture.exclude", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, exclude: ["fullstack-dev"] },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
        })
      );
      await captureTee(root, sampleRecord(), sampleFields());
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("only captures allowlisted agents (non-allowlisted agents are no-op)", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      // Pass reviewer as owner — should be filtered out by the capture allowlist
      await captureTee(root, sampleRecord(), sampleFields({ owner: "reviewer" }));
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("captures frontend-dev canary (FEAT-210)", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-tee-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      await captureTee(root, sampleRecord(), sampleFields({ owner: "frontend-dev" }));

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/frontend-dev.jsonl");
      const lines = readFileSync(trialFile, "utf8").trim().split("\n");
      expect(lines).toHaveLength(1);
      const trial = JSON.parse(lines[0]!);
      expect(trial.agent).toBe("frontend-dev");
      expect(trial.source).toBe("captured");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
