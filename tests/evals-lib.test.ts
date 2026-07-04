/**
 * tests/evals-lib.test.ts
 *
 * Covers SLICE-88 acceptance criteria #6:
 *   - judge registry resolution (AC4)
 *   - all assert helper shapes
 *   - dry-run replay produces structured result
 * Minimum 6 cases; target 10+.
 */

import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Judge registry
import { JUDGE_REGISTRY } from "../evals/lib/judge.ts";

// Assert helpers
import {
  assertContains,
  assertNotContains,
  assertRegex,
  assertArtifactExists,
  assertJsonShape,
  assertToolCalled,
  assertDispatchedAgent,
  assertLlmRubric,
  runAssert
} from "../evals/lib/assert.ts";
import type { AssertInput } from "../evals/lib/assert.ts";

// Eval runner
import { runEval, findSpecByPromptId } from "../evals/lib/run-eval.ts";
import { recordItem } from "../evals/lib/langfuse-emit.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(candidateOutput: string, extras?: Partial<AssertInput>): AssertInput {
  return { candidateOutput, ...extras };
}

async function makeTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "evals-test-"));
}

/**
 * Build a minimal mock JudgeProvider (SLICE-107: must include evaluate() + describe()).
 * Tests that injected judges via AssertInput.judge or JUDGE_REGISTRY use this shape.
 */
function makeMockJudge(
  id: string,
  pass: boolean,
  rationale = "mock"
): import("../evals/lib/judge.ts").JudgeProvider {
  const score = pass ? 1 : 0;
  return {
    id,
    describe: () => ({ provider: "mock", model: "mock" }),
    evaluate: async () => ({
      pass,
      score,
      rubricScores: { default: score },
      rationale,
      cost_usd: 0,
      latency_ms: 1,
      raw: {}
    }),
    judge: async () => ({ pass, score, rationale, raw: {} })
  };
}

// ---------------------------------------------------------------------------
// AC4: JUDGE_REGISTRY exports both required keys
// ---------------------------------------------------------------------------

describe("JUDGE_REGISTRY", () => {
  test("exports generic-openai and groq keys", () => {
    assert.ok("generic-openai" in JUDGE_REGISTRY, "missing generic-openai");
    assert.ok("groq" in JUDGE_REGISTRY, "missing groq");
    assert.ok(Object.keys(JUDGE_REGISTRY).length >= 2, "registry has < 2 entries");
  });

  test("registry entries are async factory functions", async () => {
    const factory = JUDGE_REGISTRY["generic-openai"];
    if (!factory) throw new Error("generic-openai missing from JUDGE_REGISTRY");
    assert.equal(typeof factory, "function");
    // Instantiating with dummy creds; just checks constructor doesn't throw.
    const judge = await factory({
      baseUrl: "https://example.com",
      apiKey: "test",
      model: "gpt-test"
    });
    assert.ok(typeof judge.id === "string");
    assert.ok(typeof judge.judge === "function");
  });
});

// ---------------------------------------------------------------------------
// Assert helpers — one test per type
// ---------------------------------------------------------------------------

describe("assertContains", () => {
  test("passes when value is present", () => {
    const r = assertContains(makeInput("hello world"), "hello");
    assert.equal(r.pass, true);
  });

  test("fails when value is absent", () => {
    const r = assertContains(makeInput("hello world"), "missing");
    assert.equal(r.pass, false);
    assert.ok(r.message.includes("missing"));
  });
});

describe("assertNotContains", () => {
  test("passes when value is absent", () => {
    const r = assertNotContains(makeInput("clean output"), "forbidden");
    assert.equal(r.pass, true);
  });

  test("fails when value is present", () => {
    const r = assertNotContains(makeInput("I am Claude Code"), "I am Claude Code");
    assert.equal(r.pass, false);
  });
});

describe("assertRegex", () => {
  test("passes when pattern matches", () => {
    const r = assertRegex(makeInput("SLICE-88: shipped"), "SLICE-\\d+:");
    assert.equal(r.pass, true);
  });

  test("fails when pattern does not match", () => {
    const r = assertRegex(makeInput("no match here"), "SLICE-\\d+:");
    assert.equal(r.pass, false);
  });
});

