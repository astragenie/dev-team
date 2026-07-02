/**
 * scripts/lib/gepa/observability-events.ts — SLICE-106
 *
 * Central event emitter for all GEPA observability events.
 *
 * Every event carries `trial_id` / `cycle_id` correlation fields
 * (when available) and is written as a single JSON line to
 * `.claude/logs/events.jsonl`.
 *
 * Idempotency: the caller is responsible for passing a stable `event_id`
 * when deduplification is needed. Emitter deduplicates by checking whether
 * `event_id` already appears in the log (file-scan on emit).
 *
 * Design:
 *   - Emitter MUST NOT throw — all I/O errors are swallowed to prevent
 *     blocking the critical dispatch path.
 *   - All 21+ canonical events declared here so a single grep surfaces the
 *     full event surface.
 *
 * Canonical event list (from design spec "Observability" lines 749+):
 *   gepa_capture_drop
 *   gepa_eval_start
 *   gepa_eval_complete
 *   gepa_opt_cycle_start
 *   gepa_opt_no_winner
 *   gepa_opt_promote
 *   gepa_soak_start
 *   gepa_soak_promote
 *   gepa_soak_revert
 *   gepa_soak_revert_early
 *   gepa_soak_insufficient_traffic
 *   gepa_budget_exceeded
 *   gepa_tail_risk_block
 *   gepa_oversized_candidate
 *   gepa_judge_unreachable
 *   gepa_judge_malformed
 *   gepa_lock_collision
 *   gepa_branch_protection_missing
 *   gepa_no_winner_streak
 *   gepa_champion_frozen
 *   gepa_critical_agent_draft_pr  — SLICE-106: critical-agent left as draft
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Correlation fields carried by every GEPA event.
 * Both are optional because some events fire before a trial/cycle is assigned.
 */
export interface GepaEventCorrelation {
  trial_id?: string | undefined;
  cycle_id?: string | undefined;
}

/**
 * Base payload for all GEPA events.
 */
export interface GepaEventPayload extends GepaEventCorrelation {
  /** Canonical event name (e.g. "gepa_opt_promote"). */
  event: string;
  /** Agent name (always present when known). */
  agent?: string;
  /** Stable dedupe key — caller supplies when idempotency is needed. */
  event_id?: string;
  /** Any additional structured fields. */
  [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENTS_LOG_REL = ".claude/logs/events.jsonl";

// ── Internal helpers ──────────────────────────────────────────────────────────

function eventsLogPath(repoPath: string): string {
  return join(repoPath, EVENTS_LOG_REL);
}

/**
 * Returns true when `event_id` already appears in the events log.
 * Used to enforce idempotency — repeated emits with the same event_id are no-ops.
 * O(log_lines) scan — acceptable for the low-volume GEPA paths.
 */
function isDuplicate(logPath: string, eventId: string): boolean {
  if (!existsSync(logPath)) return false;
  try {
    const content = readFileSync(logPath, "utf8");
    return content.includes(JSON.stringify(eventId));
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Emit a single GEPA observability event to `.claude/logs/events.jsonl`.
 *
 * - Never throws. All errors are swallowed.
 * - Deduplicates on `payload.event_id` when provided.
 * - Automatically stamps `ts` (ISO datetime) on every line.
 */
export function emitGepaEvent(repoPath: string, payload: GepaEventPayload): void {
  try {
    const logPath = eventsLogPath(repoPath);

    // Idempotency gate.
    if (payload.event_id !== undefined && isDuplicate(logPath, payload.event_id)) {
      return;
    }

    const dir = join(repoPath, ".claude", "logs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const line = `${JSON.stringify({ ts: new Date().toISOString(), ...payload })}\n`;
    appendFileSync(logPath, line, { flag: "a" });
  } catch {
    // Event log write must never propagate.
  }
}

// ── Typed event emitters ──────────────────────────────────────────────────────
//
// Each helper below documents the canonical event name and its required fields.
// Callers import the specific helper rather than calling emitGepaEvent directly
// to keep the event surface discoverable and type-safe.

export function emitCaptureDropEvent(
  repoPath: string,
  fields: { agent: string; reason: string; cycle_id?: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_capture_drop", ...fields });
}

export function emitEvalStartEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; trial_id?: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_eval_start", ...fields });
}

export function emitEvalCompleteEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id: string;
    trial_id: string;
    pass: boolean;
    score: number;
    cost_usd: number;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_eval_complete", ...fields });
}

export function emitOptCycleStartEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; k: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_opt_cycle_start", ...fields });
}

export function emitOptNoWinnerEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; run_id: string; streak: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_opt_no_winner", ...fields });
}

export function emitOptPromoteEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; trial_id: string; pr_url?: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_opt_promote", ...fields });
}

export function emitSoakStartEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; trial_id: string; soak_percent: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_soak_start", ...fields });
}

