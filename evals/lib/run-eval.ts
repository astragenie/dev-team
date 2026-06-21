/**
 * YAML loader + dry-run replay dispatcher + assert orchestration.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): dry-run replay only.
 * SLICE-89 (FEAT-169 SLICE-B2): live candidate dispatch + judge fallback chain.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { runAssert } from "./assert.ts";
import { JUDGE_REGISTRY } from "./judge.ts";
import type { JudgeProvider } from "./judge.ts";
import type { AssertInput, AssertSpec } from "./assert.ts";

// ---------------------------------------------------------------------------
// Eval spec types (matches evals/agents/*.yaml shape)
// ---------------------------------------------------------------------------

interface EvalTest {
  name: string;
  fixture?: string;
  assert: AssertSpec[];
}

interface EvalSpec {
  prompt_id: string;
  versions_under_test?: string[];
  candidate?: { runner: string; model?: string; subscription?: boolean };
  judge?: {
    provider: string;
    model?: string;
    api_key?: string;
    temperature?: number;
    fallback?: Array<{ provider: string; model?: string }>;
  };
  validate_with?: Array<{
    provider: string;
    model?: string;
    endpoint?: string;
    deployment?: string;
    api_key?: string;
    region?: string;
  }>;
  tests: EvalTest[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface TestResult {
  name: string;
  pass: boolean;
  /** Set when the test could not be evaluated due to infrastructure error. */
  error?: string;
  asserts: Array<{ type: string; pass: boolean; message: string }>;
  durationMs: number;
}

export interface EvalRunResult {
  promptId: string;
  specFile: string;
  dryRun: boolean;
  timestamp: string;
  tests: TestResult[];
  summary: { total: number; passed: number; failed: number; errored: number };
  /** Judge resolution errors from fallback chain — non-fatal if heuristic asserts still ran. */
  judgeErrors?: string[];
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

async function loadFixture(
  fixtureRef: string,
  repoRoot: string
): Promise<{ text: string; parsed: Record<string, unknown> | null }> {
  // Resolve "file://evals/fixtures/foo.json" → absolute path
  const normalized = fixtureRef.startsWith("file://")
    ? fixtureRef.slice("file://".length)
    : fixtureRef;
  const abs = path.isAbsolute(normalized) ? normalized : path.join(repoRoot, normalized);
  const raw = await fs.readFile(abs, "utf8");
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // plain-text fixture — leave parsed as null
  }
  return { text: raw, parsed };
}

// ---------------------------------------------------------------------------
// Judge resolution with fallback chain
// ---------------------------------------------------------------------------

interface JudgeCfg {
  provider: string;
  model?: string;
  api_key?: string;
  temperature?: number;
  fallback?: Array<{ provider: string; model?: string }>;
}

/**
 * Resolve a JudgeProvider from the spec judge config, trying the primary
 * provider first, then iterating the fallback array on error.
 * Returns { judge, errors } where errors is the chain of failures if any.
 */
