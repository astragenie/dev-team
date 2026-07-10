// tests/drift-check-cli.test.ts — FEAT-201
//
// Covers the CLI-runnable additions to scripts/lib/memory/drift-check.ts
// (AC-1: --repo/--threshold flags, exit codes, memory_drift event emission
// on threshold breach; AC-4: event payload carries count + ids). Behavioral
// coverage of checkDrift() itself already lives in
// tests/memory-drift-check.test.ts (FEAT-188 S5) — this file only exercises
// the new parseDriftCheckArgs()/runDriftCheckCli() surface, reusing the same
// pure in-memory fake RemoteHandle pattern (no real socket, no http.Server).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDriftCheckArgs,
  runDriftCheckCli,
  type DriftCheckCliResult
} from "../scripts/lib/memory/drift-check.ts";
import { fileProvider, type RemoteHandle } from "@astragenie/memory-provider";
import type { RecallHit } from "@astragenie/astramem-plugin/contracts";

async function makeTempRepo(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Same fake shape as tests/memory-drift-check.test.ts's makeFakeRemote. */
function makeFakeRemote(knownIds: Set<string>): RemoteHandle {
  return {
    name: "local",
    provider: {
      async remember(): Promise<void> {},
      async health() {
        return { ok: true, version: "test-fake" };
      },
      async recall(req: { query: string; k: number }) {
        const hits: RecallHit[] = [...knownIds]
          .filter((id) => req.query.includes(id))
          .map((id) => ({ id, type: "lesson", text: req.query, score: 1 }));
        return { hits };
      }
    }
  };
}

async function readEvents(repo: string): Promise<Record<string, unknown>[]> {
  const eventsPath = path.join(repo, ".claude", "logs", "events.jsonl");
  const raw = await fs.readFile(eventsPath, "utf8").catch(() => "");
  return raw
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("parseDriftCheckArgs reads --repo/--threshold/--window-days", () => {
  const opts = parseDriftCheckArgs([
    "--repo",
    "/some/repo",
    "--threshold",
    "3",
    "--window-days",
    "30"
  ]);
  assert.equal(opts.repo, "/some/repo");
  assert.equal(opts.threshold, 3);
  assert.equal(opts.windowDays, 30);
});

test("parseDriftCheckArgs defaults threshold to 0 and windowDays to undefined", () => {
  const opts = parseDriftCheckArgs(["--repo", "/some/repo"]);
  assert.equal(opts.threshold, 0);
  assert.equal(opts.windowDays, undefined);
});

test("parseDriftCheckArgs rejects a non-numeric --threshold", () => {
  assert.throws(() => parseDriftCheckArgs(["--threshold", "nope"]), /--threshold must be/);
});

test("runDriftCheckCli exits 0 and emits no event when drift is within threshold", async () => {
  const repo = await makeTempRepo("drift-cli-within-threshold-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "under-threshold-marker",
      kind: "lesson",
      severity: "low",
      summary: "under-threshold-marker never reached astramem",
      source: "test"
    });

    const remote = makeFakeRemote(new Set()); // astramem confirms nothing -> 1 missing entry
    const result: DriftCheckCliResult = await runDriftCheckCli(
      ["--repo", repo, "--threshold", "5"],
      { __resolveRemote: async () => remote }
    );

    assert.equal(result.exitCode, 0, "1 missing entry with threshold 5 must not fail the gate");
    assert.equal(result.report?.missingFromAstramem.length, 1);

    const events = await readEvents(repo);
    assert.equal(
      events.filter((e) => e["event"] === "memory_drift").length,
      0,
      "no memory_drift event should be emitted when drift is within threshold"
    );
  } finally {
    await cleanup(repo);
  }
});

test("runDriftCheckCli exits 1 and emits a memory_drift event carrying count + ids when threshold is exceeded", async () => {
  const repo = await makeTempRepo("drift-cli-exceeds-threshold-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "exceeds-threshold-marker-a",
      kind: "failure",
      severity: "high",
      summary: "exceeds-threshold-marker-a never reached astramem",
      source: "test"
    });
    await provider.capture({
      id: "exceeds-threshold-marker-b",
      kind: "failure",
      severity: "high",
      summary: "exceeds-threshold-marker-b never reached astramem either",
      source: "test"
    });

    const remote = makeFakeRemote(new Set()); // astramem confirms nothing -> 2 missing entries
    const result = await runDriftCheckCli(["--repo", repo, "--threshold", "0"], {
      __resolveRemote: async () => remote
    });

    assert.equal(result.exitCode, 1, "2 missing entries with threshold 0 must fail the gate");
    assert.equal(result.report?.missingFromAstramem.length, 2);

    const events = await readEvents(repo);
    const driftEvents = events.filter((e) => e["event"] === "memory_drift");
    assert.equal(driftEvents.length, 1, "exactly one memory_drift event must be emitted");
    const event = driftEvents[0] as { count: number; ids: string[]; threshold: number };
    assert.equal(event.count, 2, "AC-4: event must carry the missing-entry count");
    assert.equal(event.threshold, 0);
    assert.deepEqual(
      [...event.ids].sort(),
      ["exceeds-threshold-marker-a", "exceeds-threshold-marker-b"],
      "AC-4: event must carry the ids of entries missing from the SoT so they can be reconciled"
    );
  } finally {
    await cleanup(repo);
  }
});

test("runDriftCheckCli exits 2 (inconclusive, no event) when astramem cannot be resolved", async () => {
  const repo = await makeTempRepo("drift-cli-unreachable-");
  try {
    const result = await runDriftCheckCli(["--repo", repo, "--threshold", "0"], {
      __resolveRemote: async () => null
    });

    assert.equal(result.exitCode, 2);
    assert.equal(result.report, null);
    assert.match(result.reason ?? "", /unreachable|unpaired|not paired/i);

    const events = await readEvents(repo);
    assert.equal(
      events.filter((e) => e["event"] === "memory_drift").length,
      0,
      "an inconclusive (astramem-unreachable) run must not emit a memory_drift event"
    );
  } finally {
    await cleanup(repo);
  }
});
