/**
 * Typed source for the eval-run viewer's rendering logic.
 *
 * This file exists so `bun run typecheck` (tsc --noEmit over evals/**\/*.ts)
 * covers the viewer logic. It is NOT loaded by the browser directly — browsers
 * cannot execute TypeScript, and this project intentionally has no build step
 * (see evals/README.md "Module boundary rule" / repo CLAUDE.md "no build
 * tooling, no deps"). `evals/viewer/index.html` embeds a type-erased copy of
 * this exact logic in an inline <script> tag so the page runs standalone via
 * `file://` with zero tooling.
 *
 * If you change behavior here, mirror the change in index.html's inline
 * script (and vice versa) — the two are kept in sync by hand.
 *
 * Schema notes (SLICE-195 / FEAT-187): shape below matches
 * evals/lib/run-eval.ts (EvalRunResult / TestResult) as of this writing.
 * Per-test `cost`/`provider` are NOT part of the persisted run JSON today —
 * only a run-level `judgeId` exists, and judge cost (`cost_usd`) is computed
 * at eval time (see evals/lib/judge.ts, evals/lib/with-budget.ts) but never
 * written into the run artifact. The viewer renders "—" for those cells
 * rather than fabricating data, and will pick up real values automatically
 * if a future schema version adds them (see FEAT-186, unified cost-aggregation
 * contract, currently proposed/not shipped).
 */

interface AssertResult {
  type: string;
  pass: boolean;
  message: string;
}

interface ValidationEntry {
  judge: string;
  verdict: "pass" | "fail" | "skipped";
  rationale: string;
}

interface TestResult {
  name: string;
  pass: boolean;
  error?: string;
  asserts: AssertResult[];
  durationMs: number;
  durationSec?: number;
  validations?: ValidationEntry[];
  disagreement?: boolean;
  candidateOutput?: string;
  fixtureContent?: string;
  judgeRationales?: string[];
}

interface EvalRunResult {
  promptId: string;
  specFile: string;
  dryRun: boolean;
  timestamp: string;
  tests: TestResult[];
  summary: { total: number; passed: number; failed: number; errored?: number };
  judgeErrors?: string[];
  totalDurationSec?: number;
  promptVersion?: string;
  gitSha?: string;
  judgeId?: string;
}

/** Narrow an unknown JSON value into an EvalRunResult, or throw with a human-readable reason. */
function parseRunResult(raw: unknown): EvalRunResult {
  if (raw === null || typeof raw !== "object") {
    throw new Error("File does not contain a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj["tests"])) {
    throw new Error('Missing or invalid "tests" array — not an eval-run JSON file.');
  }
  if (typeof obj["summary"] !== "object" || obj["summary"] === null) {
    throw new Error('Missing "summary" object — not an eval-run JSON file.');
  }
  if (obj["tests"].length === 0) {
    throw new Error('"tests" array is empty — nothing to render.');
  }
  return obj as unknown as EvalRunResult;
}

function fmtDuration(t: TestResult): string {
  if (typeof t.durationSec === "number") return `${t.durationSec}s`;
  return `${t.durationMs}ms`;
}

function fmtValidations(v: ValidationEntry[] | undefined): string {
  if (!v || v.length === 0) return "—";
  return v.map((e) => `${e.judge}:${e.verdict}`).join(", ");
}

function passRate(summary: EvalRunResult["summary"]): string {
  if (summary.total === 0) return "n/a";
  return `${Math.round((summary.passed / summary.total) * 1000) / 10}%`;
}

// The above pure functions are mirrored verbatim (type-erased) in index.html.
// Exported only so this file is a valid module for tsc; unused otherwise.
export { parseRunResult, fmtDuration, fmtValidations, passRate };
export type { EvalRunResult, TestResult, AssertResult, ValidationEntry };
