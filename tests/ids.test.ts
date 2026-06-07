import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RepoPath,
  SliceId,
  FeatId,
  ArtifactPath,
  CostReportPath,
  BadgeName
} from "../scripts/lib/ids.ts";

test("RepoPath constructor brands a string", () => {
  const p = RepoPath("C:\\work\\mega\\hero-crew");
  // structural type is still string at runtime
  assert.equal(typeof p, "string");
  assert.equal(p as unknown as string, "C:\\work\\mega\\hero-crew");
});

test("SliceId, FeatId, ArtifactPath, CostReportPath, BadgeName all brand strings", () => {
  const s = SliceId("SLICE-42");
  const f = FeatId("FEAT-100");
  const a = ArtifactPath(".claude/artifacts/crew/runs/foo.md");
  const c = CostReportPath(".claude/artifacts/crew/cost/bar.md");
  const b = BadgeName("review_required");
  assert.equal(s as unknown as string, "SLICE-42");
  assert.equal(f as unknown as string, "FEAT-100");
  assert.equal(a as unknown as string, ".claude/artifacts/crew/runs/foo.md");
  assert.equal(c as unknown as string, ".claude/artifacts/crew/cost/bar.md");
  assert.equal(b as unknown as string, "review_required");
});
