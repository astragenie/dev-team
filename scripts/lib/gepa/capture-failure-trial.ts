// capture-failure-trial.ts — FEAT-193 S1: Failure → GEPA trial-store bridge.
//
// Dual-write sibling of scripts/lib/memory/capture-learning.ts. FEAT-188 S1a
// wired 4 failure signals (review rejected/needs_fix, validation fail,
// inline-return-warn, subagent-incomplete) into the legacy learnings store
// (.claude/artifacts/loop/learnings.jsonl). FEAT-193 S1 taps the SAME 4
// signals and ALSO appends a failing Trial to the agent's GEPA trial corpus
// (.claude/artifacts/crew/gepa/trials/<agent>.jsonl) via gepa-core's
// fileStore.put() — the same writer scripts/lib/gepa/capture-tee.ts uses, so
// there is exactly one JSONL-writing code path for this store (never
// hand-roll a second one).
//
// Trial.source enum note: @astragenie/gepa-core's TrialSchema (checked at
// v0.7.0, the version pinned in package.json) defines
// `source: z.enum(["eval", "captured", "soak"])` — it has no "production"
// value. Writing a literal `source: "production"` would make
// fileStore.put()'s internal TrialSchema.parse() throw (silently dropped by
// this module's fire-and-forget try/catch below) and, even if a row slipped
// past validation some other way, gepa-core's own reader
// (file-store.ts readJsonlSafe) re-parses every line with TrialSchema.parse
// and silently drops anything that doesn't validate — so an unsupported
// source value would make these failing trials invisible to recall(), not
// just mislabeled. To keep the trials functional (written AND recallable),
// this module writes the schema-valid `source: "captured"` and threads the
// distinguishing "this came from a production failure signal, not a build
// success" marker through `input.capture_origin: "production_failure"`
// instead (Trial.input is z.unknown() — free-form). Follow-up: extend
// gepa-core's Trial.source enum with "production" upstream
// (astragenie/plugins-common, cross-repo) and switch this module over once
// that ships.
//
// Fire-and-forget: never throws into the gate/hook it hooks onto. Mirrors
// the captureFailureLearning contract in scripts/lib/memory/capture-learning.ts.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileStore, newTrialId } from "@astragenie/gepa-core";
import type { Trial } from "@astragenie/gepa-core";
import { loadGepaConfig } from "./load-config.ts";
import { computePromptHash } from "./capture-tee.ts";

export type FailureTrialPhase = "build" | "review" | "validate" | "ship";

export interface FailureTrialInput {
  /** Agent to key the trial JSONL file by. Falls back to "unknown" upstream if absent. */
  agent: string;
  phase: FailureTrialPhase;
  /** Free-text verdict/finding text — becomes score.rationale. */
  rationale: string;
  /** Optional structured context merged into Trial.input alongside capture_origin. */
  input?: Record<string, unknown>;
}

function walltimeReject(ms: number): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("walltime_exceeded")), ms)
  );
}

/**
 * Append a failing (`pass: false`, `score: 0`) Trial to the agent's GEPA
 * trial store. Fire-and-forget: never throws, never propagates. AC per
 * FEAT-193 S1 — this is the trial-store half of the S1a dual-write; callers
 * pair this with captureFailureLearning at each of the 4 capture points.
 */
export async function captureFailureTrial(
  repoPath: string,
  entry: FailureTrialInput
): Promise<void> {
  try {
    const config = await loadGepaConfig(repoPath);
    if (!config) return;
    if (!config.capture.enabled) return;
    if (config.capture.exclude.includes(entry.agent)) return;

    const candidatePromptHash = computePromptHash(repoPath, entry.agent);
    const candidatePromptPath = existsSync(join(repoPath, "agents", `${entry.agent}.md`))
      ? `agents/${entry.agent}.md`
      : null;

    const trial: Trial = {
      id: newTrialId(),
      agent: entry.agent,
      phase: entry.phase,
      candidate_prompt_hash: candidatePromptHash,
      candidate_prompt_path: candidatePromptPath,
      input: { capture_origin: "production_failure", ...(entry.input ?? {}) },
      output: {},
      score: {
        pass: false,
        score: 0,
        cost_usd: 0,
        latency_ms: 0,
        rationale: entry.rationale.slice(0, 2000)
      },
      source: "captured",
      pareto_rank: null,
      created_at: new Date().toISOString()
    };

    const storeRoot = join(repoPath, config.storage.file_root);
    const walltimeMs = config.capture.walltime_ms;
    await Promise.race([fileStore(storeRoot).put(trial), walltimeReject(walltimeMs)]);
  } catch {
    // Fire-and-forget: never propagate.
  }
}
