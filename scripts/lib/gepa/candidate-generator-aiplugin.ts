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
 * error text to the candidate .md, never crashes the cycle.
 *
 * FEAT-192 SLICE-B adds two pre-write guardrails that run on EVERY resolved
 * slot content (stub or live) between "content resolved" and "file written":
 * `checkIdentityAnchor` (AC-5 — structural, not a prompt instruction) and
 * `checkNonTrivialDiff` (AC-2 — no-op / whitespace-only rejection). The
 * per-candidate all-case promotion gate (AC-4) lives in optimize-runner.ts's
 * `determineWinner`, not here.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { BudgetMeter, CandidateGenerator, Trial } from "@astragenie/gepa-core";
import { validateCandidateSize } from "@astragenie/gepa-core";
import type { Candidate } from "@astragenie/gepa-core";
import { parseStreamJson, runSubprocess } from "../../../evals/lib/candidate-dispatch.ts";

/**
 * Estimate for the aiplugin-dev dispatch cost (used for BudgetMeter.reserve).
 *
 * FEAT-192 SLICE-B re-validation: the stub-era value (0.05) was calibrated for
 * a synthetic $0 mutation, not a real `claude -p` dispatch. A live rewrite
 * dispatch sends the FULL champion prompt (up to the 350-line cap, ~4-5k
 * tokens) plus up to `maxTrialSample` (default 10) FULL judge rationales
 * (unbounded but typically ~200-500 tokens each, ~2-5k tokens) as input, and
 * expects a complete rewritten file (up to 350 lines, ~3-4k tokens) as
 * output. At Claude Sonnet-class per-token rates (~$3/MTok in, ~$15/MTok
 * out) that is roughly (8000 / 1e6 * 3) + (4000 / 1e6 * 15) ≈ $0.08 per
 * dispatch. The dispatch itself runs on subscription (not metered API
 * billing — see FEAT-192 context), so this estimate is a BudgetMeter proxy
 * for compute cost / rate-limiting K dispatches per day against
 * `gepa.budget.daily_usd`, not a literal invoice line. Rounded up slightly
 * for retry/variance headroom.
 */
export const GENERATOR_ESTIMATE_USD = 0.08;

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

// ── Guardrails (FEAT-192 SLICE-B) ───────────────────────────────────────────
//
// Both checks run on EVERY resolved slot content — stub or live — between
// "content resolved" and "file written". A gutted-identity or no-op candidate
// must never reach the scored set (no Trial is ever produced for it, so it
// never carries a pareto_rank — same exclusion pattern as the existing
// oversized-candidate rejection below).

const IDENTITY_ANCHOR_HEADING = "## Identity anchor";
const IDENTITY_ANCHOR_SIMILARITY_THRESHOLD = 0.4;
const MIN_CHANGED_LINES = 2;

/**
 * Extract the body of the `## Identity anchor` section: everything after the
 * heading line up to (but not including) the next level-1 or level-2
 * heading, or end of file. Level-3+ subheadings inside the anchor section
 * are kept as part of the body. Returns null when the heading is absent.
 */
function extractIdentityAnchorBody(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim() === IDENTITY_ANCHOR_HEADING);
  if (startIdx === -1) return null;
  const bodyLines: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^#{1,2}\s/.test(line)) break;
    bodyLines.push(line);
  }
  return bodyLines.join("\n").trim();
}

/** Lowercase alphanumeric-run word set. Fragments < 2 chars are dropped as punctuation noise. */
function wordSet(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return new Set(words);
}

/**
 * Similarity measure decision (SLICE-B): recall of the champion's
 * identity-anchor vocabulary surviving in the candidate —
 * |champion_words ∩ candidate_words| / |champion_words|.
 *
 * Deliberately a containment/recall measure, not symmetric Jaccard: a
 * rewrite that EXPANDS the anchor with new supporting detail must not be
 * penalized (Jaccard's growing union would drag the score down for
 * additions), but a rewrite that GUTS the anchor down to a fragment must
 * score low regardless of how short the surviving fragment is — recall
 * against the champion's vocabulary captures exactly "how much of the
 * original identity survived", which is what AC-5 asks to guard. This is a
 * heuristic, not semantic diffing (full semantic coverage is a FEAT-192
 * non-goal, v2).
 */
function identityAnchorSimilarity(championBody: string, candidateBody: string): number {
  const championWords = wordSet(championBody);
  if (championWords.size === 0) return 1; // nothing to preserve — trivially ok
  const candidateWords = wordSet(candidateBody);
  let overlap = 0;
  for (const w of championWords) {
    if (candidateWords.has(w)) overlap++;
  }
  return overlap / championWords.size;
}

