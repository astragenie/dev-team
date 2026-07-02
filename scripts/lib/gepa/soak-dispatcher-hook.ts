/**
 * scripts/lib/gepa/soak-dispatcher-hook.ts — SLICE-104 (FEAT-183 S7)
 *
 * Crew-side soak dispatcher hook. Called from
 * scripts/lib/slice-linker/dispatch.mts on each builder dispatch to:
 *
 *   1. Read the active soak.json for the resolved builder agent (if present).
 *   2. Roll Math.random() < soakPercent to decide whether to use the soak
 *      champion prompt path instead of the main champion.
 *   3. Evaluate the SoakVerdict from the pure evaluateSoak() algorithm.
 *   4. If verdict = "failed" or "reverted", emit an event and return the
 *      early-revert outcome — the caller uses this to skip the soak path.
 *   5. If verdict = "running" or "passed", return a SoakRouting decision so
 *      the caller can steer the dispatch.
 *
 * Design constraints (from FEAT-183 spec + SLICE-104 risks):
 *   - try/catch guards every I/O path — malformed soak.json MUST NOT crash
 *     dispatch (failure mode: "Soak dispatcher can't read soak.json → use
 *     main champion").
 *   - No live LLM calls here. Scoring is fire-and-forget by the eval pipeline
 *     after dispatch (AC-10).
 *   - champion_frozen is checked BEFORE calling this hook (caller
 *     responsibility per design spec line 842 precedence rule).
 *   - All event strings returned in SoakHookResult.events so the caller
 *     can append to .claude/logs/events.jsonl.
 *
 * I/O surface:
 *   - Reads:  <repoRoot>/.claude/artifacts/crew/gepa/soak.json
 *   - Writes: <repoRoot>/.claude/artifacts/crew/gepa/soak/
 *             <agent>-early-revert-<ts>.json  (on early-revert only)
 *
 * The soak.json schema is a record of agent → SoakEntry. This module reads
 * it; the /crew:gepa-optimize command writes it. Atomic-swap writes are the
 * caller's responsibility — this module is read-only on soak.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateSoak,
  type PromotionPolicy,
  type SoakState,
  type SoakTrial
} from "@astragenie/gepa-core";

/**
 * Re-export PromotionPolicy as SoakPolicy for backward-compat with callers
 * that import this type from the hook rather than from gepa-core directly.
 * The full PromotionPolicy includes soakPercent (used in the routing decision)
 * and soakDays/minSoakTrials/maxSoakDays/soakEpsilon (used by evaluateSoak).
 */
export type SoakPolicy = PromotionPolicy;

// ── Types ──────────────────────────────────────────────────────────────────────

/** One active soak entry in soak.json. */
export interface SoakEntry {
  /** Agent name this soak covers. */
  agent: string;
  /** ISO datetime the soak started. */
  started_at: string;
  /**
   * Absolute path to the soak champion prompt file.
   * Used by the dispatcher to steer the agent's prompt path.
   */
  champion_path: string;
  /** All soak trials collected so far. */
  trials: SoakTrial[];
  /** Pass rate of the main champion in the rolling 1-day window. */
  main_pass_rate: number;
}

/** Full soak.json schema: agent name → SoakEntry. */
export type SoakMap = Record<string, SoakEntry>;

/** Outcome returned to the dispatch caller. */
export type SoakHookStatus =
  | "no_soak" // agent has no active soak — use main champion
  | "soak_skip" // random() >= soakPercent — use main champion this dispatch
  | "soak_use" // random() < soakPercent — use soak champion this dispatch
  | "early_revert" // soak failed — early-revert triggered
  | "insufficient_traffic" // maxSoakDays reached with too few trials
  | "soak_promoted" // both clocks cleared — soak ready for promotion
  | "error"; // I/O or parse error — use main champion

