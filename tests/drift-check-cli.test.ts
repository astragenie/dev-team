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
import { test, expect } from "bun:test";
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
  expect(opts.repo).toBe("/some/repo");
  expect(opts.threshold).toBe(3);
  expect(opts.windowDays).toBe(30);
});

test("parseDriftCheckArgs defaults threshold to 0 and windowDays to undefined", () => {
  const opts = parseDriftCheckArgs(["--repo", "/some/repo"]);
  expect(opts.threshold).toBe(0);
  expect(opts.windowDays).toBe(undefined);
});

test("parseDriftCheckArgs rejects a non-numeric --threshold", () => {
  expect(() => parseDriftCheckArgs(["--threshold", "nope"])).toThrow(/--threshold must be/);
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

    expect(result.exitCode, "1 missing entry with threshold 5 must not fail the gate").toBe(0);
    expect(result.report?.missingFromAstramem.length).toBe(1);

    const events = await readEvents(repo);
    expect(
      events.filter((e) => e["event"] === "memory_drift").length,
      "no memory_drift event should be emitted when drift is within threshold"
    ).toBe(0);
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

    expect(result.exitCode, "2 missing entries with threshold 0 must fail the gate").toBe(1);
    expect(result.report?.missingFromAstramem.length).toBe(2);

    const events = await readEvents(repo);
    const driftEvents = events.filter((e) => e["event"] === "memory_drift");
    expect(driftEvents.length, "exactly one memory_drift event must be emitted").toBe(1);
    const event = driftEvents[0] as { count: number; ids: string[]; threshold: number };
    expect(event.count, "AC-4: event must carry the missing-entry count").toBe(2);
    expect(event.threshold).toBe(0);
    expect(
      [...event.ids].sort(),
      "AC-4: event must carry the ids of entries missing from the SoT so they can be reconciled"
    ).toEqual(["exceeds-threshold-marker-a", "exceeds-threshold-marker-b"]);
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

    expect(result.exitCode).toBe(2);
    expect(result.report).toBe(null);
    expect(result.reason ?? "").toMatch(/unreachable|unpaired|not paired/i);

    const events = await readEvents(repo);
    expect(
      events.filter((e) => e["event"] === "memory_drift").length,
      "an inconclusive (astramem-unreachable) run must not emit a memory_drift event"
    ).toBe(0);
  } finally {
    await cleanup(repo);
  }
});
