// capture-tee.ts — wraps fileStore.put() with walltime race + fail-silent drop.
// S2 scope: fullstack-dev only. FEAT-210 adds frontend-dev as a second,
// low-stakes capture canary (still ahead of the full S5c horizontalize in
// SLICE-102, which brings backend-dev + frontend-dev + verifier together
// with the astramemStore backend). frontend-dev capture here uses the
// existing file-backed TrialStore (gepa.config.json storage.backend:
// "file") — it does NOT require the astramem CLI. Remaining S5c scope
// (backend-dev, verifier, astramemStore, sharedAstramemMeter) is
// unaffected by this change.
//
// Behavior contract:
//   1. loadGepaConfig → null → return (no-op)
//   2. config.capture.enabled === false → return
//   3. adaptArtifact(record, fields) → null (non-dispatch kind) → return
//   4. artifact.agent NOT in CAPTURE_AGENT_ALLOWLIST → return
//   5. config.capture.exclude includes agent → return
//   6. compute candidate_prompt_hash from agents/<agent>.md (or "unknown")
//   7. construct Trial + Promise.race([put, walltimeReject])
//   8. on any error: log gepa_capture_drop to .claude/logs/events.jsonl, never propagate

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileStore, newTrialId } from "@astragenie/gepa-core";
import type { Trial } from "@astragenie/gepa-core";
import { loadGepaConfig } from "./load-config.ts";
import { adaptArtifact } from "./adapt-artifact.ts";
import type { ArtifactRecord } from "../artifacts/write.ts";
import type { ArtifactFields } from "../artifacts/types.ts";

// FEAT-210: fullstack-dev (S2) + frontend-dev (canary, low-stakes second agent).
// Remaining S5c agents (backend-dev, verifier) land with SLICE-102.
const CAPTURE_AGENT_ALLOWLIST = new Set(["fullstack-dev", "frontend-dev"]);

const EVENTS_LOG_PATH = ".claude/logs/events.jsonl";

function logDropEvent(repoPath: string, trialId: string, agent: string, reason: string): void {
  try {
    const line = `${JSON.stringify({
      event: "gepa_capture_drop",
      ts: new Date().toISOString(),
      trial_id: trialId,
      agent,
      reason
    })}\n`;
    appendFileSync(join(repoPath, EVENTS_LOG_PATH), line, { flag: "a" });
  } catch {
    // Events log failure must never propagate.
  }
}

function computePromptHash(repoPath: string, agent: string): string {
  const agentPath = join(repoPath, "agents", `${agent}.md`);
  if (!existsSync(agentPath)) return "unknown";
  try {
    const content = readFileSync(agentPath, "utf8");
    return createHash("sha256").update(content, "utf8").digest("hex");
  } catch {
    return "unknown";
  }
}

function walltimeReject(ms: number): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("walltime_exceeded")), ms)
  );
}

export async function captureTee(
  repoPath: string,
  record: ArtifactRecord,
  fields: ArtifactFields
): Promise<void> {
  // 1. Load config — no-op if absent or invalid.
  const config = await loadGepaConfig(repoPath);
  if (!config) return;

  // 2. Check capture enabled.
  if (!config.capture.enabled) return;

  // 3. Adapt artifact — no-op if kind is not a dispatch kind.
  const artifact = adaptArtifact(record, fields);
  if (!artifact) return;

  // 4. Capture allowlist (FEAT-210: fullstack-dev + frontend-dev canary).
  if (!CAPTURE_AGENT_ALLOWLIST.has(artifact.agent)) return;

  // 5. Per-agent exclude list.
  if (config.capture.exclude.includes(artifact.agent)) return;

  // 6. Compute candidate prompt hash.
  const candidatePromptHash = computePromptHash(repoPath, artifact.agent);
  const candidatePromptPath = existsSync(join(repoPath, "agents", `${artifact.agent}.md`))
    ? `agents/${artifact.agent}.md`
    : null;

  // 7. Construct Trial.
  const trialId = newTrialId();
  const scoreHint = artifact.score_hint;
  const pass = scoreHint?.pass ?? true;
  const costUsd = scoreHint?.cost_usd ?? 0;
  const latencyMs = scoreHint?.latency_ms ?? 0;

  const trial: Trial = {
    id: trialId,
    agent: artifact.agent,
    phase: artifact.phase,
    candidate_prompt_hash: candidatePromptHash,
    candidate_prompt_path: candidatePromptPath,
    input: artifact.input,
    output: artifact.output,
    score: {
      pass,
      score: pass ? 1 : 0,
      cost_usd: costUsd,
      latency_ms: latencyMs
    },
    source: "captured",
    pareto_rank: null,
    created_at: new Date().toISOString()
  };

  // 8. Put with walltime race, drop + log on any failure.
  const storeRoot = join(repoPath, config.storage.file_root);
  const walltimeMs = config.capture.walltime_ms;

  try {
    await Promise.race([fileStore(storeRoot).put(trial), walltimeReject(walltimeMs)]);
  } catch (err) {
    logDropEvent(repoPath, trialId, artifact.agent, (err as Error).message ?? "unknown");
  }
}
