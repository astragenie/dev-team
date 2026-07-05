/**
 * scripts/lib/gepa/candidate-generator-aiplugin.ts — SLICE-99
 *
 * Implements CandidateGenerator (interface from @astragenie/gepa-core) by
 * wrapping the aiplugin-dev dispatch pattern for artifact-only mode.
 *
 * Workflow per candidate slot (i of k):
 *   a. Call BudgetMeter.reserve(GENERATOR_ESTIMATE_USD, { ttlSeconds: 600 })
 *      — reserves the slot budget BEFORE writing the candidate file.
 *   b. Synthesize a prompt variant from the champion text + failing trials context.
 *   c. Write the candidate to
 *      .claude/artifacts/crew/gepa/candidates/<cycle-id>/<uuid>.md
 *   d. Call validateCandidateSize on the written file.
 *      - If oversized: log gepa_oversized_candidate event, release reservation,
 *        skip this candidate (not included in returned array).
 *      - If ok: record budget cost and include in returned array.
 *
 * SLICE-99 (--artifact-only): creates synthetic candidate files from the champion
 * text with a unique mutation suffix per slot. The live aiplugin-dev dispatch
 * path is guarded behind GEPA_LIVE_GENERATOR=1 env var.
 *
 * FEAT-192 SLICE-A wires the live path: when GEPA_LIVE_GENERATOR=="1", each slot
 * dispatches aiplugin-dev via the exported `claude -p` primitives from
 * evals/lib/candidate-dispatch.ts (runSubprocess + parseStreamJson) with a
 * rewrite-only instruction wrapper — NOT dispatchCandidate(), which bakes an
 * eval-only "you are being evaluated" wrapper unsuitable for a rewrite ask.
 * Response-format contract (AC-7): the instruction requires a single fenced
 * code block containing the complete revised file; extraction failure (no
 * block / empty block / spawn failure) rejects the slot — never writes raw or
 * error text to the candidate .md, never crashes the cycle. Guardrails
 * (identity-anchor structural check, no-op-diff rejection, the per-candidate
 * all-case promotion gate) are SLICE-B scope, not built here.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { BudgetMeter, CandidateGenerator, Trial } from "@astragenie/gepa-core";
import { validateCandidateSize } from "@astragenie/gepa-core";
import type { Candidate } from "@astragenie/gepa-core";
import { parseStreamJson, runSubprocess } from "../../../evals/lib/candidate-dispatch.ts";

/** Estimate for the aiplugin-dev dispatch cost (used for BudgetMeter.reserve). */
export const GENERATOR_ESTIMATE_USD = 0.05;

const EVENTS_LOG_PATH = ".claude/logs/events.jsonl";

