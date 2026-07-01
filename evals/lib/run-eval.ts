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
import { dispatchCandidate } from "./candidate-dispatch.ts";
import type { BudgetMeter } from "@astragenie/gepa-core";
import { withBudget } from "./with-budget.ts";
import { passthroughMeter } from "./meter.ts";

// ---------------------------------------------------------------------------
// Eval spec types (matches evals/agents/*.yaml shape)
// ---------------------------------------------------------------------------

interface EvalTest {
  name: string;
  fixture?: string;
  assert: AssertSpec[];
}

/** Budget block from evals/agents/<agent>.yaml (SLICE-111 FEAT-186 S2). */
export interface EvalSpecBudget {
  /** Per-agent daily cap in USD. */
  daily_cap_usd: number;
  /** Persist path for the meter state file. Defaults derived from agent name in cli.ts. */
  persist_path?: string;
  /** Override per-provider cost ceiling estimates (USD). Merged with defaults. */
  provider_ceilings?: Record<string, number>;
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
  /** SLICE-111: optional budget enforcement block. */
  budget?: EvalSpecBudget;
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
  /** FEAT-174: human-readable duration (durationMs / 1000, rounded to 0.1s). */
  durationSec: number;
  /** validate_with entries — present when disagreement flow ran. */
  validations?: ValidationEntry[];
  /** true when primary verdict and any validate_with verdict disagree. */
  disagreement?: boolean;
  /** FEAT-174: captured candidate response (truncated at 8KB). */
  candidateOutput?: string;
  /** FEAT-174: captured fixture content (truncated at 4KB). */
  fixtureContent?: string;
  /** FEAT-174: rationale from llm-rubric asserts (judge YES/NO + explanation). */
  judgeRationales?: string[];
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
  /** FEAT-174: total wall-clock duration of the run in seconds. */
  totalDurationSec?: number;
  /** FEAT-174: prompt_version from agent frontmatter at run time. */
  promptVersion?: string;
  /** FEAT-174: git SHA at run time for reproducibility. */
  gitSha?: string;
  /** FEAT-174: judge id used for the run (e.g. claude-p). */
  judgeId?: string;
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
  forceValidate: boolean,
  // SLICE-107 (FEAT-184 S2, AC-5): forward Langfuse provenance to validate_with
  // judges (Azure / Bedrock) — without this, validation-tier traces lack
  // fixture + promptId. Optional so callers without context still type-check.
  context?: { fixture?: string; promptId?: string; version?: string }
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
        // SLICE-107 (FEAT-184 S2): use evaluate() with context forwarding (AC-5).
        const evalResult = await judge.evaluate({
          candidateOutput,
          expected: { id: "", input: null, held_out: false },
          rubric: [rubric],
          ...(context !== undefined ? { context } : {})
        });
        const verdictStr = evalResult.pass ? "pass" : "fail";
        entries[idx] = {
          judge: judge.id,
          verdict: verdictStr,
          rationale: evalResult.rationale
        };
        if (evalResult.pass !== primaryPass) {
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
  let fixtureContent = "";
  let trace: Record<string, unknown> | undefined;

  if (test.fixture) {
    const { text, parsed } = await loadFixture(test.fixture, repoRoot);
    fixtureContent = text;
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
  const durationMs = Date.now() - start;
  return makeResult(test.name, pass, assertResults, durationMs, candidateOutput, fixtureContent);
}

// FEAT-174 helpers — capture rich context per TestResult
const MAX_CANDIDATE_BYTES = 8000;
const MAX_FIXTURE_BYTES = 4000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

function durationSecFromMs(ms: number): number {
  return Math.round((ms / 1000) * 10) / 10;
}

function extractJudgeRationales(
  asserts: Array<{ type: string; pass: boolean; message: string }>
): string[] {
  return asserts
    .filter((a) => a.type === "llm-rubric")
    .map((a) => a.message);
}

function makeResult(
  name: string,
  pass: boolean,
  asserts: Array<{ type: string; pass: boolean; message: string }>,
  durationMs: number,
  candidateOutput: string,
  fixtureContent: string
): TestResult {
  const result: TestResult = {
    name,
    pass,
    asserts,
    durationMs,
    durationSec: durationSecFromMs(durationMs)
  };
  if (candidateOutput.length > 0) result.candidateOutput = truncate(candidateOutput, MAX_CANDIDATE_BYTES);
  if (fixtureContent.length > 0) result.fixtureContent = truncate(fixtureContent, MAX_FIXTURE_BYTES);
  const rationales = extractJudgeRationales(asserts);
  if (rationales.length > 0) result.judgeRationales = rationales;
  return result;
}

// ---------------------------------------------------------------------------
// Live test: dispatch candidate + run asserts against real output
// ---------------------------------------------------------------------------

async function liveTest(
  test: EvalTest,
  repoRoot: string,
  judge: JudgeProvider | null,
  validateWithCfgs: NonNullable<EvalSpec["validate_with"]>,
  forceValidate: boolean,
  candidateLive: boolean,
  candidateCfg: EvalSpec["candidate"],
  promptId: string
): Promise<TestResult> {
  const start = Date.now();

  let candidateOutput = "";
  let trace: Record<string, unknown> | undefined;
  let fixtureText = "";

  if (test.fixture) {
    const { text, parsed } = await loadFixture(test.fixture, repoRoot);
    fixtureText = text;
    if (parsed && typeof parsed["candidateOutput"] === "string") {
      candidateOutput = parsed["candidateOutput"];
      trace = parsed;
    } else {
      candidateOutput = text;
    }
  }

  // FEAT-171: When --candidate-live AND candidate.runner = claude-p, dispatch
  // the candidate agent against the fixture input and use its response as
  // candidateOutput. Otherwise fall through to the SLICE-89 behavior of
  // treating fixture text as candidate output directly.
  if (candidateLive && candidateCfg?.runner === "claude-p" && fixtureText.length > 0) {
    const agentPromptPath = path.join(repoRoot, "agents", `${promptId}.md`);
    try {
      const dispatch = await dispatchCandidate({
        agentPromptPath,
        fixtureContent: fixtureText,
        model: candidateCfg.model ?? "claude-sonnet-4-6"
      });
      candidateOutput = dispatch.candidateOutput;
      trace = undefined; // live dispatch overrides any structured trace
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface as test-level error rather than crashing the whole run
      const dms = Date.now() - start;
      return {
        name: test.name,
        pass: false,
        error: `candidate-dispatch failed: ${msg}`,
        asserts: [],
        durationMs: dms,
        durationSec: durationSecFromMs(dms),
        fixtureContent: truncate(fixtureText, MAX_FIXTURE_BYTES)
      };
    }
  }

  // SLICE-107 (FEAT-184 S2, AC-5): forward context so evaluate() opts.context
  // carries fixture + promptId for Langfuse provenance.
  const assertContext: AssertInput["context"] = { promptId };
  // fixture is optional — only set when present (exactOptionalPropertyTypes)
  if (test.fixture !== undefined) assertContext.fixture = test.fixture;
  const baseInput: AssertInput = {
    candidateOutput,
    repoRoot,
    context: assertContext
  };
  if (judge !== null) baseInput.judge = judge;
  const input: AssertInput =
    trace !== undefined ? { ...baseInput, trace } : baseInput;

  const assertResults: Array<{ type: string; pass: boolean; message: string }> = [];

  for (const spec of test.assert) {
    const result = await runAssert(spec, input);
    assertResults.push({ type: spec.type, pass: result.pass, message: result.message });
  }

  const primaryPass = assertResults.every((r) => r.pass);
  const dms = Date.now() - start;
  const testResult: TestResult = makeResult(
    test.name,
    primaryPass,
    assertResults,
    dms,
    candidateOutput,
    fixtureText
  );

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
      forceValidate,
      // AC-5: thread the same context built for primary asserts into the
      // validate_with chain so Azure/Bedrock judges get fixture+promptId too.
      assertContext
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
  /**
   * FEAT-171: dispatch the candidate agent (`candidate.runner: claude-p`)
   * against fixture input and assert against its actual response, not the
   * fixture text. Requires claude CLI on PATH + Pro/Max subscription auth.
   * Skipped when false (legacy SLICE-89 behavior — fixture used as candidate).
   */
  candidateLive?: boolean;
  /**
   * SLICE-111 (FEAT-186 S2): optional pre-constructed BudgetMeter to enforce
   * a daily cap on judge calls. When absent, a passthrough meter is used so
   * behavior is byte-for-byte identical to pre-SLICE-111 runs (AC-4).
   */
  meter?: BudgetMeter;
  /**
   * SLICE-111: optional provider ceiling overrides forwarded to withBudget
   * when wrapping judges. Merged with DEFAULT_PROVIDER_CEILINGS in meter.ts.
   */
  providerCeilings?: Record<string, number>;
}): Promise<EvalRunResult> {
  const {
    specFile,
    repoRoot,
    dryRun,
    validate: forceValidate = false,
    candidateLive = false,
    meter: injectedMeter,
    providerCeilings
  } = options;

  const runStart = Date.now();
  const raw = await fs.readFile(specFile, "utf8");
  const spec = parseYaml(raw) as EvalSpec;

  // FEAT-174: capture prompt version + git SHA for run reproducibility.
  const promptVersion = await readPromptVersion(repoRoot, spec.prompt_id);
  const gitSha = await readGitSha(repoRoot);

  // SLICE-111: use injected meter or fall back to passthrough (AC-4 no-op mode).
  const activeMeter: BudgetMeter = injectedMeter ?? passthroughMeter();

  // Resolve judge for live mode (needed by llm-rubric asserts)
  let judge: JudgeProvider | null = null;
  let judgeErrors: string[] = [];
  if (!dryRun) {
    const resolved = await resolveJudge(spec.judge);
    // SLICE-111: wrap judge with budget enforcement (passthrough meter = no-op).
    judge = resolved.judge !== null
      ? (withBudget(resolved.judge, activeMeter, providerCeilings) as JudgeProvider)
      : null;
    judgeErrors = resolved.errors;
  }

  const validateWithCfgs = spec.validate_with ?? [];

  const testResults: TestResult[] = [];
  for (const test of spec.tests) {
    if (dryRun) {
      testResults.push(await dryRunTest(test, repoRoot));
    } else {
      testResults.push(
        await liveTest(
          test,
          repoRoot,
          judge,
          validateWithCfgs,
          forceValidate,
          candidateLive,
          spec.candidate,
          spec.prompt_id
        )
      );
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
    summary: { total: testResults.length, passed, failed, errored },
    totalDurationSec: durationSecFromMs(Date.now() - runStart)
  };

  if (promptVersion) result.promptVersion = promptVersion;
  if (gitSha) result.gitSha = gitSha;
  if (judge?.id) result.judgeId = judge.id;

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

// ---------------------------------------------------------------------------
// FEAT-174: prompt version + git SHA capture for run reproducibility
// ---------------------------------------------------------------------------

async function readPromptVersion(repoRoot: string, promptId: string): Promise<string | null> {
  try {
    const promptPath = path.join(repoRoot, "agents", `${promptId}.md`);
    const raw = await fs.readFile(promptPath, "utf8");
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch || !fmMatch[1]) return null;
    const versionMatch = fmMatch[1].match(/^version:\s*(.+)$/m);
    return versionMatch?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function readGitSha(repoRoot: string): Promise<string | null> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    let out = "";
    child.stdout.on("data", (b: Buffer) => {
      out += b.toString("utf8");
    });
    child.on("close", (code) => {
      resolve(code === 0 ? out.trim() : null);
    });
    child.on("error", () => {
      resolve(null);
    });
  });
}
