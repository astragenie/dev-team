import { describe, expect, test } from "bun:test";
import { adaptArtifact } from "../../scripts/lib/gepa/adapt-artifact.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";
import type { ArtifactRecord } from "../../scripts/lib/artifacts/write.ts";

describe("adaptArtifact", () => {
  test("maps handoff + fields with owner into CrewArtifact for fullstack-dev", () => {
    const record: ArtifactRecord = {
      kind: "handoff",
      path: ".claude/artifacts/crew/handoffs/2026-06-27T12-00-00Z-some-run.md",
      title: "some-run"
    };
    const fields: ArtifactFields = {
      owner: "fullstack-dev",
      runTitle: "S2",
      slice: "SLICE-97"
    };
    const adapted = adaptArtifact(record, fields);
    expect(adapted).not.toBeNull();
    expect(adapted?.agent).toBe("fullstack-dev");
    expect(adapted?.phase).toBe("build");
    expect(adapted?.source_artifact_path).toBe(record.path);
    expect((adapted?.input as Record<string, unknown>)?.slice).toBe("SLICE-97");
    expect((adapted?.output as Record<string, unknown>)?.title).toBe("some-run");
  });

  test("populates score_hint when fields.cost.usd is present", () => {
    const record: ArtifactRecord = {
      kind: "review-result",
      path: ".claude/artifacts/crew/reviews/x.md",
      title: "review"
    };
    const fields: ArtifactFields = {
      owner: "reviewer",
      cost: { usd: 0.0123 }
    };
    const adapted = adaptArtifact(record, fields);
    expect(adapted?.score_hint?.cost_usd).toBeCloseTo(0.0123);
    expect(adapted?.phase).toBe("review");
  });

  test("returns null for non-dispatch kinds (e.g. cost-report-slice)", () => {
    const record: ArtifactRecord = {
      kind: "cost-report-slice",
      path: ".claude/artifacts/crew/cost/x.md",
      title: "cost"
    };
    const adapted = adaptArtifact(record, {});
    expect(adapted).toBeNull();
  });

  test("defaults agent to 'unknown' when fields.owner is absent", () => {
    const record: ArtifactRecord = {
      kind: "handoff",
      path: ".claude/artifacts/crew/handoffs/x.md",
      title: "x"
    };
    const adapted = adaptArtifact(record, {});
    expect(adapted?.agent).toBe("unknown");
  });
});