function logEvent(repoPath: string, event: Record<string, unknown>): void {
  try {
    const dir = join(repoPath, ".claude", "logs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`;
    appendFileSync(join(repoPath, EVENTS_LOG_PATH), line, { flag: "a" });
  } catch {
    // Event log write must never propagate.
  }
}

function readChampion(championPath: string): string {
  try {
    return readFileSync(championPath, "utf8");
  } catch {
    return "# Champion prompt (unreadable)\n";
  }
}

function formatFailingTrialsSample(trials: Trial[], maxSample: number): string {
  const sample = trials.slice(0, maxSample);
  if (sample.length === 0) return "No failing trials available.\n";
  const lines: string[] = ["## Failing trials sample\n"];
  for (const t of sample) {
    lines.push(
      `- trial_id: ${t.id} | score: ${t.score.score.toFixed(3)} | cost: ${t.score.cost_usd.toFixed(4)} | latency: ${t.score.latency_ms}ms`
    );
    if (t.score.rationale) {
      lines.push(`  rationale: ${t.score.rationale.slice(0, 120)}`);
    }
  }
  return lines.join("\n") + "\n";
}

// ── Live rewrite dispatch (FEAT-192 SLICE-A) ───────────────────────────────

/**
 * Varied framing per K-slot. `claude -p` exposes no temperature knob here
 * (architect review, 2026-07-05), so diversification across slots comes from
 * varying the instruction framing, not sampling temperature.
 */
const REWRITE_FRAMINGS: readonly string[] = [
  "You are making a surgical, minimal-diff revision to fix the specific evaluation failures below. Change only what is necessary to address the rationale; leave everything else untouched.",
  "You are patching an agent prompt in response to concrete judge feedback. Focus narrowly on the failing rationale below — do not rewrite sections that are not implicated in the failure.",
  "You are revising an agent prompt to resolve the named evaluation failure while preserving every currently-passing behavior. Prefer trimming or tightening existing text over adding new sections."
];

function pickFraming(slotIndex: number): string {
  return REWRITE_FRAMINGS[slotIndex % REWRITE_FRAMINGS.length] ?? REWRITE_FRAMINGS[0] ?? "";
}

/**
 * Full-rationale trial formatter for the live rewrite prompt. Unlike
 * `formatFailingTrialsSample` (eval diagnostics, truncates rationale to 120
 * chars), this threads the FULL judge rationale — the rewrite fuel per the
 * architect-review MED finding ("too short as rewrite fuel").
 */
function formatFailingTrialsFull(trials: Trial[], maxSample: number): string {
  const sample = trials.slice(0, maxSample);
  if (sample.length === 0) return "No failing trials available.\n";
  const lines: string[] = ["## Failing trials (full rationale)\n"];
  for (const t of sample) {
    lines.push(
      `- trial_id: ${t.id} | score: ${t.score.score.toFixed(3)} | cost: ${t.score.cost_usd.toFixed(4)} | latency: ${t.score.latency_ms}ms`
    );
    lines.push(`  rationale: ${t.score.rationale ?? "(none provided)"}`);
  }
  return lines.join("\n") + "\n";
}

function buildRewriteInstruction(
  champion: string,
  trials: Trial[],
  slotIndex: number,
  agentName: string,
  maxTrialSample: number
): string {
  const trialsText = formatFailingTrialsFull(trials, maxTrialSample);
  return [
    pickFraming(slotIndex),
    "",
    `You are revising the Claude Code agent prompt for "${agentName}".`,
    "",
    "Hard constraints:",
    "- Preserve the `## Identity anchor` heading and the substance of its content — do not remove or hollow it out.",
    "- The revised prompt MUST stay at or under 350 lines total.",
    "- Make the smallest edit that plausibly fixes the failures below (minimal diff, not a rewrite from scratch).",
    "- Do not invent new unrelated sections or capabilities.",
    "",
    "=== CURRENT CHAMPION PROMPT ===",
    champion.trimEnd(),
    "=== END CHAMPION PROMPT ===",
    "",
    "=== FAILING TRIALS + JUDGE RATIONALE (the reflection signal — read carefully) ===",
    trialsText.trimEnd(),
    "=== END FAILING TRIALS ===",
    "",
    "Response format (mandatory): reply with ONLY the new file content in a single fenced code block, no commentary before or after it, and no explanation of what changed. The fenced block must contain the COMPLETE revised prompt file, first line to last."
  ].join("\n");
}

/** Result of extracting the rewritten file content from a `claude -p` response. */
export type RewriteExtractionResult = { ok: true; content: string } | { ok: false; reason: string };

/**
 * Extract the fenced-code-block file content from a rewrite dispatch response
 * (AC-7 response-format contract). Free-form prose with no fenced block, an
 * empty response, or an empty fenced block are all rejections — the caller
 * must never write raw/error text to the candidate `.md`.
 *
 * The response-format contract requires the ENTIRE response to be ONE fenced
 * block, so the closing fence is anchored to the END of the (trimmed)
 * response — captured greedily from the first opening fence's newline to the
 * final closing fence — rather than matched non-greedily to the FIRST closing
 * fence. A non-greedy match silently truncates at any nested fenced block
 * inside the rewritten prompt body (e.g. a ```bash example — normal in agent
 * .md files, present in agents/aiplugin-dev.md itself), and the truncated
 * text still passes validateCandidateSize and would enter the Pareto
 * pipeline as a corrupted "valid" candidate.
 */
export function extractRewrittenContent(responseText: string): RewriteExtractionResult {
  const trimmed = responseText.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty_response" };
  }

  const openMatch = trimmed.match(/^```[ \t]*[\w.-]*\r?\n/);
  if (!openMatch || !trimmed.endsWith("```")) {
    return { ok: false, reason: "no_fenced_block" };
  }

  const startIdx = openMatch[0].length;
  const endIdx = trimmed.length - 3; // exclude the final closing ```
  if (endIdx <= startIdx) {
    return { ok: false, reason: "empty_fenced_block" };
  }

  const content = trimmed.slice(startIdx, endIdx).trim();
  if (content.length === 0) {
    return { ok: false, reason: "empty_fenced_block" };
  }
  return { ok: true, content };
}