export function emitSoakPromoteEvent(
  repoPath: string,
  fields: { agent: string; cycle_id: string; trial_id: string; elapsed_days: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_soak_promote", ...fields });
}

export function emitSoakRevertEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id?: string | undefined;
    trial_id?: string | undefined;
    reason: string;
    revert_commit?: string | undefined;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_soak_revert", ...fields });
}

export function emitSoakRevertEarlyEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id?: string | undefined;
    pass_rate_delta: number;
    elapsed_days: number;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_soak_revert_early", ...fields });
}

export function emitSoakInsufficientTrafficEvent(
  repoPath: string,
  fields: { agent: string; elapsed_days: number; sample_count: number; min_soak_trials: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_soak_insufficient_traffic", ...fields });
}

export function emitBudgetExceededEvent(
  repoPath: string,
  fields: { agent: string; cycle_id?: string | undefined; spent_usd: number; daily_cap_usd: number }
): void {
  emitGepaEvent(repoPath, { event: "gepa_budget_exceeded", ...fields });
}

export function emitTailRiskBlockEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id?: string | undefined;
    trial_id?: string | undefined;
    min_held_out_case_score: number;
    floor: number;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_tail_risk_block", ...fields });
}

export function emitOversizedCandidateEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id?: string | undefined;
    candidate_id: string;
    lines: number;
    cap: number;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_oversized_candidate", ...fields });
}

export function emitJudgeUnreachableEvent(
  repoPath: string,
  fields: { agent: string; cycle_id?: string | undefined; provider: string; error: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_judge_unreachable", ...fields });
}

export function emitJudgeMalformedEvent(
  repoPath: string,
  fields: { agent: string; cycle_id?: string | undefined; provider: string; raw?: unknown }
): void {
  emitGepaEvent(repoPath, { event: "gepa_judge_malformed", ...fields });
}

export function emitLockCollisionEvent(
  repoPath: string,
  fields: { agent: string; op: "eval" | "optimize" }
): void {
  emitGepaEvent(repoPath, { event: "gepa_lock_collision", ...fields });
}

export function emitBranchProtectionMissingEvent(
  repoPath: string,
  fields: { agent: string; branch: string; pr_url?: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_branch_protection_missing", ...fields });
}

export function emitNoWinnerStreakEvent(
  repoPath: string,
  fields: { agent: string; streak: number; run_id?: string; cycle_id?: string }
): void {
  emitGepaEvent(repoPath, { event: "gepa_no_winner_streak", ...fields });
}

export function emitChampionFrozenEvent(
  repoPath: string,
  fields: { agent: string; frozen_list: string[] }
): void {
  emitGepaEvent(repoPath, { event: "gepa_champion_frozen", ...fields });
}

/**
 * SLICE-106: Critical-agent left as draft PR — never auto-merged.
 * Emitted when inspector / verifier / architect wins the gate but is routed
 * to the draft-PR human-review queue instead.
 */
export function emitCriticalAgentDraftPrEvent(
  repoPath: string,
  fields: {
    agent: string;
    cycle_id?: string | undefined;
    trial_id?: string | undefined;
    pr_url?: string | undefined;
    pr_draft: true;
  }
): void {
  emitGepaEvent(repoPath, { event: "gepa_critical_agent_draft_pr", ...fields });
}
