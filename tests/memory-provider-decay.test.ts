// tests/memory-provider-decay.test.ts
// FEAT-188 S5 AC coverage: decay hygiene. An entry older than 45 days and
// not `critical` is excluded from recall(); superseded/invalidated entries
// are never returned regardless of age. Exercised through fileProvider
// (the ranking logic itself lives in @astragenie/memory-provider's ranking
// module and is shared by every provider).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileProvider } from "@astragenie/memory-provider";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test("recall() excludes a non-critical entry older than 45 days", async () => {
  const repo = await makeTempRepo("memory-decay-excluded-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "stale-high",
      ts: daysAgoIso(46),
      kind: "lesson",
      severity: "high",
      summary: "a high-severity lesson that has aged out",
      source: "t"
    });

    const results = await provider.recall({ k: 10 });
    assert.ok(
      !results.some((r) => r.id === "stale-high"),
      "an entry older than 45 days and not critical must be excluded from recall()"
    );
  } finally {
    await cleanup(repo);
  }
});

test("recall() includes a non-critical entry that is exactly within the 45-day window", async () => {
  const repo = await makeTempRepo("memory-decay-included-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "fresh-enough",
      ts: daysAgoIso(44),
      kind: "lesson",
      severity: "medium",
      summary: "still within the decay window",
      source: "t"
    });

    const results = await provider.recall({ k: 10 });
    assert.ok(
      results.some((r) => r.id === "fresh-enough"),
      "an entry within the 45-day window must still be recallable"
    );
  } finally {
    await cleanup(repo);
  }
});

test("recall() never decays a `critical` entry regardless of age", async () => {
  const repo = await makeTempRepo("memory-decay-critical-survives-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "ancient-critical",
      ts: daysAgoIso(400),
      kind: "decision",
      severity: "critical",
      summary: "a critical decision from over a year ago",
      source: "t"
    });

    const results = await provider.recall({ k: 10 });
    assert.ok(
      results.some((r) => r.id === "ancient-critical"),
      "a `critical` entry must never be excluded by decay, no matter how old"
    );
  } finally {
    await cleanup(repo);
  }
});

test("recall() never returns a superseded entry even when it is fresh (age is not the only exclusion)", async () => {
  const repo = await makeTempRepo("memory-decay-supersede-fresh-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "v1",
      kind: "decision",
      severity: "critical",
      summary: "original — fresh, critical, but about to be superseded",
      source: "t"
    });
    await provider.supersede("v1", {
      id: "v2",
      kind: "decision",
      severity: "critical",
      summary: "revised",
      source: "t"
    });

    const results = await provider.recall({ k: 10 });
    const ids = results.map((r) => r.id);
    assert.ok(!ids.includes("v1"), "superseded entries are excluded even when fresh + critical");
    assert.ok(ids.includes("v2"));
  } finally {
    await cleanup(repo);
  }
});

test("recall() never returns an invalidated entry even when it is `critical` and ancient", async () => {
  const repo = await makeTempRepo("memory-decay-invalidate-critical-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "ancient-critical-bad",
      ts: daysAgoIso(500),
      kind: "decision",
      severity: "critical",
      summary: "turned out to be wrong, despite being critical and ancient",
      source: "t"
    });
    await provider.invalidate("ancient-critical-bad");

    const results = await provider.recall({ k: 10 });
    assert.ok(
      !results.some((r) => r.id === "ancient-critical-bad"),
      "invalidate() must exclude an entry regardless of severity or age"
    );
  } finally {
    await cleanup(repo);
  }
});
