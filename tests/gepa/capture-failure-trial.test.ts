// TDD: FEAT-193 S1 — captureFailureTrial happy-path + no-op branches.
// Mirrors tests/gepa/capture-tee.test.ts's fixture style (fileStore-backed
// JSONL corpus under a temp gepa.config.json root).

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureFailureTrial } from "../../scripts/lib/gepa/capture-failure-trial.ts";
import { captureFailureTrialGuarded } from "../../scripts/lib/gepa/capture-failure-trial-guard.ts";

function enabledConfig(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    capture: { enabled: true, walltime_ms: 2000, exclude: [] },
    storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" },
    ...extra
  });
}

describe("captureFailureTrial", () => {
  test("writes a failing Trial line when capture is enabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      await captureFailureTrial(root, {
        agent: "reviewer",
        phase: "review",
        rationale: "review rejected: missing null guard"
      });

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl");
      const lines = readFileSync(trialFile, "utf8").trim().split("\n");
      expect(lines).toHaveLength(1);
      const trial = JSON.parse(lines[0]!);
      expect(trial.agent).toBe("reviewer");
      expect(trial.phase).toBe("review");
      expect(trial.source).toBe("captured");
      expect(trial.score.pass).toBe(false);
      expect(trial.score.score).toBe(0);
      expect(trial.score.cost_usd).toBe(0);
      expect(trial.score.latency_ms).toBe(0);
      expect(trial.score.rationale).toBe("review rejected: missing null guard");
      expect(trial.input.capture_origin).toBe("production_failure");
      expect(trial.pareto_rank).toBeNull();
      expect(typeof trial.id).toBe("string");
      expect(typeof trial.created_at).toBe("string");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("merges optional structured input alongside capture_origin", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      await captureFailureTrial(root, {
        agent: "verifier",
        phase: "validate",
        rationale: "validation failed: build broke",
        input: { slice: "SLICE-01", feature: "FEAT-193" }
      });

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/verifier.jsonl");
      const trial = JSON.parse(readFileSync(trialFile, "utf8").trim());
      expect(trial.input.capture_origin).toBe("production_failure");
      expect(trial.input.slice).toBe("SLICE-01");
      expect(trial.input.feature).toBe("FEAT-193");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("truncates an over-long rationale to 2000 chars", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      const longRationale = "x".repeat(3000);
      await captureFailureTrial(root, {
        agent: "reviewer",
        phase: "review",
        rationale: longRationale
      });
      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl");
      const trial = JSON.parse(readFileSync(trialFile, "utf8").trim());
      expect((trial.score.rationale as string).length).toBe(2000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when gepa.config.json is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      await captureFailureTrial(root, { agent: "reviewer", phase: "review", rationale: "x" });
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when capture.enabled is false", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } })
      );
      await captureFailureTrial(root, { agent: "reviewer", phase: "review", rationale: "x" });
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("is a no-op when agent is in capture.exclude", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({
          capture: { enabled: true, exclude: ["reviewer"] },
          storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
        })
      );
      await captureFailureTrial(root, { agent: "reviewer", phase: "review", rationale: "x" });
      const exists = await Bun.file(
        join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl")
      ).exists();
      expect(exists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("never throws when the store root is unwritable", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      // Point file_root at a path that is itself a file, not a directory.
      const blocker = join(root, "blocker-file");
      writeFileSync(blocker, "not a directory");
      writeFileSync(
        join(root, "gepa.config.json"),
        enabledConfig({ storage: { backend: "file", file_root: "blocker-file" } })
      );
      await expect(
        captureFailureTrial(root, { agent: "reviewer", phase: "review", rationale: "x" })
      ).resolves.toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// FEAT-193 S1 fix-forward: captureFailureTrialGuarded races the whole
// dynamic-import + write against a short timeout, so a slow/cold
// @astragenie/gepa-core module load can never hold a caller (a CLI command,
// a hook) open for longer than the configured ceiling.
describe("captureFailureTrialGuarded", () => {
  test("writes the trial on the normal (fast) path", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-guard-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      await captureFailureTrialGuarded(root, {
        agent: "reviewer",
        phase: "review",
        rationale: "guarded happy path"
      });
      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/reviewer.jsonl");
      const trial = JSON.parse(readFileSync(trialFile, "utf8").trim());
      expect(trial.agent).toBe("reviewer");
      expect(trial.score.rationale).toBe("guarded happy path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("resolves within the timeout ceiling and drops the trial when forced to race a 0ms budget", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-failure-trial-guard-timeout-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), enabledConfig());
      const start = Date.now();
      // 0ms timeout forces the timeout branch to win the race virtually
      // every time, regardless of how fast the real write would have been —
      // proving the guard degrades to a no-op rather than ever rejecting or
      // hanging.
      await expect(
        captureFailureTrialGuarded(
          root,
          { agent: "reviewer", phase: "review", rationale: "should not block" },
          0
        )
      ).resolves.toBeUndefined();
      expect(Date.now() - start).toBeLessThan(500);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