export interface SoakHookResult {
  status: SoakHookStatus;
  /** When status = "soak_use", the path to the soak champion prompt. */
  champion_path?: string;
  /**
   * Structured event keys for appending to .claude/logs/events.jsonl.
   * Populated on early_revert, insufficient_traffic, soak_promoted.
   */
  events: string[];
  /** Human-readable reason for log / forensics. */
  reason: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOAK_JSON_PATH = ".claude/artifacts/crew/gepa/soak.json";
const SOAK_FORENSICS_DIR = ".claude/artifacts/crew/gepa/soak";

// ── Internal helpers ──────────────────────────────────────────────────────────

function readSoakMap(repoRoot: string): SoakMap | null {
  const soakPath = join(repoRoot, SOAK_JSON_PATH);
  if (!existsSync(soakPath)) return null;
  try {
    const raw = readFileSync(soakPath, "utf8");
    return JSON.parse(raw) as SoakMap;
  } catch {
    return null;
  }
}

function writeForensicsArtifact(
  repoRoot: string,
  agent: string,
  entry: SoakEntry,
  reason: string,
  verdict: {
    soak_pass_rate: number;
    pass_rate_delta: number;
    elapsed_days: number;
    sample_count: number;
  }
): void {
  try {
    const dir = join(repoRoot, SOAK_FORENSICS_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = join(dir, `${agent}-early-revert-${ts}.json`);
    const artifact = {
      agent,
      reason,
      started_at: entry.started_at,
      reverted_at: new Date().toISOString(),
      soak_pass_rate: verdict.soak_pass_rate,
      pass_rate_delta: verdict.pass_rate_delta,
      elapsed_days: verdict.elapsed_days,
      sample_count: verdict.sample_count,
      trials_summary: entry.trials.map((t) => ({
        created_at: t.created_at,
        pass: t.pass,
        score: t.score
      }))
    };
    writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");
  } catch {
    // Forensics write failure is non-fatal — do not crash dispatch
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SoakDispatchOpts {
  /** Absolute path to the repo root. */
  repoRoot: string;
  /** The resolved builder agent name (e.g. "fullstack-dev"). */
  agent: string;
  /** Soak policy from gepa.config.json. */
  policy: SoakPolicy;
  /**
   * Injected "now" ISO string. Defaults to new Date().toISOString().
   * Injectable for deterministic tests.
   */
  nowIso?: string;
  /**
   * Injected random number [0, 1). Defaults to Math.random().
   * Injectable for deterministic tests (e.g. pass 0.05 to force soak_use).
   */
  randomValue?: number;
}

/**
 * Evaluate the soak hook for a single dispatch.
 *
 * This is the hot-path hook in dispatch.mts — it MUST NOT throw.
 * All errors fall back to { status: "error" } which the caller treats as
 * "use main champion".
 */
export function evaluateSoakHook(opts: SoakDispatchOpts): SoakHookResult {
  const { repoRoot, agent, policy } = opts;
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const randomValue = opts.randomValue ?? Math.random();

  try {
    const soakMap = readSoakMap(repoRoot);
    if (soakMap === null) {
      return { status: "no_soak", events: [], reason: "soak.json absent or unreadable" };
    }

    const entry = soakMap[agent];
    if (entry === undefined) {
      return { status: "no_soak", events: [], reason: `no active soak for agent ${agent}` };
    }

    // Build SoakState for the pure algorithm
    const soakState: SoakState = {
      agent: entry.agent,
      started_at: entry.started_at,
      now_iso: nowIso,
      trials: entry.trials,
      main_pass_rate: entry.main_pass_rate
    };

    // evaluateSoak only needs the four soak-timing fields; extract them
    // from the full PromotionPolicy to avoid passing extra fields.
    const verdict = evaluateSoak(soakState, {
      soakDays: policy.soakDays,
      minSoakTrials: policy.minSoakTrials,
      maxSoakDays: policy.maxSoakDays,
      soakEpsilon: policy.soakEpsilon
    });

    // Handle terminal verdicts first — they override the random routing decision
    if (verdict.status === "failed") {
      writeForensicsArtifact(repoRoot, agent, entry, verdict.reason, verdict);
      return {
        status: "early_revert",
        events: ["gepa_soak_revert_early"],
        reason: `gepa_soak_revert_early: delta=${verdict.pass_rate_delta.toFixed(3)} — ${verdict.reason}`
      };
    }

    if (verdict.status === "reverted") {
      return {
        status: "insufficient_traffic",
        events: ["gepa_soak_insufficient_traffic"],
        reason: `gepa_soak_insufficient_traffic: ${verdict.reason}`
      };
    }

    if (verdict.status === "passed") {
      return {
        status: "soak_promoted",
        events: ["gepa_soak_promote_eligible"],
        reason: `soak_promote_eligible: ${verdict.reason}`,
        champion_path: entry.champion_path
      };
    }

    // verdict.status === "running" — apply soakPercent routing
    if (randomValue < policy.soakPercent) {
      return {
        status: "soak_use",
        events: [],
        reason: `soak_use: random=${randomValue.toFixed(4)} < soakPercent=${policy.soakPercent}`,
        champion_path: entry.champion_path
      };
    }

    return {
      status: "soak_skip",
      events: [],
      reason: `soak_skip: random=${randomValue.toFixed(4)} >= soakPercent=${policy.soakPercent}`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      events: [],
      reason: `soak hook error (falling back to main): ${message}`
    };
  }
}