export type IdentityAnchorCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing_heading" | "anchor_gutted"; similarity?: number };

/**
 * AC-5 structural guardrail: reject a candidate whose content no longer
 * contains the `## Identity anchor` heading, or whose anchor body has
 * dropped below the similarity threshold vs the champion's. A concrete
 * structural assertion, not a prompt instruction to the rewriter.
 */
export function checkIdentityAnchor(
  champion: string,
  candidateContent: string
): IdentityAnchorCheckResult {
  const championBody = extractIdentityAnchorBody(champion);
  if (championBody === null) {
    // Champion itself has no identity anchor to protect — nothing to guard.
    return { ok: true };
  }
  const candidateBody = extractIdentityAnchorBody(candidateContent);
  if (candidateBody === null) {
    return { ok: false, reason: "missing_heading" };
  }
  const similarity = identityAnchorSimilarity(championBody, candidateBody);
  if (similarity < IDENTITY_ANCHOR_SIMILARITY_THRESHOLD) {
    return { ok: false, reason: "anchor_gutted", similarity };
  }
  return { ok: true };
}

/**
 * Count of lines whose multiset membership differs between champion and
 * candidate (added + removed), after trimming each line. A cheap
 * non-semantic diff proxy — good enough for a "did anything real change"
 * guardrail, not a full diff algorithm (order-insensitive by design: a
 * reordered-but-unchanged file should not count as a real edit either).
 */
function countChangedLines(championText: string, candidateText: string): number {
  const tally = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    return counts;
  };
  const championCounts = tally(championText);
  const candidateCounts = tally(candidateText);
  const keys = new Set([...championCounts.keys(), ...candidateCounts.keys()]);
  let changed = 0;
  for (const key of keys) {
    changed += Math.abs((championCounts.get(key) ?? 0) - (candidateCounts.get(key) ?? 0));
  }
  return changed;
}

export type NonTrivialDiffCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "identical_to_champion" | "whitespace_only_diff" | "below_min_changed_lines";
      changedLines?: number;
    };

/**
 * AC-2 guardrail: reject a candidate whose diff vs the champion is empty,
 * whitespace-only, or below the minimal changed-line threshold. A real
 * rewrite changes something; a whitespace edit disguised as a win must not
 * enter the Pareto set.
 */
export function checkNonTrivialDiff(
  champion: string,
  candidateContent: string
): NonTrivialDiffCheckResult {
  const championTrimmed = champion.trim();
  const candidateTrimmed = candidateContent.trim();
  if (championTrimmed === candidateTrimmed) {
    return { ok: false, reason: "identical_to_champion" };
  }
  const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();
  if (collapseWhitespace(championTrimmed) === collapseWhitespace(candidateTrimmed)) {
    return { ok: false, reason: "whitespace_only_diff" };
  }
  const changedLines = countChangedLines(champion, candidateContent);
  if (changedLines < MIN_CHANGED_LINES) {
    return { ok: false, reason: "below_min_changed_lines", changedLines };
  }
  return { ok: true };
}

/** A pre-write guardrail rejection, ready to log via `logEvent`. */
interface GuardrailRejection {
  event: "gepa_identity_anchor_broken" | "gepa_noop_candidate";
  reason: string;
  extra?: Record<string, unknown>;
}

/**
 * Run both SLICE-B pre-write guardrails (AC-5 identity-anchor, AC-2
 * non-trivial-diff) against one slot's resolved content. Extracted out of
 * `generate()`'s loop body to keep its cognitive complexity within budget —
 * mirrors the existing `resolveCandidateContent` extraction pattern.
 */