describe("assertArtifactExists", () => {
  test("passes when file matching glob exists", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "20260621T123456-fullstack-dev.json"), "{}", "utf8");
    const r = await assertArtifactExists(
      makeInput("", { repoRoot: path.dirname(dir) }),
      `${path.basename(dir)}/20260621T*-fullstack-dev.json`
    );
    assert.equal(r.pass, true);
    await fs.rm(dir, { recursive: true });
  });

  test("fails when no file matches glob", async () => {
    const dir = await makeTempDir();
    const r = await assertArtifactExists(
      makeInput("", { repoRoot: path.dirname(dir) }),
      `${path.basename(dir)}/nonexistent-*.json`
    );
    assert.equal(r.pass, false);
    await fs.rm(dir, { recursive: true });
  });
});

describe("assertJsonShape", () => {
  test("passes when all required keys present", () => {
    const r = assertJsonShape(
      makeInput(JSON.stringify({ status: "completed", confidence: "high" })),
      ["status", "confidence"]
    );
    assert.equal(r.pass, true);
  });

  test("fails when JSON is invalid", () => {
    const r = assertJsonShape(makeInput("not json"), ["key"]);
    assert.equal(r.pass, false);
    assert.ok(r.message.includes("not valid JSON"));
  });

  test("fails when required key is missing", () => {
    const r = assertJsonShape(makeInput(JSON.stringify({ a: 1 })), ["a", "b"]);
    assert.equal(r.pass, false);
    assert.ok(r.message.includes("b"));
  });
});

describe("assertToolCalled", () => {
  test("passes when tool is in trace", () => {
    const r = assertToolCalled(
      makeInput("output", { trace: { toolCalls: [{ name: "Write" }, { name: "Read" }] } }),
      "Write"
    );
    assert.equal(r.pass, true);
  });

  test("fails when tool is not in trace", () => {
    const r = assertToolCalled(
      makeInput("output", { trace: { toolCalls: [{ name: "Read" }] } }),
      "Bash"
    );
    assert.equal(r.pass, false);
  });

  test("fails without trace", () => {
    const r = assertToolCalled(makeInput("output"), "Write");
    assert.equal(r.pass, false);
    assert.ok(r.message.includes("no trace"));
  });
});

describe("assertDispatchedAgent", () => {
  test("passes when agent was dispatched", () => {
    const r = assertDispatchedAgent(
      makeInput("output", { trace: { dispatches: [{ agent: "reviewer" }] } }),
      "reviewer"
    );
    assert.equal(r.pass, true);
  });

  test("fails when agent was not dispatched", () => {
    const r = assertDispatchedAgent(
      makeInput("output", { trace: { dispatches: [] } }),
      "reviewer"
    );
    assert.equal(r.pass, false);
  });
});

describe("assertLlmRubric (SLICE-B2)", () => {
  test("fails gracefully with unknown provider when no judge injected", async () => {
    // Without a judge injected, assertLlmRubric falls back to "groq" in JUDGE_REGISTRY.
    // In test env GROQ_API_KEY is not set; the factory will instantiate GroqJudge
    // which will throw on actual HTTP call. We provide judgeProviderId="nonexistent-xyz"
    // to get a deterministic "unknown provider" failure instead.
    const r = await assertLlmRubric(
      makeInput("any output", { judgeProviderId: "nonexistent-xyz" }),
      "some rubric"
    );
    assert.equal(r.pass, false);
    assert.ok(r.message.includes("nonexistent-xyz"));
  });

  test("passes when judge injected and returns pass=true", async () => {
    const mockJudge = makeMockJudge("mock", true, "passes");
    const r = await assertLlmRubric(makeInput("any output", { judge: mockJudge }), "some rubric");
    assert.equal(r.pass, true);
    assert.ok(r.message.includes("PASS"));
  });
});

// ---------------------------------------------------------------------------
// runAssert dispatch table
// ---------------------------------------------------------------------------

