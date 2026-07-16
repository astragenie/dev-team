// FEAT-193 S2 — gepa-corpus-sync AC coverage (AC-1..5).
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { syncCorpus } from "../scripts/lib/gepa/corpus-sync.ts";

const cliPath = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "scripts",
  "crew.ts"
);

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

    expect(report.totalEligible).toBe(2);
    expect(report.totalAdded).toBe(2);
    expect(report.perAgent["fullstack-dev"]?.added).toBe(2);
    expect((await readHubTrials(hub, "fullstack-dev")).length).toBe(2);
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
    expect(first.totalEligible).toBe(2);
    expect(first.totalAdded, "cross-sibling duplicate must add once").toBe(1);
    expect(first.totalSkipped).toBe(1);
    expect((await readHubTrials(hub, "backend-dev")).length).toBe(1);

    // Idempotent: re-run adds nothing.
    const second = await syncCorpus({ hubRepo: hub, siblingRepos: [sibA, sibB] });
    expect(second.totalAdded, "re-run must add zero rows").toBe(0);
    expect(second.totalSkipped).toBe(2);
    expect((await readHubTrials(hub, "backend-dev")).length).toBe(1);
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

    expect(report.totalAdded + report.totalSkipped, "no eligible trial silently dropped").toBe(
      report.totalEligible
    );
    expect(
      Object.keys(report.perAgent).sort(),
      "every agent with >=1 contributed trial must be enumerated"
    ).toEqual(["frontend-dev", "fullstack-dev"]);
    expect(report.perAgent["fullstack-dev"]?.contributed).toBe(2);
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

    expect(report.totalEligible, "eval/canary trials must not be eligible").toBe(0);
    expect(report.totalAdded).toBe(0);
    expect((await readHubTrials(hub, "fullstack-dev")).length).toBe(0);
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

    expect(report.siblingsScanned).toBe(1);
    expect(report.siblingsSkipped, "bare sibling skipped without error").toEqual([sibBare]);
    // Sibling file untouched.
    const after = await fs.readFile(path.join(sibWith, ...TRIALS, "fullstack-dev.jsonl"), "utf8");
    expect(after, "sync must never mutate a sibling").toBe(before);
  } finally {
    await cleanup(hub, sibWith, sibBare);
  }
});

test("corrupt + schema-drifted rows are skipped, valid ones still aggregate (no throw)", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sib = await makeRepo("corpus-sib-");
  try {
    const dir = path.join(sib, ...TRIALS);
    await fs.mkdir(dir, { recursive: true });
    const lines = [
      "{ not valid json", // malformed syntax
      JSON.stringify({ id: "x", agent: "backend-dev" }), // valid JSON, invalid TrialSchema
      JSON.stringify(makeTrial("backend-dev", "real failure")) // valid production-failure trial
    ];
    await fs.writeFile(path.join(dir, "backend-dev.jsonl"), lines.join("\n") + "\n", "utf8");

    const report = await syncCorpus({ hubRepo: hub, siblingRepos: [sib] });
    expect(report.totalEligible, "only the schema-valid production-failure counts").toBe(1);
    expect(report.totalAdded).toBe(1);
    expect((await readHubTrials(hub, "backend-dev")).length).toBe(1);
  } finally {
    await cleanup(hub, sib);
  }
});

test("CLI: --sibling + --json flags are wired (no 'Unknown argument')", async () => {
  const hub = await makeRepo("corpus-hub-");
  const sib = await makeRepo("corpus-sib-");
  try {
    await writeTrials(sib, "fullstack-dev", [makeTrial("fullstack-dev", "cli path")]);
    // CLI scripts run on Node per ADR-002 (not bun, which `bun test` would
    // otherwise use via process.execPath).
    const res = spawnSync(
      "node",
      [
        "--experimental-strip-types",
        cliPath,
        "gepa-corpus-sync",
        "--sibling",
        sib,
        "--json",
        "--repo",
        hub
      ],
      { encoding: "utf8", timeout: 60_000 }
    );
    expect(res.status, `CLI failed: ${res.stderr}`).toBe(0);
    expect(res.stderr ?? "", "flags must be registered").not.toMatch(/Unknown argument/);
    const report = JSON.parse(res.stdout);
    expect(report.totalAdded, "CLI --sibling path must aggregate").toBe(1);
  } finally {
    await cleanup(hub, sib);
  }
});
