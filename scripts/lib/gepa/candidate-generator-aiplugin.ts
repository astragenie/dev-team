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
 * path is guarded behind GEPA_LIVE_GENERATOR=1 env var (deferred to post-CHECKPOINT 1).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { BudgetMeter, CandidateGenerator, Trial } from "@astragenie/gepa-core";
import { validateCandidateSize } from "@astragenie/gepa-core";
import type { Candidate } from "@astragenie/gepa-core";

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
  const { repoPath, cycleId, maxTrialSample = 10 } = opts;
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

        const id = crypto.randomUUID();
        const content = synthesizeCandidate(champion, trialsSample, i);
        const promptPath = join(outDir, `${id}.md`);

        writeFileSync(promptPath, content, "utf8");

        const lineCount = countLines(content);
        const hash = hashContent(content);

        const candidate: Candidate = {
          id,
          agent: extractAgentName(currentChampionPath),
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