describe("runAssert dispatch", () => {
  test("routes contains type correctly", async () => {
    const r = await runAssert({ type: "contains", value: "hello" }, makeInput("say hello"));
    assert.equal(r.pass, true);
  });

  test("routes llm-rubric with injected mock judge", async () => {
    const mockJudge = makeMockJudge("mock", true, "ok");
    const r = await runAssert(
      { type: "llm-rubric", rubric: "check this" },
      makeInput("output", { judge: mockJudge })
    );
    assert.equal(r.pass, true);
  });
});

// ---------------------------------------------------------------------------
// Dry-run replay: reads fixture and produces structured result
// ---------------------------------------------------------------------------

describe("runEval (dry-run)", () => {
  test("produces structured EvalRunResult from reference spec", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const specFile = path.join(repoRoot, "evals", "agents", "crew-fullstack-dev.yaml");
    const result = await runEval({ specFile, repoRoot, dryRun: true });

    assert.equal(result.promptId, "fullstack-dev");
    assert.equal(result.dryRun, true);
    assert.ok(typeof result.timestamp === "string");
    assert.ok(Array.isArray(result.tests));
    assert.ok(
      result.tests.length >= 8,
      "expected at least 8 tests (2 original + 5 SLICE-92 + 1 SLICE-93)"
    );
    assert.ok(typeof result.summary.total === "number");
    assert.ok(typeof result.summary.passed === "number");
    assert.ok(typeof result.summary.failed === "number");
  });

  test("identity-anchor-holds test: both asserts pass against good-response fixture", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const specFile = path.join(repoRoot, "evals", "agents", "crew-fullstack-dev.yaml");
    const result = await runEval({ specFile, repoRoot, dryRun: true });

    const identityTest = result.tests.find((t) => t.name === "identity-anchor-holds");
    assert.ok(identityTest, "identity-anchor-holds test not found");
    // Dry-run fixture is the pre-captured agent response (not the leak prompt).
    // It contains "fullstack-dev" and does NOT contain "I am Claude Code".
    assert.equal(identityTest.pass, true, "identity-anchor-holds should pass");

    const containsAssert = identityTest.asserts.find((a) => a.type === "contains");
    assert.ok(containsAssert, "contains assert not found");
    assert.equal(containsAssert.pass, true, "fullstack-dev should be found in response fixture");

    const notContainsAssert = identityTest.asserts.find((a) => a.type === "not-contains");
    assert.ok(notContainsAssert, "not-contains assert not found");
    assert.equal(
      notContainsAssert.pass,
      true,
      "I am Claude Code should NOT be in response fixture"
    );
  });
});

// ---------------------------------------------------------------------------
// findSpecByPromptId
// ---------------------------------------------------------------------------

describe("findSpecByPromptId", () => {
  test("finds reference spec by prompt_id", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const agentsDir = path.join(repoRoot, "evals", "agents");
    const found = await findSpecByPromptId("fullstack-dev", agentsDir);
    assert.ok(found !== null, "expected to find fullstack-dev spec");
    assert.ok(found?.endsWith("crew-fullstack-dev.yaml"));
  });

  test("returns null for unknown prompt_id", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const agentsDir = path.join(repoRoot, "evals", "agents");
    const found = await findSpecByPromptId("nonexistent-agent-xyz", agentsDir);
    assert.equal(found, null);
  });
});

// ---------------------------------------------------------------------------
// validate_with disagreement flow (SLICE-91 AC1, AC2, AC3)
// ---------------------------------------------------------------------------

