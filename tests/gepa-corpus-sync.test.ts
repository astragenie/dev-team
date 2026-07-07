// FEAT-193 S2 — gepa-corpus-sync AC coverage (AC-1..5).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { syncCorpus } from "../scripts/lib/gepa/corpus-sync.ts";

const TRIALS = [".claude", "artifacts", "crew", "gepa", "trials"];

async function makeRepo(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}
async function cleanup(...dirs: string[]) {
  await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
}

function makeTrial(agent: string, rationale: string, opts: { productionFailure?: boolean } = {}) {
  return {
    id: randomUUID(),
    agent,
    phase: "build",
    candidate_prompt_hash: "deadbeef",
    candidate_prompt_path: `agents/${agent}.md`,
    input:
      opts.productionFailure === false ? { slice: null } : { capture_origin: "production_failure" },
    output: {},
    score: { pass: false, score: 0, cost_usd: 0, latency_ms: 0, rationale },
    source: "captured",
    pareto_rank: null,
    created_at: "2026-07-07T00:00:00.000Z"
  };
}

async function writeTrials(repo: string, agent: string, trials: unknown[]) {
  const dir = path.join(repo, ...TRIALS);
  await fs.mkdir(dir, { recursive: true });
  const body = trials.map((t) => JSON.stringify(t)).join("\n") + "\n";
  await fs.writeFile(path.join(dir, `${agent}.jsonl`), body, "utf8");
}

async function readHubTrials(hub: string, agent: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(hub, ...TRIALS, `${agent}.jsonl`), "utf8");
    return raw.split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
}

test("AC-1: production-failure trials from a sibling are merged into the hub per-agent", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sib = await makeRepo("corpus-sib-");
  try {
    await writeTrials(sib, "fullstack-dev", [
      makeTrial("fullstack-dev", "dropped opts.context in adapter"),
      makeTrial("fullstack-dev", "async race in EF query")
    ]);
    const report = await syncCorpus({ hubRepo: hub, siblingRepos: [sib] });

    assert.equal(report.totalEligible, 2);
    assert.equal(report.totalAdded, 2);
    assert.equal(report.perAgent["fullstack-dev"]?.added, 2);
    assert.equal((await readHubTrials(hub, "fullstack-dev")).length, 2);
  } finally {
    await cleanup(hub, sib);
  }
});

test("AC-2: dedup by (agent, rationale-hash) across siblings + idempotent re-run", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sibA = await makeRepo("corpus-sibA-");
  const sibB = await makeRepo("corpus-sibB-");
  try {
    // Same rationale in two siblings → must land once.
    await writeTrials(sibA, "backend-dev", [makeTrial("backend-dev", "null deref in mapper")]);
    await writeTrials(sibB, "backend-dev", [makeTrial("backend-dev", "null deref in mapper")]);

    const first = await syncCorpus({ hubRepo: hub, siblingRepos: [sibA, sibB] });
    assert.equal(first.totalEligible, 2);
    assert.equal(first.totalAdded, 1, "cross-sibling duplicate must add once");
    assert.equal(first.totalSkipped, 1);
    assert.equal((await readHubTrials(hub, "backend-dev")).length, 1);

    // Idempotent: re-run adds nothing.
    const second = await syncCorpus({ hubRepo: hub, siblingRepos: [sibA, sibB] });
    assert.equal(second.totalAdded, 0, "re-run must add zero rows");
    assert.equal(second.totalSkipped, 2);
    assert.equal((await readHubTrials(hub, "backend-dev")).length, 1);
  } finally {
    await cleanup(hub, sibA, sibB);
  }
});

test("AC-3: completeness — added+skipped===eligible AND every contributing agent enumerated", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sib = await makeRepo("corpus-sib-");
  try {
    await writeTrials(sib, "fullstack-dev", [
      makeTrial("fullstack-dev", "a"),
      makeTrial("fullstack-dev", "a") // intra-file dup
    ]);
    await writeTrials(sib, "frontend-dev", [makeTrial("frontend-dev", "b")]);
    const report = await syncCorpus({ hubRepo: hub, siblingRepos: [sib] });

    assert.equal(
      report.totalAdded + report.totalSkipped,
      report.totalEligible,
      "no eligible trial silently dropped"
    );
    assert.deepEqual(
      Object.keys(report.perAgent).sort(),
      ["frontend-dev", "fullstack-dev"],
      "every agent with >=1 contributed trial must be enumerated"
    );
    assert.equal(report.perAgent["fullstack-dev"]?.contributed, 2);
  } finally {
    await cleanup(hub, sib);
  }
});

test("AC-4: non-production-failure trials are NOT aggregated", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sib = await makeRepo("corpus-sib-");
  try {
    await writeTrials(sib, "fullstack-dev", [
      makeTrial("fullstack-dev", "eval canary", { productionFailure: false })
    ]);
    const report = await syncCorpus({ hubRepo: hub, siblingRepos: [sib] });

    assert.equal(report.totalEligible, 0, "eval/canary trials must not be eligible");
    assert.equal(report.totalAdded, 0);
    assert.equal((await readHubTrials(hub, "fullstack-dev")).length, 0);
  } finally {
    await cleanup(hub, sib);
  }
});

test("AC-5: read-only on siblings; missing trials dir skipped without error", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sibWith = await makeRepo("corpus-sibWith-");
  const sibBare = await makeRepo("corpus-sibBare-"); // no trials dir
  try {
    await writeTrials(sibWith, "fullstack-dev", [makeTrial("fullstack-dev", "x")]);
    const before = await fs.readFile(path.join(sibWith, ...TRIALS, "fullstack-dev.jsonl"), "utf8");

    const report = await syncCorpus({ hubRepo: hub, siblingRepos: [sibWith, sibBare] });

    assert.equal(report.siblingsScanned, 1);
    assert.deepEqual(report.siblingsSkipped, [sibBare], "bare sibling skipped without error");
    // Sibling file untouched.
    const after = await fs.readFile(path.join(sibWith, ...TRIALS, "fullstack-dev.jsonl"), "utf8");
    assert.equal(after, before, "sync must never mutate a sibling");
  } finally {
    await cleanup(hub, sibWith, sibBare);
  }
});
