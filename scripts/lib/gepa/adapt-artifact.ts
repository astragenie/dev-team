// Adapts crew's internal ArtifactRecord + ArtifactFields into the gepa-core
// library's CrewArtifact shape.
//
// ArtifactRecord (writeArtifact return) = { kind, path, title }.
// ArtifactFields (writeArtifact input) carries owner, cost, runTitle, slice — the
// data we need to populate agent + score_hint.

import type { CrewArtifact } from "@astragenie/gepa-core";
import type { ArtifactFields } from "../artifacts/types.ts";
import type { ArtifactRecord } from "../artifacts/write.ts";

const KIND_TO_PHASE: Record<string, CrewArtifact["phase"]> = {
  "run-brief": "build",
  handoff: "build",
  "final-synthesis": "build",
  "review-result": "review",
  "validation-plan": "validate",
  "validation-result": "validate",
  "deployment-check": "ship"
};

// Verdict → pass mapping for captured trials. review-result / validation-result
// artifacts carry a canonical verdict (P1.3 enum) or a legacy raw `decision`;
// map it so a captured trial reflects the real PASS/FAIL instead of the
// pass=true default in capture-tee. Returns undefined for artifacts with no
// verdict signal (run-brief, handoff, final-synthesis) — capture-tee then keeps
// its pass=true default. Failing trials are the fuel the optimizer mutates from,
// so this threading is what lets the captured corpus teach failures, not just
// successes.
const FAIL_VERDICTS = new Set(["fail", "failed", "rejected", "needs_fix"]);
const PASS_VERDICTS = new Set([
  "pass",
  "passed",
  "passed_with_notes",
  "approved",
  "approved_with_notes"
]);

function deriveCapturedPass(fields: ArtifactFields): boolean | undefined {
  const raw = (fields.verdict ?? fields.decision)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (FAIL_VERDICTS.has(raw)) return false;
  if (PASS_VERDICTS.has(raw)) return true;
  return undefined; // skipped / unrecognized → no scoring signal
}

export function adaptArtifact(record: ArtifactRecord, fields: ArtifactFields): CrewArtifact | null {
  const phase = KIND_TO_PHASE[record.kind];
  if (!phase) return null;

  const agent = fields.owner ?? "unknown";
  const cost_usd = fields.cost?.usd;
  const pass = deriveCapturedPass(fields);
  const hint: NonNullable<CrewArtifact["score_hint"]> = {};
  if (cost_usd !== undefined) hint.cost_usd = cost_usd;
  if (pass !== undefined) hint.pass = pass;
  const score_hint = Object.keys(hint).length > 0 ? hint : undefined;

  return {
    agent,
    phase,
    input: {
      slice: fields.slice ?? null,
      feature: fields.feature ?? null,
      runTitle: fields.runTitle ?? null
    },
    output: {
      title: record.title,
      kind: record.kind
    },
    ...(score_hint ? { score_hint } : {}),
    source_artifact_path: record.path,
    dispatched_at: new Date().toISOString()
  };
}