function checkPreWriteGuardrails(champion: string, content: string): GuardrailRejection | null {
  const anchorCheck = checkIdentityAnchor(champion, content);
  if (!anchorCheck.ok) {
    return {
      event: "gepa_identity_anchor_broken",
      reason: anchorCheck.reason,
      ...(anchorCheck.reason === "anchor_gutted"
        ? { extra: { similarity: anchorCheck.similarity } }
        : {})
    };
  }
  const diffCheck = checkNonTrivialDiff(champion, content);
  if (!diffCheck.ok) {
    return {
      event: "gepa_noop_candidate",
      reason: diffCheck.reason,
      ...(diffCheck.reason === "below_min_changed_lines"
        ? { extra: { changed_lines: diffCheck.changedLines } }
        : {})
    };
  }
  return null;
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
    return {
      ok: false,
      reason: `spawn_failed: ${err instanceof Error ? err.message : String(err)}`
    };
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

/** Context threaded through `processCandidateSlot` — one per `generate()` call, shared across all K slots. */
interface SlotContext {
  repoPath: string;
  cycleId: string;
  outDir: string;
  champion: string;
  trialsSample: string;
  failingTrials: Trial[];
  agentName: string;
  maxTrialSample: number;
  rewriteDeps: RewriteDispatchDeps;
  liveMode: boolean;
  meter: BudgetMeter;
  oversizedIds: string[];
}

/**
 * Resolve, guardrail-check, write, and size-validate one candidate slot.
 * Returns the candidate on success, or null when the slot was rejected at
 * any stage (extraction failure, identity-anchor guardrail, no-op-diff
 * guardrail, or oversize) — the budget reservation is released on every
 * rejection path. Extracted out of `generate()`'s loop body to keep its
 * cognitive complexity within budget (FEAT-192 SLICE-B).
 */
async function processCandidateSlot(
  slotIndex: number,
  reservationId: string,
  ctx: SlotContext
): Promise<Candidate | null> {
  const resolved = await resolveCandidateContent(
    ctx.liveMode,
    ctx.repoPath,
    ctx.champion,
    ctx.trialsSample,
    ctx.failingTrials,
    slotIndex,
    ctx.agentName,
    ctx.maxTrialSample,
    ctx.rewriteDeps
  );
  if (!resolved.ok) {
    // Rejected slot (live mode only) — release budget, skip to next slot.
    await ctx.meter.release(reservationId);
    return null;
  }
  const content = resolved.content;

  // AC-5 + AC-2: pre-write guardrails, gated between "content resolved" and
  // "file written". Never let a gutted-identity or no-op candidate reach the
  // scored set: release the reservation, skip the slot, no Trial is ever
  // produced for it (equivalent to pareto_rank: null).
  const rejection = checkPreWriteGuardrails(ctx.champion, content);
  if (rejection) {
    logEvent(ctx.repoPath, {
      event: rejection.event,
      slot_index: slotIndex,
      cycle_id: ctx.cycleId,
      agent: ctx.agentName,
      reason: rejection.reason,
      ...(rejection.extra ?? {})
    });
    await ctx.meter.release(reservationId);
    return null;
  }

  const id = crypto.randomUUID();
  const promptPath = join(ctx.outDir, `${id}.md`);
  writeFileSync(promptPath, content, "utf8");

  const lineCount = countLines(content);
  const candidate: Candidate = {
    id,
    agent: ctx.agentName,
    prompt_path: promptPath,
    prompt_hash: hashContent(content),
    prompt_size_lines: lineCount,
    derived_from_trials: ctx.failingTrials.slice(0, ctx.maxTrialSample).map((t) => t.id),
    generator_cost_usd: GENERATOR_ESTIMATE_USD,
    created_at: new Date().toISOString()
  };

  // Validate size BEFORE LLM scoring spend (AC-4 requirement).
  const sizeCheck = validateCandidateSize(candidate, 350);
  if (!sizeCheck.ok) {
    ctx.oversizedIds.push(id);
    logEvent(ctx.repoPath, {
      event: "gepa_oversized_candidate",
      candidate_id: id,
      agent: candidate.agent,
      cycle_id: ctx.cycleId,
      lines: lineCount,
      reason: "oversized_candidate"
    });
    // Release the budget reservation — no scoring spend will occur.
    await ctx.meter.release(reservationId);
    // Oversized candidates are excluded from the returned array.
    return null;
  }

  // Record generator cost.
  await ctx.meter.record(reservationId, GENERATOR_ESTIMATE_USD);
  return candidate;
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
      const slotCtx: SlotContext = {
        repoPath,
        cycleId,
        outDir,
        champion,
        trialsSample,
        failingTrials,
        agentName,
        maxTrialSample,
        rewriteDeps,
        liveMode,
        meter,
        oversizedIds
      };

      for (let i = 0; i < k; i++) {
        // Reserve budget BEFORE generating the candidate (per AC-4 contract).
        const reservation = await meter.reserve(GENERATOR_ESTIMATE_USD, { ttlSeconds: 600 });
        if (!reservation.ok) {
          // Daily budget exhausted — stop generating further slots.
          break;
        }

        const candidate = await processCandidateSlot(i, reservation.reservationId, slotCtx);
        if (candidate) candidates.push(candidate);
      }

      return candidates;
    }
  };
}
