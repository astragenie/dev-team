/**
 * tests/scripts/lib/slice-linker/dispatch.golden-trace.test.ts — FEAT-166 SLICE-78
 *
 * Golden trace contract tests for planDispatch().
 * The fixture tests/fixtures/dispatch-traces/regular.golden.json is the
 * byte-exact contract that proves zero behavior change for existing slices.
 *
 * Tests:
 *   1. code-change slice (no tags) → regular workflow → exact phase sequence (golden fixture)
 *   2. docs-only slice → fanout phase skipped via skip_when
 *   3. explicit "regular" name matches default-fallback plan
 *   4. frontend tag → crew:frontend-dev (tag routing)
 *   5. backend tag → crew:backend-dev (tag routing)
 *   6. parallel-fe-be tag → parallel_dispatch group [frontend-dev, backend-dev]
 *   7. no-tag / default → crew:fullstack-dev (routing default)
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

test("golden trace — regular workflow with code changes (no tags → fullstack default)", async () => {
  // No sliceWorkflow key → exercises default_workflow path
  // No sliceTags → falls through to routing.default
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

test("golden trace — regular workflow with docs-only changes (fanout phase skipped)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "regular",
    changedFiles: ["docs/standards/foo.md", "docs/governance.md"]
  });

  // New shape: 2 phases (builder + reviewer-fanout). Index 1 is the fanout phase.
  expect(plan).toHaveLength(2);
  expect(plan[1]?.gate).toBe("skipped");
  expect(plan[1]?.skipReason).toContain("^docs/");
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

test("tag routing — frontend tag → crew:frontend-dev builder", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["src/components/Foo.tsx"],
    sliceTags: ["frontend"]
  });

  const builderPhase = plan[0];
  expect(builderPhase?.role).toBe("builder");
  expect(builderPhase?.agent).toBe("crew:frontend-dev");
  expect(builderPhase?.routing?.resolved_by).toBe("tag");
  expect(builderPhase?.routing?.matched_tag).toBe("frontend");
  expect(builderPhase?.parallel_dispatch).toBeUndefined();
});

test("tag routing — backend tag → crew:backend-dev builder", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["api/routes/foo.ts"],
    sliceTags: ["backend"]
  });

  const builderPhase = plan[0];
  expect(builderPhase?.role).toBe("builder");
  expect(builderPhase?.agent).toBe("crew:backend-dev");
  expect(builderPhase?.routing?.resolved_by).toBe("tag");
  expect(builderPhase?.routing?.matched_tag).toBe("backend");
  expect(builderPhase?.parallel_dispatch).toBeUndefined();
});

test("tag routing — parallel-fe-be tag → parallel_dispatch [frontend-dev, backend-dev]", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["src/components/Foo.tsx", "api/routes/foo.ts"],
    sliceTags: ["parallel-fe-be"]
  });

  const builderPhase = plan[0];
  expect(builderPhase?.role).toBe("builder");
  expect(builderPhase?.agent).toBe("");
  expect(builderPhase?.routing?.resolved_by).toBe("tag");
  expect(builderPhase?.routing?.matched_tag).toBe("parallel-fe-be");
  expect(builderPhase?.parallel_dispatch).toBeDefined();
  expect(builderPhase?.parallel_dispatch?.group).toContain("crew:frontend-dev");
  expect(builderPhase?.parallel_dispatch?.group).toContain("crew:backend-dev");
  expect(builderPhase?.parallel_dispatch?.policy).toBe("wait_for_all");
  expect(builderPhase?.parallel_dispatch?.halt_on).toBe("any_FAIL");
});

test("tag routing — no tags → crew:fullstack-dev (routing default)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"],
    sliceTags: []
  });

  const builderPhase = plan[0];
  expect(builderPhase?.role).toBe("builder");
  expect(builderPhase?.agent).toBe("crew:fullstack-dev");
  expect(builderPhase?.routing?.resolved_by).toBe("default");
  expect(builderPhase?.routing?.matched_tag).toBeUndefined();
});