/** Test seam: override the subprocess runner used by the live rewrite dispatch. */
export interface RewriteDispatchDeps {
  runSubprocess: (prompt: string, model: string, timeoutMs: number) => Promise<string>;
}

const defaultRewriteDeps: RewriteDispatchDeps = { runSubprocess };

const DEFAULT_REWRITE_MODEL = "claude-sonnet-4-6";
const DEFAULT_REWRITE_TIMEOUT_MS = (() => {
  const env = process.env["GEPA_REWRITE_TIMEOUT_MS"];
  const parsed = env ? Number.parseInt(env, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
})();

/**
 * Dispatch aiplugin-dev for one candidate slot via the exported low-level
 * `claude -p` primitives (NOT `dispatchCandidate()` — that bakes in an
 * eval-only "you are being evaluated ... [end of response]" wrapper that is
 * nonsensical for a rewrite ask). Spawn failure and unparseable responses are
 * both surfaced as a rejection, never a throw — the caller degrades the slot,
 * it never crashes the cycle.
 */
async function dispatchRewriterForSlot(
  champion: string,
  trials: Trial[],
  slotIndex: number,
  agentName: string,
  maxTrialSample: number,
  deps: RewriteDispatchDeps
): Promise<RewriteExtractionResult> {
  const prompt = buildRewriteInstruction(champion, trials, slotIndex, agentName, maxTrialSample);
  let stdout: string;
  try {
    stdout = await deps.runSubprocess(prompt, DEFAULT_REWRITE_MODEL, DEFAULT_REWRITE_TIMEOUT_MS);
  } catch (err) {
    return { ok: false, reason: `spawn_failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  return extractRewrittenContent(parseStreamJson(stdout));
}

/** Result of resolving one candidate slot's content (stub or live dispatch). */
type SlotContentResult = { ok: true; content: string } | { ok: false };

/**
 * Resolve the content for one candidate slot: stub synthesis when
 * `liveMode` is false, or a live `dispatchRewriter` attempt (with its
 * `gepa_rewriter_dispatch` event) when true. Extracted from `generate()` to
 * keep the per-slot loop body under the cognitive-complexity budget.
 */
async function resolveCandidateContent(
  liveMode: boolean,
  repoPath: string,
  champion: string,
  trialsSample: string,
  failingTrials: Trial[],
  slotIndex: number,
  agentName: string,
  maxTrialSample: number,
  rewriteDeps: RewriteDispatchDeps
): Promise<SlotContentResult> {
  if (!liveMode) {
    return { ok: true, content: synthesizeCandidate(champion, trialsSample, slotIndex) };
  }

  const dispatchStartedAt = Date.now();
  const result = await dispatchRewriterForSlot(
    champion,
    failingTrials,
    slotIndex,
    agentName,
    maxTrialSample,
    rewriteDeps
  );
  logEvent(repoPath, {
    event: "gepa_rewriter_dispatch",
    slot_index: slotIndex,
    trial_ids: failingTrials.slice(0, maxTrialSample).map((t) => t.id),
    accepted: result.ok,
    dispatch_duration_ms: Date.now() - dispatchStartedAt,
    ...(result.ok ? {} : { reason: result.reason })
  });

  // Reject the slot — never write raw/error text to the candidate .md, never
  // crash the cycle. Caller releases the budget reservation on `ok: false`.
  return result.ok ? { ok: true, content: result.content } : { ok: false };
}

/**
 * Derive a synthetic mutation of the champion prompt for artifact-only mode.
 * Each candidate slot gets a unique suffix so prompt hashes differ.
 */
function synthesizeCandidate(champion: string, trialsSample: string, slotIndex: number): string {
  return [
    champion.trimEnd(),
    "",
    "<!-- GEPA candidate mutation -->",
    `<!-- slot: ${slotIndex} | generated: ${new Date().toISOString()} -->`,
    "",
    "## Optimization context (artifact-only)",
    "",
    trialsSample
  ].join("\n");
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}

function countLines(content: string): number {
  return content.split("\n").length;
}

function extractAgentName(championPath: string): string {
  // agents/fullstack-dev.md → "fullstack-dev"
  const basename = championPath.split(/[\\/]/).pop() ?? "unknown";
  return basename.replace(/\.md$/i, "");
}

export interface CandidateGeneratorOpts {
  /** Absolute path to repo root. */
  repoPath: string;
  /** Cycle identifier (used in output directory path). */
  cycleId: string;
  /** Maximum number of failing trial rows to include in the context. */
  maxTrialSample?: number;
  /**
   * Test seam: override the live-dispatch subprocess runner. Defaults to the
   * real `claude -p` spawn (evals/lib/candidate-dispatch.ts::runSubprocess).
   */
  rewriteDeps?: RewriteDispatchDeps;
}

/**
 * Tracks IDs of candidates rejected due to oversized prompt (≥350 lines).
 * Exposed so tests and the optimize-runner can log/audit the rejections.
 */
export interface AipluginCandidateGenerator extends CandidateGenerator {
  /** IDs of candidates that were rejected by validateCandidateSize. */
  readonly oversizedIds: string[];
}

/**
 * Create a CandidateGenerator that produces up to K candidate prompt files under
 * .claude/artifacts/crew/gepa/candidates/<cycleId>/<uuid>.md
 *
 * Each candidate is pre-screened with validateCandidateSize. Oversized
 * candidates are excluded from the return value (not scored, budget released).
 */
export function createAipluginCandidateGenerator(
  opts: CandidateGeneratorOpts
): AipluginCandidateGenerator {
  const { repoPath, cycleId, maxTrialSample = 10, rewriteDeps = defaultRewriteDeps } = opts;
  const oversizedIds: string[] = [];

  return {
    oversizedIds,

    async generate(
      currentChampionPath: string,
      failingTrials: Trial[],
      k: number,
      genOpts: { meter: BudgetMeter }
    ): Promise<Candidate[]> {
      const { meter } = genOpts;
      const champion = readChampion(currentChampionPath);
      const trialsSample = formatFailingTrialsSample(failingTrials, maxTrialSample);
      const agentName = extractAgentName(currentChampionPath);
      // Read at call-time (not factory-create-time) so tests can toggle the
      // flag between generator construction and generate() invocation.
      const liveMode = process.env["GEPA_LIVE_GENERATOR"] === "1";

      const outDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates", cycleId);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

      const candidates: Candidate[] = [];

      for (let i = 0; i < k; i++) {
        // Reserve budget BEFORE generating the candidate (per AC-4 contract).
        const reservation = await meter.reserve(GENERATOR_ESTIMATE_USD, { ttlSeconds: 600 });
        if (!reservation.ok) {
          // Daily budget exhausted — stop generating further slots.
          break;
        }

        const resolved = await resolveCandidateContent(
          liveMode,
          repoPath,
          champion,
          trialsSample,
          failingTrials,
          i,
          agentName,
          maxTrialSample,
          rewriteDeps
        );
        if (!resolved.ok) {
          // Rejected slot (live mode only) — release budget, skip to next slot.
          await meter.release(reservation.reservationId);
          continue;
        }
        const content = resolved.content;

        const id = crypto.randomUUID();
        const promptPath = join(outDir, `${id}.md`);

        writeFileSync(promptPath, content, "utf8");

        const lineCount = countLines(content);
        const hash = hashContent(content);

        const candidate: Candidate = {
          id,
          agent: agentName,
          prompt_path: promptPath,
          prompt_hash: hash,
          prompt_size_lines: lineCount,
          derived_from_trials: failingTrials.slice(0, maxTrialSample).map((t) => t.id),
          generator_cost_usd: GENERATOR_ESTIMATE_USD,
          created_at: new Date().toISOString()
        };

        // Validate size BEFORE LLM scoring spend (AC-4 requirement).
        const sizeCheck = validateCandidateSize(candidate, 350);
        if (!sizeCheck.ok) {
          oversizedIds.push(id);
          logEvent(repoPath, {
            event: "gepa_oversized_candidate",
            candidate_id: id,
            agent: candidate.agent,
            cycle_id: cycleId,
            lines: lineCount,
            reason: "oversized_candidate"
          });
          // Release the budget reservation — no scoring spend will occur.
          await meter.release(reservation.reservationId);
          // Oversized candidates are excluded from the returned array.
          continue;
        }

        // Record generator cost.
        await meter.record(reservation.reservationId, GENERATOR_ESTIMATE_USD);
        candidates.push(candidate);
      }

      return candidates;
    }
  };
}
