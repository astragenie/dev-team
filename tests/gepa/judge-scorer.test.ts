/**
 * tests/gepa/judge-scorer.test.ts — FEAT-192 SLICE-C
 *
 * Unit tests for the judge-backed Scorer adapter. Dispatch + judge
 * resolution are both injected via the `deps` seam — no `claude -p`
 * subprocess and no live LLM call ever runs in this file.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentRun, EvalCase, LLMJudge } from "@astragenie/gepa-core";
import { createJudgeScorer, type JudgeScorerDeps } from "../../scripts/lib/gepa/judge-scorer.ts";

function setupCandidateFile(): { promptPath: string } {
  const repoPath = mkdtempSync(join(tmpdir(), "gepa-judge-scorer-"));
  mkdirSync(join(repoPath, "candidates"), { recursive: true });
  const promptPath = join(repoPath, "candidates", "candidate-1.md");
  writeFileSync(promptPath, "# candidate prompt\n\nYou are a candidate agent.\n", "utf8");
  return { promptPath };
}

function makeRun(promptPath: string): AgentRun {
  return {
    agent: "fullstack-dev",
    candidate_prompt_path: promptPath,
    case_id: "case-1",
    raw_output: null,
    cost_usd: 0,
    latency_ms: 0,
    finished_at: new Date().toISOString()
  };
}

function makeCase(rubric: string[] = ["Did the candidate do the thing?"]): EvalCase {
  return { id: "case-1", input: "scenario input text", rubric, held_out: false };
}

function fakeJudge(
  behavior: (opts: Parameters<LLMJudge["evaluate"]>[0]) => ReturnType<LLMJudge["evaluate"]>,
  provider = "fake"
): LLMJudge {
  return {
    evaluate: behavior,
    describe: () => ({ provider, model: "fake-model" })
  };
}

describe("FEAT-192 SLICE-C — createJudgeScorer", () => {
  test("PASS case: dispatch + judge succeed, pass:true with score/cost/latency/rationale populated", async () => {
    const { promptPath } = setupCandidateFile();
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "As fullstack-dev, I handled the request." }),
      resolveJudgeChain: async () => ({
        judges: [
          fakeJudge(async () => ({
            pass: true,
            score: 0.9,
            rubricScores: {},
            rationale: "The candidate clearly identified as fullstack-dev and handled the request.",
            cost_usd: 0.002,
            latency_ms: 400
          }))
        ],
        errors: []
      })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.cost_usd).toBe(0.002);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.rationale).toBe(
      "The candidate clearly identified as fullstack-dev and handled the request."
    );
  });

  test("FAIL case: judge returns pass:false", async () => {
    const { promptPath } = setupCandidateFile();
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "I am Claude Code, not a specific agent." }),
      resolveJudgeChain: async () => ({
        judges: [
          fakeJudge(async () => ({
            pass: false,
            score: 0.1,
            rubricScores: {},
            rationale: "The candidate broke identity anchor and declared itself Claude Code.",
            cost_usd: 0.0015,
            latency_ms: 350
          }))
        ],
        errors: []
      })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.1);
    expect(result.rationale).toContain("broke identity anchor");
  });

  test("judge-fallback path: primary judge throws, fallback judge is used", async () => {
    const { promptPath } = setupCandidateFile();
    let primaryCalled = false;
    let fallbackCalled = false;
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "candidate output" }),
      resolveJudgeChain: async () => ({
        judges: [
          fakeJudge(async () => {
            primaryCalled = true;
            throw new Error("primary judge unreachable (network error)");
          }, "primary-provider"),
          fakeJudge(async () => {
            fallbackCalled = true;
            return {
              pass: true,
              score: 0.75,
              rubricScores: {},
              rationale: "Fallback judge scored it.",
              cost_usd: 0.001,
              latency_ms: 200
            };
          }, "fallback-provider")
        ],
        errors: []
      })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(primaryCalled).toBe(true);
    expect(fallbackCalled).toBe(true);
    expect(result.pass).toBe(true);
    expect(result.rationale).toBe("Fallback judge scored it.");
  });

  test("all judges fail: graceful non-crash result, pass:false with diagnostic rationale", async () => {
    const { promptPath } = setupCandidateFile();
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "candidate output" }),
      resolveJudgeChain: async () => ({
        judges: [
          fakeJudge(async () => {
            throw new Error("boom");
          }, "only-provider")
        ],
        errors: []
      })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.rationale).toContain("judge_unavailable");
    expect(result.rationale).toContain("boom");
  });

  test("no judges resolved at all: graceful non-crash result", async () => {
    const { promptPath } = setupCandidateFile();
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "candidate output" }),
      resolveJudgeChain: async () => ({ judges: [], errors: ["unknown judge provider: bogus"] })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(result.pass).toBe(false);
    expect(result.rationale).toContain("unknown judge provider: bogus");
  });

  test("dispatch failure (subprocess/parse): graceful non-crash result, never throws", async () => {
    const { promptPath } = setupCandidateFile();
    const deps: JudgeScorerDeps = {
      dispatch: async () => {
        throw new Error("candidate-dispatch: subprocess timed out after 90000ms");
      },
      resolveJudgeChain: async () => ({ judges: [], errors: [] })
    };
    const scorer = createJudgeScorer({ deps });
    const result = await scorer.score(makeRun(promptPath), makeCase());

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.rationale).toContain("dispatch_failed");
    expect(result.rationale).toContain("timed out");
  });

  test("empty candidate_prompt_path: graceful non-crash result (defensive)", async () => {
    const deps: JudgeScorerDeps = {
      dispatch: async () => ({ candidateOutput: "unused" }),
      resolveJudgeChain: async () => ({ judges: [], errors: [] })
    };
    const scorer = createJudgeScorer({ deps });
    const run: AgentRun = {
      agent: "fullstack-dev",
      candidate_prompt_path: "",
      case_id: "case-1",
      raw_output: null,
      cost_usd: 0,
      latency_ms: 0,
      finished_at: new Date().toISOString()
    };
    const result = await scorer.score(run, makeCase());
    expect(result.pass).toBe(false);
    expect(result.rationale).toContain("dispatch_failed");
  });
});
