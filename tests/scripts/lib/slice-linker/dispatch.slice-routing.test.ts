/**
 * tests/scripts/lib/slice-linker/dispatch.slice-routing.test.ts — FEAT-166 SLICE-82
 *
 * Contract tests for slice-frontmatter workflow: routing through planDispatch.
 *
 * Documents the end-to-end contract: slice frontmatter parse → workflow string
 * → planDispatch(). The caller (loop plugin or interactive /crew:build) is
 * responsible for parsing the slice frontmatter and passing sliceWorkflow;
 * planDispatch receives the already-resolved string.
 *
 * Tests:
 *   1. sliceWorkflow: "quick" → quick plan (builder + reviewer_validator)
 *   2. sliceWorkflow: "spike" → spike plan (builder only)
 *   3. sliceWorkflow: "release" → release plan (builder + reviewer + validator + deployer)
 *   4. sliceWorkflow: undefined → falls back to default_workflow (regular)
 */
import { test, expect } from "bun:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planDispatch } from "../../../../scripts/lib/slice-linker/dispatch.mts";

const REPO_ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))))
);

const CHANGED_FILES = ["scripts/lib/foo.ts"];

test("slice frontmatter workflow: quick → quick dispatch plan", async () => {
  // Simulates: a slice file has `workflow: quick` in frontmatter.
  // The caller parsed it and passes sliceWorkflow: "quick".
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "quick",
    changedFiles: CHANGED_FILES
  });

  expect(plan).toHaveLength(2);
  expect(plan[0]?.role).toBe("builder");
  expect(plan[0]?.agent).toBe("crew:fullstack-dev");
  expect(plan[0]?.gate).toBe("none");
  expect(plan[1]?.role).toBe("reviewer_validator");
  expect(plan[1]?.agent).toBe("crew:inspector-lite");
  expect(plan[1]?.parallel).toBe(1);
  expect(plan[1]?.gate).toBe("all_pass");
});

test("slice frontmatter workflow: spike → spike dispatch plan (builder only)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "spike",
    changedFiles: CHANGED_FILES
  });

  expect(plan).toHaveLength(1);
  expect(plan[0]?.role).toBe("builder");
  expect(plan[0]?.agent).toBe("crew:fullstack-dev");
  expect(plan[0]?.gate).toBe("none");
});

test("slice frontmatter workflow: release → release dispatch plan (4 phases)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    sliceWorkflow: "release",
    changedFiles: CHANGED_FILES
  });

  expect(plan).toHaveLength(4);
  expect(plan[0]?.role).toBe("builder");
  expect(plan[1]?.role).toBe("reviewer");
  expect(plan[2]?.role).toBe("validator");
  expect(plan[3]?.role).toBe("deployer");
  // Critical: require_user_approval must be propagated
  expect(plan[3]?.require_user_approval).toBe(true);
});

test("slice frontmatter workflow: absent → default_workflow (regular)", async () => {
  // Simulates: slice has no `workflow:` field; caller passes no sliceWorkflow.
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: CHANGED_FILES
  });

  // Regular has 2 phases
  expect(plan).toHaveLength(2);
  expect(plan[0]?.role).toBe("builder");
  expect(plan[1]?.role).toBe("reviewer");
  // Builder uses routing (regular has routing, not plain agent)
  expect(plan[0]?.routing).toBeDefined();
});
