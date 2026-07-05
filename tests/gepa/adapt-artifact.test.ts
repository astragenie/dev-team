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

  test("threads a failing verdict into score_hint.pass=false", () => {
    const record: ArtifactRecord = {
      kind: "review-result",
      path: ".claude/artifacts/crew/reviews/x.md",
      title: "review"
    };
    const rejected = adaptArtifact(record, { owner: "reviewer", verdict: "rejected" });
    expect(rejected?.score_hint?.pass).toBe(false);
    // legacy raw decision alias also maps
    const needsFix = adaptArtifact(record, { owner: "reviewer", decision: "needs_fix" });
    expect(needsFix?.score_hint?.pass).toBe(false);
  });

  test("threads a passing verdict into score_hint.pass=true", () => {
    const record: ArtifactRecord = {
      kind: "validation-result",
      path: ".claude/artifacts/crew/validations/x.md",
      title: "validation"
    };
    const passed = adaptArtifact(record, { owner: "verifier", verdict: "pass" });
    expect(passed?.score_hint?.pass).toBe(true);
    const approved = adaptArtifact(record, { owner: "reviewer", verdict: "approved_with_notes" });
    expect(approved?.score_hint?.pass).toBe(true);
  });

  test("omits score_hint.pass when the artifact carries no verdict (build phase)", () => {
    const record: ArtifactRecord = {
      kind: "handoff",
      path: ".claude/artifacts/crew/handoffs/x.md",
      title: "x"
    };
    const adapted = adaptArtifact(record, { owner: "fullstack-dev" });
    expect(adapted?.score_hint?.pass).toBeUndefined();
    // skipped is not a failure signal → no pass field
    const skipped = adaptArtifact(record, { owner: "fullstack-dev", verdict: "skipped" });
    expect(skipped?.score_hint?.pass).toBeUndefined();
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
