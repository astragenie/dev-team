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
  "deployment-check": "ship",
};

export function adaptArtifact(
  record: ArtifactRecord,
  fields: ArtifactFields,
): CrewArtifact | null {
  const phase = KIND_TO_PHASE[record.kind];
  if (!phase) return null;

  const agent = fields.owner ?? "unknown";
  const cost_usd = fields.cost?.usd;
  const score_hint =
    cost_usd !== undefined
      ? { cost_usd }
      : undefined;

  return {
    agent,
    phase,
    input: {
      slice: fields.slice ?? null,
      feature: fields.feature ?? null,
      runTitle: fields.runTitle ?? null,
    },
    output: {
      title: record.title,
      kind: record.kind,
    },
    ...(score_hint ? { score_hint } : {}),
    source_artifact_path: record.path,
    dispatched_at: new Date().toISOString(),
  };
}
