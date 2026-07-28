import { test, expect } from "bun:test";
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
  expect(typeof p).toBe("string");
  expect(p as unknown as string).toBe("C:\\work\\mega\\hero-crew");
});

test("SliceId, FeatId, ArtifactPath, CostReportPath, BadgeName all brand strings", () => {
  const s = SliceId("SLICE-42");
  const f = FeatId("FEAT-100");
  const a = ArtifactPath(".claude/artifacts/crew/runs/foo.md");
  const c = CostReportPath(".claude/artifacts/crew/cost/bar.md");
  const b = BadgeName("review_required");
  expect(s as unknown as string).toBe("SLICE-42");
  expect(f as unknown as string).toBe("FEAT-100");
  expect(a as unknown as string).toBe(".claude/artifacts/crew/runs/foo.md");
  expect(c as unknown as string).toBe(".claude/artifacts/crew/cost/bar.md");
  expect(b as unknown as string).toBe("review_required");
});