describe("validate_with disagreement flow (SLICE-91)", () => {
  test("AC1: disagreement=true when primary=FAIL and validate_with=PASS", async () => {
    JUDGE_REGISTRY["mock-fail-91"] = async () => makeMockJudge("mock-fail-91", false, "mock fail");
    JUDGE_REGISTRY["mock-pass-91"] = async () => makeMockJudge("mock-pass-91", true, "mock pass");

    const dir = await makeTempDir();
    try {
      await fs.writeFile(path.join(dir, "fixture.txt"), "test candidate output", "utf8");
      const specYaml = `prompt_id: test-disagree-91
judge:
  provider: mock-fail-91
validate_with:
  - provider: mock-pass-91
tests:
  - name: disagree-case
    fixture: fixture.txt
    assert:
      - type: llm-rubric
        rubric: test rubric
`;
      const specFile = path.join(dir, "spec.yaml");
      await fs.writeFile(specFile, specYaml, "utf8");

      const result = await runEval({ specFile, repoRoot: dir, dryRun: false });

      assert.equal(result.tests.length, 1);
      const t = result.tests[0];
      assert.ok(t !== undefined, "test result missing");
      assert.equal(t?.pass, false, "primary should fail");
      assert.equal(t?.disagreement, true, "expected disagreement=true");
      assert.ok(Array.isArray(t?.validations), "expected validations array");
      assert.equal(t?.validations?.length, 1);
      assert.equal(t?.validations?.[0]?.verdict, "pass");
      assert.equal(t?.validations?.[0]?.judge, "mock-pass-91");
    } finally {
      await fs.rm(dir, { recursive: true });
      delete JUDGE_REGISTRY["mock-fail-91"];
      delete JUDGE_REGISTRY["mock-pass-91"];
    }
  });

  test("AC2: disagreement=false when primary and validate_with both pass (forceValidate=true)", async () => {
    JUDGE_REGISTRY["mock-pass-91b"] = async () => makeMockJudge("mock-pass-91b", true, "mock pass");

    const dir = await makeTempDir();
    try {
      await fs.writeFile(path.join(dir, "fixture.txt"), "test candidate output", "utf8");
      const specYaml = `prompt_id: test-agree-91
validate_with:
  - provider: mock-pass-91b
tests:
  - name: agree-case
    fixture: fixture.txt
    assert:
      - type: contains
        value: candidate
`;
      const specFile = path.join(dir, "spec.yaml");
      await fs.writeFile(specFile, specYaml, "utf8");

      const result = await runEval({ specFile, repoRoot: dir, dryRun: false, validate: true });

      assert.equal(result.tests.length, 1);
      const t = result.tests[0];
      assert.ok(t !== undefined, "test result missing");
      assert.equal(t?.pass, true, "primary should pass");
      assert.equal(t?.disagreement, false, "expected disagreement=false when both agree");
      assert.ok(Array.isArray(t?.validations), "expected validations array");
      assert.equal(t?.validations?.[0]?.verdict, "pass");
    } finally {
      await fs.rm(dir, { recursive: true });
      delete JUDGE_REGISTRY["mock-pass-91b"];
    }
  });

  test("AC3: recordItem emits validations array and disagreement in POST payload", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origFetch = (globalThis as any).fetch as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
      if (String(url).includes("/dataset-items")) capturedBody = body;
      return new Response(JSON.stringify({ id: "test-run", name: "test-run" }), { status: 200 });
    };

    const prevPub = process.env["LANGFUSE_PUBLIC_KEY"];
    const prevSec = process.env["LANGFUSE_SECRET_KEY"];
    process.env["LANGFUSE_PUBLIC_KEY"] = "test-pub";
    process.env["LANGFUSE_SECRET_KEY"] = "test-sec";

    try {
      await recordItem({
        runId: "test-run",
        testName: "my-test",
        pass: false,
        durationMs: 42,
        asserts: [{ type: "llm-rubric", pass: false, message: "fail" }],
        validations: [{ judge: "mock-pass-91", verdict: "pass", rationale: "ok" }],
        disagreement: true
      });

      assert.ok(capturedBody !== null, "fetch was not called for dataset-items endpoint");
      const output = capturedBody["output"] as Record<string, unknown>;
      assert.ok(Array.isArray(output["validations"]), "output.validations should be array");
      assert.equal((output["validations"] as unknown[]).length, 1);
      assert.equal(output["disagreement"], true);
      const meta = capturedBody["metadata"] as Record<string, unknown>;
      assert.equal(meta["disagreement"], true);
      assert.equal(meta["validationCount"], 1);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = origFetch;
      if (prevPub === undefined) delete process.env["LANGFUSE_PUBLIC_KEY"];
      else process.env["LANGFUSE_PUBLIC_KEY"] = prevPub;
      if (prevSec === undefined) delete process.env["LANGFUSE_SECRET_KEY"];
      else process.env["LANGFUSE_SECRET_KEY"] = prevSec;
    }
  });
});
