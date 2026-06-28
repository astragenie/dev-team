/**
 * Heuristic assert helpers for the pluggable agent eval framework.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1):
 *   contains / not-contains / regex / artifact-exists / json-shape / tool-called / dispatched-agent
 * SLICE-89 (FEAT-169 SLICE-B2):
 *   llm-rubric — real implementation dispatching the configured judge.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { JUDGE_REGISTRY } from "./judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export interface AssertInput {
  /** Candidate output text (handoff body / CLI stdout). */
  candidateOutput: string;
  /** Optional structured bundle parsed from the candidate output. */
  bundle?: Record<string, unknown>;
  /** Raw trace JSON if a fixture was loaded. */
  trace?: Record<string, unknown>;
  /** Repository root used for artifact-exists resolution. */
  repoRoot?: string;
  /**
   * Judge provider for llm-rubric asserts (SLICE-B2).
   * If not provided, falls back to the groq registry entry.
   * Pass a mock in tests.
   */
  judge?: LLMJudge;
  /** Judge provider id for lazy-loading from JUDGE_REGISTRY (default: groq). */
  judgeProviderId?: string;
  /**
   * AC-6 (FEAT-184): context forwarded to evaluate() for Langfuse provenance.
   */
  context?: {
    fixture?: string;
    promptId?: string;
    version?: string;
  };
}

export interface AssertResult {
  pass: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------

export function assertContains(input: AssertInput, value: string): AssertResult {
  const haystack = input.candidateOutput;
  const pass = haystack.includes(value);
  return {
    pass,
    message: pass ? `contains "${value}"` : `expected to contain "${value}" but did not`
  };
}

// ---------------------------------------------------------------------------
// not-contains
// ---------------------------------------------------------------------------

export function assertNotContains(input: AssertInput, value: string): AssertResult {
  const haystack = input.candidateOutput;
  const pass = !haystack.includes(value);
  return {
    pass,
    message: pass
      ? `does not contain "${value}"`
      : `expected NOT to contain "${value}" but found it`
  };
}

// ---------------------------------------------------------------------------
// regex
// ---------------------------------------------------------------------------

export function assertRegex(input: AssertInput, pattern: string, flags?: string): AssertResult {
  const re = new RegExp(pattern, flags);
  const pass = re.test(input.candidateOutput);
  return {
    pass,
    message: pass ? `matches /${pattern}/` : `expected to match /${pattern}/ but did not`
  };
}

// ---------------------------------------------------------------------------
// artifact-exists
// ---------------------------------------------------------------------------

export async function assertArtifactExists(
  input: AssertInput,
  globPattern: string
): Promise<AssertResult> {
  const root = input.repoRoot ?? process.cwd();
  // Resolve the pattern relative to root; support simple * wildcards via readdir scan.
  const parts = globPattern.split("/");
  const filename = parts.pop() ?? "";
  const dir = path.join(root, ...parts);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return { pass: false, message: `artifact dir "${dir}" not found` };
  }
  const re = new RegExp("^" + filename.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  const match = files.some((f) => re.test(f));
  return {
    pass: match,
    message: match
      ? `artifact matching "${globPattern}" exists`
      : `no artifact matching "${globPattern}" found in "${dir}"`
  };
}

// ---------------------------------------------------------------------------
// json-shape
// ---------------------------------------------------------------------------

export function assertJsonShape(input: AssertInput, requiredKeys: string[]): AssertResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.candidateOutput) as Record<string, unknown>;
  } catch {
    return { pass: false, message: "candidate output is not valid JSON" };
  }
  const missing = requiredKeys.filter((k) => !(k in parsed));
  const pass = missing.length === 0;
  return {
    pass,
    message: pass
      ? `JSON has all required keys: ${requiredKeys.join(", ")}`
      : `JSON missing keys: ${missing.join(", ")}`
  };
}

// ---------------------------------------------------------------------------
// tool-called
// ---------------------------------------------------------------------------

export function assertToolCalled(input: AssertInput, toolName: string): AssertResult {
  const trace = input.trace;
  if (!trace) {
    return { pass: false, message: "no trace available for tool-called assert" };
  }
  // Trace shape: { toolCalls?: Array<{name: string}> }
  const calls = Array.isArray(trace["toolCalls"]) ? (trace["toolCalls"] as { name: string }[]) : [];
  const pass = calls.some((c) => c.name === toolName);
  return {
    pass,
    message: pass
      ? `tool "${toolName}" was called`
      : `tool "${toolName}" was NOT called (found: ${calls.map((c) => c.name).join(", ") || "none"})`
  };
}

