/**
 * tests/gepa/gepa-invalidate.test.ts — SLICE-106
 *
 * Covers AC-5: gepa-invalidate soft-deletes trials via TrialStore.invalidate,
 * writes audit row, and reports the correct count to stdout.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileStore } from "@astragenie/gepa-core";
import type { Trial } from "@astragenie/gepa-core";
import { runGepaInvalidateCmd } from "../../scripts/lib/gepa/gepa-killswitch-cmds.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tmpDir: string;
let trialsRoot: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gepa-invalidate-test-"));
  trialsRoot = join(tmpDir, ".claude", "artifacts", "crew", "gepa", "trials");
  mkdirSync(trialsRoot, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeTrial(agent: string, id: string, createdAt: string): Trial {
  return {
    id,
    agent,
    phase: "build",
    source: "eval",
    candidate_prompt_hash: `hash-${id}`,
    candidate_prompt_path: `/path/${id}.md`,
    created_at: createdAt,
    pareto_rank: null,
    input: {},
    output: null,
    score: { pass: false, score: 0.3, cost_usd: 0.001, latency_ms: 100, rationale: "test" }
  };
}

async function seedTrials(agent: string, count: number, startDate: Date): Promise<void> {
  const store = fileStore(trialsRoot);
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate.getTime() + i * 60_000); // 1-min apart
    // Trial id must be a real UUID (Zod schema in gepa-core validates format).
    await store.put(makeTrial(agent, crypto.randomUUID(), d.toISOString()));
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("gepa-invalidate — AC-5 basic invalidation", () => {
  it("missing --agent exits 2 with usage message", async () => {
    const result = await runGepaInvalidateCmd(tmpDir, []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });

  it("invalidates 0 trials when store is empty", async () => {
    const result = await runGepaInvalidateCmd(tmpDir, ["--agent", "fullstack-dev"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("invalidated 0 trials");
    expect(result.stdout).toContain("fullstack-dev");
  });

  it("invalidates all agent trials when no --since or --tag filter", async () => {
    const start = new Date("2026-06-01T00:00:00Z");
    await seedTrials("fullstack-dev", 10, start);

    const result = await runGepaInvalidateCmd(tmpDir, ["--agent", "fullstack-dev"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("invalidated 10 trials");
    expect(result.stdout).toContain("fullstack-dev");

    // Verify store is now empty for that agent.
    const store = fileStore(trialsRoot);
    const remaining = await store.recall({ agent: "fullstack-dev" });
    expect(remaining).toHaveLength(0);
  });

  it("invalidates only trials >= --since date (AC-5: 50 rows, 20 after cutoff)", async () => {
    // Create 50 trials: 30 before cutoff, 20 at or after.
    const cutoff = new Date("2026-06-25T00:00:00Z");
    const dayBefore = new Date("2026-06-24T00:00:00Z");
    const store = fileStore(trialsRoot);

    // 30 trials before cutoff.
    for (let i = 0; i < 30; i++) {
      const d = new Date(dayBefore.getTime() - i * 60_000);
      await store.put(makeTrial("fullstack-dev", crypto.randomUUID(), d.toISOString()));
    }
    // 20 trials at or after cutoff.
    for (let i = 0; i < 20; i++) {
      const d = new Date(cutoff.getTime() + i * 60_000);
      await store.put(makeTrial("fullstack-dev", crypto.randomUUID(), d.toISOString()));
    }

    const result = await runGepaInvalidateCmd(tmpDir, [
      "--agent",
      "fullstack-dev",
      "--since",
      "2026-06-25T00:00:00Z"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "invalidated 20 trials for fullstack-dev since 2026-06-25T00:00:00Z"
    );

    // Verify 30 trials remain (the pre-cutoff ones).
    const remaining = await store.recall({ agent: "fullstack-dev" });
    expect(remaining).toHaveLength(30);
    for (const t of remaining) {
      expect(t.created_at < "2026-06-25T00:00:00Z").toBe(true);
    }
  });

  it("stdout message includes since ISO when --since is provided", async () => {
    await seedTrials("fullstack-dev", 5, new Date("2026-06-20T00:00:00Z"));

    const result = await runGepaInvalidateCmd(tmpDir, [
      "--agent",
      "fullstack-dev",
      "--since",
      "2026-06-19T00:00:00Z"
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("since 2026-06-19T00:00:00Z");
  });

  it("writes audit event to events.jsonl", async () => {
    await seedTrials("fullstack-dev", 3, new Date("2026-06-01T00:00:00Z"));

    await runGepaInvalidateCmd(tmpDir, ["--agent", "fullstack-dev"]);

    const eventsPath = join(tmpDir, ".claude", "logs", "events.jsonl");
    expect(existsSync(eventsPath)).toBe(true);
    const eventsRaw = readFileSync(eventsPath, "utf8");
    const events = eventsRaw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));

    const invalidateEvent = events.find(
      (e: Record<string, unknown>) => e.event === "gepa_invalidate"
    );
    expect(invalidateEvent).toBeDefined();
    expect(invalidateEvent.agent).toBe("fullstack-dev");
    expect(typeof invalidateEvent.invalidated_by_pid).toBe("number");
    expect(typeof invalidateEvent.invalidated_at).toBe("string");
    expect(invalidateEvent.reason).toContain("kill-switch");
  });

  it("does not affect other agents", async () => {
    const start = new Date("2026-06-01T00:00:00Z");
    await seedTrials("fullstack-dev", 5, start);
    await seedTrials("backend-dev", 3, start);

    await runGepaInvalidateCmd(tmpDir, ["--agent", "fullstack-dev"]);

    const store = fileStore(trialsRoot);
    const backendRemaining = await store.recall({ agent: "backend-dev" });
    expect(backendRemaining).toHaveLength(3);
  });
});
