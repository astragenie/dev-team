/**
 * tests/gepa/eval-inspector-no-circularity.test.ts — SLICE-103
 *
 * AC-4: Asserts that the inspector eval pipeline uses rubricScorer (gepa-core)
 * and NOT a self-grading circular judge. Specifically:
 *
 *   1. rubricScorer is imported from @astragenie/gepa-core (not a local scorer).
 *   2. The scoring path does NOT call crew:inspector to evaluate inspector output.
 *   3. No "scorer_circular" or "inspector_grades_inspector" warning is emitted.
 *   4. The rubric file parses to ≥6 criteria (loadRubric works).
 *   5. The eval spec judge provenance is NOT "crew:inspector".
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  rubricScorer,
  loadRubric,
  parseRubricMarkdown,
  type LLMJudge
} from "@astragenie/gepa-core";
import type { AgentRun } from "@astragenie/gepa-core";

const REPO_ROOT = join(import.meta.dir, "../..");
const RUBRIC_PATH = join(REPO_ROOT, "agents", "inspector", ".gepa", "rubric.md");
const INSPECTOR_SPEC_PATH = join(REPO_ROOT, "evals", "agents", "crew-inspector.yaml");

// ---------------------------------------------------------------------------
// Minimal LLMJudge mock factory (satisfies the full interface)
// ---------------------------------------------------------------------------

function makeMockJudge(opts: {
  id: string;
  pass?: boolean;
  score?: number;
  rationale?: string;
}): LLMJudge {
  return {
    evaluate: async (_evalOpts) => ({
      pass: opts.pass ?? true,
      score: opts.score ?? 0.9,
      rubricScores: {},
      rationale: opts.rationale ?? "mock rationale",
      cost_usd: 0,
      latency_ms: 5
    }),
    describe: () => ({ provider: opts.id, model: "mock-model" })
  };
}

/** Minimal valid AgentRun for scoring tests. */
function makeAgentRun(rawOutput: string): AgentRun {
  return {
    agent: "inspector",
    candidate_prompt_path: "agents/inspector.md",
    case_id: "inspector-bug-001",
    raw_output: rawOutput,
    cost_usd: 0,
    latency_ms: 100,
    finished_at: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// AC-4 — No circularity: rubricScorer is from gepa-core, not self-grading
// ---------------------------------------------------------------------------

describe("SLICE-103 AC-4 — scorer circularity prevention", () => {
  test("rubricScorer is exported from @astragenie/gepa-core", () => {
    // If this import resolved, the scorer comes from gepa-core (not a local mock)
    expect(typeof rubricScorer).toBe("function");
  });

  test("rubricScorer creates a scorer object with a score() method", () => {
    const judge = makeMockJudge({ id: "ollama:llama3.2" });
    const scorer = rubricScorer(judge);
    expect(typeof scorer.score).toBe("function");
  });

  test("judge describe() for a forbidden self-grading id returns crew:inspector", () => {
    // This test verifies the mock-judge shape works with rubricScorer.
    // The actual anti-circularity gate is enforced by the spec file check below.
    const selfJudge = makeMockJudge({ id: "crew:inspector" });
    expect(selfJudge.describe().provider).toBe("crew:inspector");
    // rubricScorer accepts any LLMJudge — circularity is a configuration concern,
    // not a runtime panic. The spec file test below guards the real pipeline.
    const scorer = rubricScorer(selfJudge);
    expect(scorer).toBeDefined();
    expect(typeof scorer.score).toBe("function");
  });

  test("eval spec judge provider is NOT 'crew:inspector'", async () => {
    const { parse: parseYaml } = await import("yaml");
    let specContent: string;
    try {
      specContent = readFileSync(INSPECTOR_SPEC_PATH, "utf8");
    } catch {
      // Spec file must exist — fail test if missing
      throw new Error(
        `Inspector eval spec not found at ${INSPECTOR_SPEC_PATH}. ` +
          "Run the eval scaffold to create it."
      );
    }
    const spec = parseYaml(specContent) as {
      judge?: { provider: string };
      validate_with?: Array<{ provider: string }>;
    };

    // Primary judge must NOT be crew:inspector
    const primaryProvider = spec.judge?.provider ?? "";
    expect(primaryProvider).not.toBe("crew:inspector");
    expect(primaryProvider).not.toContain("inspector");

    // validate_with chain must NOT contain crew:inspector
    for (const v of spec.validate_with ?? []) {
      expect(v.provider).not.toBe("crew:inspector");
      expect(v.provider).not.toContain("inspector_grades");
    }
  });

  test("no 'scorer_circular' substring in eval spec", () => {
    let specContent: string;
    try {
      specContent = readFileSync(INSPECTOR_SPEC_PATH, "utf8");
    } catch {
      // Missing spec is a separate failure; skip this assertion
      return;
    }
    expect(specContent).not.toContain("scorer_circular");
    expect(specContent).not.toContain("inspector_grades_inspector");
  });
});

// ---------------------------------------------------------------------------
// Rubric validation — loadRubric + parseRubricMarkdown
// ---------------------------------------------------------------------------

describe("SLICE-103 — rubric.md structure", () => {
  test("rubric.md file exists and is non-empty", () => {
    const raw = readFileSync(RUBRIC_PATH, "utf8");
    expect(raw.length).toBeGreaterThan(0);
  });

  test("parseRubricMarkdown returns ≥6 criteria (all 6 defined)", () => {
    const raw = readFileSync(RUBRIC_PATH, "utf8");
    const criteria = parseRubricMarkdown(raw);
    expect(criteria.length).toBeGreaterThanOrEqual(6);
  });

  test("all 6 required criteria are present", () => {
    const raw = readFileSync(RUBRIC_PATH, "utf8");
    const criteria = parseRubricMarkdown(raw);
    const required = [
      "verdict-accuracy",
      "evidence-citation-correctness",
      "risk-class-named",
      "rationale-actionability",
      "escalation-appropriateness",
      "false-positive-rate"
    ];
    for (const name of required) {
      expect(criteria).toContain(name);
    }
  });

  test("loadRubric resolves criteria from disk path", async () => {
    const criteria = await loadRubric(RUBRIC_PATH);
    expect(Array.isArray(criteria)).toBe(true);
    expect(criteria.length).toBeGreaterThanOrEqual(6);
  });

  test("each criterion is a non-empty string (no empty headings)", async () => {
    const criteria = await loadRubric(RUBRIC_PATH);
    for (const c of criteria) {
      expect(typeof c).toBe("string");
      expect(c.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Circularity detection integration — simulate what the eval pipeline checks
// ---------------------------------------------------------------------------

describe("SLICE-103 — circularity detection simulation", () => {
  test("rubricScorer score() invokes judge.evaluate(), not a recursive inspector call", async () => {
    const judgeCallLog: string[] = [];
    const mockJudge: LLMJudge = {
      evaluate: async (_evalOpts) => {
        judgeCallLog.push("judge.evaluate called");
        return {
          pass: true,
          score: 0.9,
          rubricScores: {
            "verdict-accuracy": 3,
            "evidence-citation-correctness": 3,
            "risk-class-named": 3,
            "rationale-actionability": 3,
            "escalation-appropriateness": 3
          },
          rationale: "verdict matches; evidence cited; risk class named; actionable fix provided",
          cost_usd: 0,
          latency_ms: 5
        };
      },
      describe: () => ({ provider: "ollama", model: "llama3.2:latest" })
    };

    const scorer = rubricScorer(mockJudge);

    const run = makeAgentRun(
      "[HIGH] Null guard removed on line 12 of order-processor.ts. " +
        "Accessing order.items on null will throw. Restore `if (!order) return;`."
    );

    const expected = {
      id: "inspector-bug-001",
      input: null as unknown,
      held_out: false,
      rubric: [
        "verdict-accuracy",
        "evidence-citation-correctness",
        "risk-class-named",
        "rationale-actionability",
        "escalation-appropriateness"
      ]
    };

    const result = await scorer.score(run, expected);

    // Judge was called (not crew:inspector)
    expect(judgeCallLog).toContain("judge.evaluate called");
    expect(judgeCallLog.length).toBe(1);

    // Score is valid (0–1 range)
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);

    // No circular warning in rationale
    expect(result.rationale).not.toContain("scorer_circular");
    expect(result.rationale).not.toContain("inspector_grades_inspector");
  });

  test("describe() on a non-circular judge returns a non-inspector provider", () => {
    const judge = makeMockJudge({ id: "groq:llama-3.3-70b" });
    const { provider } = judge.describe();
    expect(provider).not.toContain("inspector");
    expect(provider).not.toBe("crew:inspector");
  });
});