// ---------------------------------------------------------------------------
// dispatched-agent
// ---------------------------------------------------------------------------

export function assertDispatchedAgent(input: AssertInput, agentId: string): AssertResult {
  const trace = input.trace;
  if (!trace) {
    return { pass: false, message: "no trace available for dispatched-agent assert" };
  }
  const dispatches = Array.isArray(trace["dispatches"])
    ? (trace["dispatches"] as { agent: string }[])
    : [];
  const pass = dispatches.some((d) => d.agent === agentId);
  return {
    pass,
    message: pass
      ? `agent "${agentId}" was dispatched`
      : `agent "${agentId}" was NOT dispatched (found: ${dispatches.map((d) => d.agent).join(", ") || "none"})`
  };
}

// ---------------------------------------------------------------------------
// llm-rubric (SLICE-B2: real implementation)
// ---------------------------------------------------------------------------

export async function assertLlmRubric(input: AssertInput, rubric: string): Promise<AssertResult> {
  let judge = input.judge;

  if (!judge) {
    const providerId = input.judgeProviderId ?? "groq";
    const factory = JUDGE_REGISTRY[providerId];
    if (!factory) {
      return {
        pass: false,
        message: `llm-rubric: unknown judge provider "${providerId}"`
      };
    }
    try {
      judge = await factory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { pass: false, message: `llm-rubric: failed to load judge "${providerId}": ${msg}` };
    }
  }

  // AC-5 (FEAT-184): wrap prose rubric string in single-element array — never sentence-split.
  // Single-element arrays are a degenerate case accepted by LLMJudge forever.
  const wrappedRubric = [rubric];

  let result: Awaited<ReturnType<LLMJudge["evaluate"]>>;
  try {
    // exactOptionalPropertyTypes: only pass `context` when defined.
    const evalOpts: Parameters<LLMJudge["evaluate"]>[0] = {
      candidateOutput: input.candidateOutput,
      // AC-8: expected is required by LLMJudge; provide a minimal shell for assert calls
      // where the EvalCase is not available (heuristic assert context).
      expected: { id: "assert", input: null, held_out: false },
      rubric: wrappedRubric
    };
    if (input.context) evalOpts.context = input.context;
    result = await judge.evaluate(evalOpts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pass: false, message: `llm-rubric: judge error: ${msg}` };
  }

  return {
    pass: result.pass,
    message: result.pass
      ? `llm-rubric PASS (score=${result.score}): ${result.rationale}`
      : `llm-rubric FAIL (score=${result.score}): ${result.rationale}`
  };
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

export type AssertType =
  | "contains"
  | "not-contains"
  | "regex"
  | "artifact-exists"
  | "json-shape"
  | "tool-called"
  | "dispatched-agent"
  | "llm-rubric";

export interface AssertSpec {
  type: AssertType;
  value?: string;
  target?: string;
  path?: string;
  pattern?: string;
  flags?: string;
  keys?: string[];
  rubric?: string;
}

export async function runAssert(spec: AssertSpec, input: AssertInput): Promise<AssertResult> {
  switch (spec.type) {
    case "contains":
      return assertContains(input, spec.value ?? "");
    case "not-contains":
      return assertNotContains(input, spec.value ?? "");
    case "regex":
      return assertRegex(input, spec.pattern ?? spec.value ?? "", spec.flags);
    case "artifact-exists":
      return assertArtifactExists(input, spec.path ?? spec.value ?? "");
    case "json-shape":
      return assertJsonShape(input, spec.keys ?? []);
    case "tool-called":
      return assertToolCalled(input, spec.value ?? "");
    case "dispatched-agent":
      return assertDispatchedAgent(input, spec.value ?? "");
    case "llm-rubric":
      return await assertLlmRubric(input, spec.rubric ?? spec.value ?? "");
    default: {
      const _exhaustive: never = spec.type;
      return { pass: false, message: `unknown assert type: ${String(_exhaustive)}` };
    }
  }
}
