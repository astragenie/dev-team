/**
 * YAML loader + dry-run replay dispatcher + assert orchestration.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): dry-run replay only.
 * Live candidate subprocess dispatch ships in SLICE-B2.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { runAssert } from "./assert.ts";
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
  asserts: Array<{ type: string; pass: boolean; message: string }>;
  durationMs: number;
}

export interface EvalRunResult {
  promptId: string;
  specFile: string;
  dryRun: boolean;
  timestamp: string;
  tests: TestResult[];
  summary: { total: number; passed: number; failed: number };
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
// Main entry: load spec + run tests
// ---------------------------------------------------------------------------

export async function runEval(options: {
  specFile: string;
  repoRoot: string;
  dryRun: boolean;
}): Promise<EvalRunResult> {
  const { specFile, repoRoot, dryRun } = options;

  if (!dryRun) {
    throw new Error("live judge dispatch ships in SLICE-B2 — pass --dry-run");
  }

  const raw = await fs.readFile(specFile, "utf8");
  const spec = parseYaml(raw) as EvalSpec;

  const testResults: TestResult[] = [];
  for (const test of spec.tests) {
    const result = await dryRunTest(test, repoRoot);
    testResults.push(result);
  }

  const passed = testResults.filter((t) => t.pass).length;
  const failed = testResults.length - passed;

  return {
    promptId: spec.prompt_id,
    specFile,
    dryRun: true,
    timestamp: new Date().toISOString(),
    tests: testResults,
    summary: { total: testResults.length, passed, failed }
  };
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
