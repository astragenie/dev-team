// FEAT-193 S3 (report half) — gepa-corpus-report AC coverage (AC-6/7/8).
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { reportCorpus, type LessonCitation } from "../scripts/lib/gepa/corpus-report.ts";

const TRIALS = [".claude", "artifacts", "crew", "gepa", "trials"];

async function makeRepo() {
  return fs.mkdtemp(path.join(os.tmpdir(), "corpus-report-"));
}
async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function trial(rationale: string, productionFailure = true) {
  return {
    id: randomUUID(),
    agent: "x",
    phase: "build",
    candidate_prompt_hash: "h",
    candidate_prompt_path: null,
    input: productionFailure ? { capture_origin: "production_failure" } : { slice: null },
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
  await fs.writeFile(
    path.join(dir, `${agent}.jsonl`),
    trials.map((t) => JSON.stringify(t)).join("\n") + "\n",
    "utf8"
  );
}

const noLessons = async () => [] as LessonCitation[];

test("AC-6: clusters failure modes and ranks by frequency", async () => {
  const repo = await makeRepo();
  try {
    await writeTrials(repo, "fullstack-dev", [
      trial("dropped opts.context"),
      trial("Dropped   opts.context"), // same mode, different casing/spacing
      trial("async race in EF query")
    ]);
    const report = await reportCorpus({
      hubRepo: repo,
      agent: "fullstack-dev",
      recallLessons: noLessons
    });

    const ar = report.agents[0]!;
    expect(ar.totalFailures).toBe(3);
    expect(ar.clusters.length, "casing/whitespace variants collapse to one mode").toBe(2);
    expect(ar.clusters[0]!.count, "most frequent mode ranked first").toBe(2);
    expect(ar.clusters[1]!.count).toBe(1);
  } finally {
    await cleanup(repo);
  }
});

test("AC-7: with no agent arg, enumerates EVERY agent with >=1 failure (and only those)", async () => {
  const repo = await makeRepo();
  try {
    await writeTrials(repo, "fullstack-dev", [trial("a")]);
    await writeTrials(repo, "backend-dev", [trial("b"), trial("c")]);
    await writeTrials(repo, "frontend-dev", [trial("canary", false)]); // no failures → excluded
    const report = await reportCorpus({ hubRepo: repo, recallLessons: noLessons });

    expect(
      report.agents.map((a) => a.agent).sort(),
      "only agents with production-failures, all of them"
    ).toEqual(["backend-dev", "fullstack-dev"]);
    // Ranked by failure count desc.
    expect(report.agents[0]!.agent).toBe("backend-dev");
  } finally {
    await cleanup(repo);
  }
});

test("AC-8: cites the agent's FEAT-188 astramem lessons by id", async () => {
  const repo = await makeRepo();
  try {
    await writeTrials(repo, "fullstack-dev", [trial("x")]);
    const fakeRecall = async (agent: string): Promise<LessonCitation[]> =>
      agent === "fullstack-dev" ? [{ id: "lesson-42", summary: "dropped context lesson" }] : [];
    const report = await reportCorpus({
      hubRepo: repo,
      agent: "fullstack-dev",
      recallLessons: fakeRecall
    });

    expect(report.agents[0]!.lessons.map((l) => l.id)).toEqual(["lesson-42"]);
  } finally {
    await cleanup(repo);
  }
});

test("empty hub → no agents, no throw", async () => {
  const repo = await makeRepo();
  try {
    const report = await reportCorpus({ hubRepo: repo, recallLessons: noLessons });
    expect(report.agents).toEqual([]);
  } finally {
    await cleanup(repo);
  }
});
