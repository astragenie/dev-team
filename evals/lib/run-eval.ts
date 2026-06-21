/**
 * YAML loader + dry-run replay dispatcher + assert orchestration.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): dry-run replay only.
 * SLICE-89 (FEAT-169 SLICE-B2): live candidate dispatch + judge fallback chain.
 * SLICE-90 (FEAT-169 SLICE-B3): validate_with disagreement flow + Langfuse emit.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { runAssert } from "./assert.ts";
import { JUDGE_REGISTRY } from "./judge.ts";
import type { JudgeProvider } from "./judge.ts";
import type { AssertInput, AssertSpec } from "./assert.ts";
import { ensureDataset, recordRun, recordItem } from "./langfuse-emit.ts";

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

/** One validate_with judge verdict recorded alongside the primary verdict. */
export interface ValidationEntry {
  judge: string;
  verdict: "pass" | "fail" | "skipped";
  rationale: string;
}

export interface TestResult {
  name: string;
  pass: boolean;
  /** Set when the test could not be evaluated due to infrastructure error. */
  error?: string;
  asserts: Array<{ type: string; pass: boolean; message: string }>;
  durationMs: number;
  /** validate_with entries — present when disagreement flow ran. */
  validations?: ValidationEntry[];
  /** true when primary verdict and any validate_with verdict disagree. */
  disagreement?: boolean;
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
// validate_with disagreement flow
// ---------------------------------------------------------------------------

type ValidateWithCfg = NonNullable<EvalSpec["validate_with"]>[number];

/**
 * Resolve a single validate_with judge entry into a JudgeProvider.
 * Returns null + records error on failure (skipped verdict).
 */
async function resolveValidateJudge(
  cfg: ValidateWithCfg
): Promise<{ judge: JudgeProvider | null; error?: string }> {
  const factory = JUDGE_REGISTRY[cfg.provider];
  if (!factory) {
    return { judge: null, error: `unknown validate_with provider: ${cfg.provider}` };
  }
  try {
    const judge = await factory({
      model: cfg.model,
      apiKey: cfg.api_key,
      endpoint: cfg.endpoint,
      deployment: cfg.deployment,
      region: cfg.region
    } as Parameters<typeof factory>[0]);
    return { judge };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { judge: null, error: `${cfg.provider}: ${msg}` };
  }
}

/**
 * Run the validate_with chain for a given primary pass/fail verdict.
 * Fires when: primaryPass !== any validate_with verdict OR forceValidate=true.
 * Returns validation entries and whether a disagreement was detected.
 */
async function runValidateWith(
  validateWithCfgs: ValidateWithCfg[],
  rubric: string,
  candidateOutput: string,
  primaryPass: boolean,
  forceValidate: boolean
): Promise<{ entries: ValidationEntry[]; disagreement: boolean }> {
  // Resolve all validate_with judges in parallel
  const resolved = await Promise.all(validateWithCfgs.map((cfg) => resolveValidateJudge(cfg)));

  const entries: ValidationEntry[] = [];
  let anyDisagreement = false;

  await Promise.all(
    resolved.map(async ({ judge, error }, idx) => {
      if (!judge) {
        entries[idx] = {
          judge: validateWithCfgs[idx]?.provider ?? "unknown",
          verdict: "skipped",
          rationale: error ?? "judge unavailable"
        };
        return;
      }

      try {
        const result = await judge.judge({ rubric, candidateOutput });
        const verdictStr = result.pass ? "pass" : "fail";
        entries[idx] = {
          judge: judge.id,
          verdict: verdictStr,
          rationale: result.rationale
        };
        if (result.pass !== primaryPass) {
          anyDisagreement = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        entries[idx] = {
          judge: judge.id,
          verdict: "skipped",
          rationale: `judge error: ${msg}`
        };
      }
    })
  );

  // Filter out any sparse slots (shouldn't happen, but defensive)
  const filteredEntries = entries.filter(Boolean);

  // Check if we should actually return results:
  // Only return if forceValidate OR there was a disagreement
  if (!forceValidate && !anyDisagreement) {
    return { entries: [], disagreement: false };
  }

  return { entries: filteredEntries, disagreement: anyDisagreement };
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
  judge: JudgeProvider | null,
  validateWithCfgs: NonNullable<EvalSpec["validate_with"]>,
  forceValidate: boolean
): Promise<TestResult> {
  const start = Date.now();

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

  const primaryPass = assertResults.every((r) => r.pass);
  const testResult: TestResult = {
    name: test.name,
    pass: primaryPass,
    asserts: assertResults,
    durationMs: Date.now() - start
  };

  // validate_with disagreement flow
  if (validateWithCfgs.length > 0) {
    // Build a combined rubric from llm-rubric asserts, or use a summary rubric
    const rubrics = test.assert
      .filter((a) => a.type === "llm-rubric")
      .map((a) => a.rubric ?? a.value ?? "");
    const combinedRubric =
      rubrics.length > 0 ? rubrics.join("; ") : `All asserts pass for test: ${test.name}`;

    const { entries, disagreement } = await runValidateWith(
      validateWithCfgs,
      combinedRubric,
      candidateOutput,
      primaryPass,
      forceValidate
    );

    if (entries.length > 0 || forceValidate) {
      testResult.validations = entries;
      testResult.disagreement = disagreement;
    }
  }

  return testResult;
}

// ---------------------------------------------------------------------------
// Main entry: load spec + run tests
// ---------------------------------------------------------------------------

export async function runEval(options: {
  specFile: string;
  repoRoot: string;
  dryRun: boolean;
  /** Force validate_with chain on every test, even when primary passes. */
  validate?: boolean;
}): Promise<EvalRunResult> {
  const { specFile, repoRoot, dryRun, validate: forceValidate = false } = options;

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

  const validateWithCfgs = spec.validate_with ?? [];

  const testResults: TestResult[] = [];
  for (const test of spec.tests) {
    if (dryRun) {
      testResults.push(await dryRunTest(test, repoRoot));
    } else {
      testResults.push(await liveTest(test, repoRoot, judge, validateWithCfgs, forceValidate));
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

  // Langfuse dataset emit (skips silently if LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY absent)
  if (!dryRun) {
    const judgeId = judge?.id ?? "unknown";
    await emitToLangfuse(spec.prompt_id, judgeId, testResults).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`langfuse: emit failed: ${msg}\n`);
    });
  }

  return result;
}

/**
 * Emit the test results to Langfuse as a dataset run.
 * All errors are caught by the caller; this function is fire-and-try.
 */
async function emitToLangfuse(
  promptId: string,
  judgeId: string,
  testResults: TestResult[]
): Promise<void> {
  const datasetId = await ensureDataset(promptId);
  if (datasetId === null) return; // keys absent — already warned

  const runId = await recordRun({ datasetId, promptId, judgeId });
  if (runId === null) return;

  await Promise.all(
    testResults.map((t) => {
      const item: Parameters<typeof recordItem>[0] = {
        runId,
        testName: t.name,
        pass: t.pass,
        durationMs: t.durationMs,
        asserts: t.asserts
      };
      if (t.validations !== undefined) item.validations = t.validations;
      if (t.disagreement !== undefined) item.disagreement = t.disagreement;
      return recordItem(item);
    })
  );
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
