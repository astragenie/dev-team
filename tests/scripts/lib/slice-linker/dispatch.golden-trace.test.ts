/**
 * tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts — FEAT-166 SLICE-78
 *
 * Golden trace contract tests for planDispatch().
 * The fixture tests/fixtures/dispatch-traces/regular.golden.json is the
 * byte-exact contract that proves zero behavior change for existing slices.
 *
 * Three tests:
 *   1. code-change slice → regular workflow → exact phase sequence
 *   2. docs-only slice → validator phase skipped via skip_when
 *   3. explicit "regular" name matches default-fallback plan
 */
import { test, expect } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { planDispatch } from "../../../../scripts/lib/slice-linker/dispatch.mts";

// File is at tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts
// — 4 dirs deep from tests/, 5 from repo root
const REPO_ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))))
);

test("golden trace — regular workflow with code changes", async () => {
  // No sliceWorkflow key → exercises default_workflow path
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"]
  });

  const goldenRaw = JSON.parse(
    await readFile(
      path.join(REPO_ROOT, "tests", "fixtures", "dispatch-traces", "regular.golden.json"),
      "utf8"
    )
  );
  const golden = goldenRaw as typeof plan;

  expect(plan).toEqual(golden);
});

test("golden trace — regular workflow with docs-only changes (validator skipped)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "regular",
    changedFiles: ["docs/standards/foo.md", "docs/governance.md"]
  });

  expect(plan[2]?.gate).toBe("skipped");
  expect(plan[2]?.skipReason).toContain("^docs/");
});

test("golden trace — explicit regular name matches default-fallback plan", async () => {
  const namedPlan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "regular",
    changedFiles: ["scripts/lib/foo.ts"]
  });

  // No sliceWorkflow key → exercises default_workflow fallback path
  const defaultPlan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"]
  });

  expect(namedPlan).toEqual(defaultPlan);
});