async function resolveJudge(
  judgeSpec: JudgeCfg | undefined
): Promise<{ judge: JudgeProvider | null; errors: string[] }> {
  const errors: string[] = [];
  const chain: Array<{ provider: string; model?: string | undefined }> = [];

  if (judgeSpec) {
    chain.push({ provider: judgeSpec.provider, model: judgeSpec.model });
    for (const fb of judgeSpec.fallback ?? []) {
      chain.push(fb);
    }
  } else {
    chain.push({ provider: "groq" });
  }

  for (const entry of chain) {
    const factory = JUDGE_REGISTRY[entry.provider];
    if (!factory) {
      errors.push(`unknown judge provider: ${entry.provider}`);
      continue;
    }
    try {
      const cfg = entry.model !== undefined ? { model: entry.model } : undefined;
      const judge = await factory(cfg);
      return { judge, errors };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${entry.provider}: ${msg}`);
    }
  }

  return { judge: null, errors };
}

// ---------------------------------------------------------------------------
// Dry-run replay: load fixture as candidate output, skip live dispatch
// ---------------------------------------------------------------------------

async function dryRunTest(test: EvalTest, repoRoot: string): Promise<TestResult> {
  const start = Date.now();
  let candidateOutput = "";
  let trace: Record<string, unknown> | undefined;

  if (test.fixture) {
    const { text, parsed } = await loadFixture(test.fixture, repoRoot);
    if (parsed && typeof parsed["candidateOutput"] === "string") {
      // Structured fixture: { candidateOutput, toolCalls, dispatches, ... }
      candidateOutput = parsed["candidateOutput"];
      trace = parsed;
    } else {
      // Plain-text fixture: the fixture IS the candidate output
      candidateOutput = text;
    }
  }

  const input: AssertInput =
    trace !== undefined ? { candidateOutput, trace, repoRoot } : { candidateOutput, repoRoot };
  const assertResults: Array<{ type: string; pass: boolean; message: string }> = [];

  for (const spec of test.assert) {
    const result = await runAssert(spec, input);
    assertResults.push({ type: spec.type, pass: result.pass, message: result.message });
  }

  const pass = assertResults.every((r) => r.pass);
  return {
    name: test.name,
    pass,
    asserts: assertResults,
    durationMs: Date.now() - start
  };
}

// ---------------------------------------------------------------------------
// Live test: dispatch candidate + run asserts against real output
// ---------------------------------------------------------------------------

async function liveTest(
  test: EvalTest,
  repoRoot: string,
  judge: JudgeProvider | null
): Promise<TestResult> {
  const start = Date.now();

  // For live mode, we still load the fixture for asserts that need it;
  // full candidate subprocess dispatch is SLICE-B3 (validate_with flow).
  // This slice wires up the judge + fallback chain and llm-rubric asserts.
  let candidateOutput = "";
  let trace: Record<string, unknown> | undefined;

  if (test.fixture) {
    const { text, parsed } = await loadFixture(test.fixture, repoRoot);
    if (parsed && typeof parsed["candidateOutput"] === "string") {
      candidateOutput = parsed["candidateOutput"];
      trace = parsed;
    } else {
      candidateOutput = text;
    }
  }

  const baseInput: AssertInput = { candidateOutput, repoRoot };
  if (judge !== null) baseInput.judge = judge;
  const input: AssertInput =
    trace !== undefined ? { ...baseInput, trace } : baseInput;

  const assertResults: Array<{ type: string; pass: boolean; message: string }> = [];

  for (const spec of test.assert) {
    const result = await runAssert(spec, input);
    assertResults.push({ type: spec.type, pass: result.pass, message: result.message });
  }

  const pass = assertResults.every((r) => r.pass);
  return {
    name: test.name,
    pass,
    asserts: assertResults,
    durationMs: Date.now() - start
  };
}

// ---------------------------------------------------------------------------
// Main entry: load spec + run tests
// ---------------------------------------------------------------------------

export async function runEval(options: {
  specFile: string;
  repoRoot: string;
  dryRun: boolean;
}): Promise<EvalRunResult> {
  const { specFile, repoRoot, dryRun } = options;

  const raw = await fs.readFile(specFile, "utf8");
  const spec = parseYaml(raw) as EvalSpec;

  // Resolve judge for live mode (needed by llm-rubric asserts)
  let judge: JudgeProvider | null = null;
  let judgeErrors: string[] = [];
  if (!dryRun) {
    const resolved = await resolveJudge(spec.judge);
    judge = resolved.judge;
    judgeErrors = resolved.errors;
  }

  const testResults: TestResult[] = [];
  for (const test of spec.tests) {
    if (dryRun) {
      testResults.push(await dryRunTest(test, repoRoot));
    } else {
      testResults.push(await liveTest(test, repoRoot, judge));
    }
  }

  const passed = testResults.filter((t) => t.pass && !t.error).length;
  const errored = testResults.filter((t) => !!t.error).length;
  const failed = testResults.length - passed - errored;

  const result: EvalRunResult = {
    promptId: spec.prompt_id,
    specFile,
    dryRun,
    timestamp: new Date().toISOString(),
    tests: testResults,
    summary: { total: testResults.length, passed, failed, errored }
  };

  // Surface judge resolution errors as metadata (non-fatal if all asserts passed heuristically)
  if (judgeErrors.length > 0) {
    result.judgeErrors = judgeErrors;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Spec discovery: find a spec file by prompt id
// ---------------------------------------------------------------------------

export async function findSpecByPromptId(
  promptId: string,
  agentsDir: string
): Promise<string | null> {
  let files: string[];
  try {
    files = await fs.readdir(agentsDir);
  } catch {
    return null;
  }
  for (const f of files) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const abs = path.join(agentsDir, f);
    const raw = await fs.readFile(abs, "utf8");
    const spec = parseYaml(raw) as { prompt_id?: string };
    if (spec.prompt_id === promptId) return abs;
  }
  return null;
}
