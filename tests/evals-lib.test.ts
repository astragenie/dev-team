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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(candidateOutput: string, extras?: Partial<AssertInput>): AssertInput {
  return { candidateOutput, ...extras };
}

async function makeTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "evals-test-"));
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
      makeInput("output", { trace: { dispatches: [{ agent: "inspector" }] } }),
      "inspector"
    );
    assert.equal(r.pass, true);
  });

  test("fails when agent was not dispatched", () => {
    const r = assertDispatchedAgent(
      makeInput("output", { trace: { dispatches: [] } }),
      "inspector"
    );
    assert.equal(r.pass, false);
  });
});

describe("assertLlmRubric (stub)", () => {
  test("always returns pass=true in SLICE-B1", () => {
    const r = assertLlmRubric(makeInput("any output"), "some rubric");
    assert.equal(r.pass, true);
    assert.ok(r.message.includes("SLICE-B2"));
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

  test("routes llm-rubric to stub", async () => {
    const r = await runAssert({ type: "llm-rubric", rubric: "check this" }, makeInput("output"));
    assert.equal(r.pass, true);
  });
});

// ---------------------------------------------------------------------------
// Dry-run replay: reads fixture and produces structured result
// ---------------------------------------------------------------------------

describe("runEval (dry-run)", () => {
  test("errors without --dry-run flag", async () => {
    await assert.rejects(
      () => runEval({ specFile: "does-not-matter.yaml", repoRoot: process.cwd(), dryRun: false }),
      /SLICE-B2/
    );
  });

  test("produces structured EvalRunResult from reference spec", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const specFile = path.join(repoRoot, "evals", "agents", "crew-fullstack-dev.yaml");
    const result = await runEval({ specFile, repoRoot, dryRun: true });

    assert.equal(result.promptId, "fullstack-dev");
    assert.equal(result.dryRun, true);
    assert.ok(typeof result.timestamp === "string");
    assert.ok(Array.isArray(result.tests));
    assert.ok(result.tests.length >= 2, "expected at least 2 tests");
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
