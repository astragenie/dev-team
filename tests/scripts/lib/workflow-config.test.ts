/**
 * tests/scripts/lib/workflow-config.test.ts — FEAT-166 SLICE-78
 *
 * Unit tests for scripts/lib/workflow-config.ts:
 *   1. Happy path — load + expand default
 *   2. Named workflow lookup
 *   3. Unknown workflow throws typed error
 *   4. Missing file throws typed error
 *   5. Invalid phase order fails validator (CLI)
 *   6. Unknown role fails Zod schema
 */
import { test, describe, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  loadWorkflowConfig,
  expandWorkflow,
  WorkflowConfigNotFoundError,
  WorkflowConfigShapeError,
  UnknownWorkflowError
} from "../../../scripts/lib/workflow-config.ts";

// File is at tests/scripts/lib/workflow-config.test.ts — 3 dirs deep from tests/, 4 from repo root
const REPO_ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
);
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "fixtures", "workflows");
const VALIDATE_SCRIPT = path.join(REPO_ROOT, "scripts", "validate-workflows.ts");

// Helper: create a temp dir containing .claude/workflows.yaml pointing at a fixture
async function makeTempRepoWithFixture(fixtureName: string): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-config-test-"));
  const claudeDir = path.join(tmpRoot, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });
  const src = path.join(FIXTURES_DIR, fixtureName);
  await fs.copyFile(src, path.join(claudeDir, "workflows.yaml"));
  return tmpRoot;
}

describe("workflow-config loader", () => {
  test("1. happy path — load + expand default", async () => {
    const tmpRoot = await makeTempRepoWithFixture("regular.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      const workflow = expandWorkflow(config);

      expect(workflow.phases.length).toBe(3);
      expect(workflow.phases[0]?.role).toBe("builder");
      expect(workflow.phases[1]?.parallel).toBe(2);
      expect(workflow.phases[2]?.gate?.policy).toBe("blocking");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("2. named workflow lookup returns same object as default", async () => {
    const tmpRoot = await makeTempRepoWithFixture("regular.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      const byDefault = expandWorkflow(config);
      const byName = expandWorkflow(config, "regular");

      // Same referential object — expandWorkflow returns the same map entry
      expect(byName).toBe(byDefault);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("3. unknown workflow throws UnknownWorkflowError", async () => {
    const tmpRoot = await makeTempRepoWithFixture("regular.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      expect(() => expandWorkflow(config, "nonexistent")).toThrow(UnknownWorkflowError);

      let caught: UnknownWorkflowError | null = null;
      try {
        expandWorkflow(config, "nonexistent");
      } catch (err) {
        if (err instanceof UnknownWorkflowError) caught = err;
      }
      expect(caught).not.toBeNull();
      expect(caught?.message).toContain("nonexistent");
      expect(caught?.availableWorkflows).toContain("regular");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("4. missing file throws WorkflowConfigNotFoundError with .searchedPath", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-missing-"));
    try {
      let caught: WorkflowConfigNotFoundError | null = null;
      try {
        await loadWorkflowConfig(tmpRoot);
      } catch (err) {
        if (err instanceof WorkflowConfigNotFoundError) caught = err;
      }
      expect(caught).not.toBeNull();
      expect(caught?.searchedPath).toMatch(/\.claude[/\\]workflows\.yaml$/);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("5. invalid phase order fails validate-workflows.ts CLI (exit 1, stderr contains 'phase order')", () => {
    const fixturePath = path.join(FIXTURES_DIR, "invalid-phase-order.yaml");
    const result = spawnSync(
      "node",
      ["--experimental-strip-types", VALIDATE_SCRIPT, "--config", fixturePath],
      { encoding: "utf8", cwd: REPO_ROOT }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("VALIDATE-WORKFLOWS error:");
    expect(result.stderr).toContain("phase order");
  });

  test("6. unknown role fails Zod schema with WorkflowConfigShapeError", async () => {
    const tmpRoot = await makeTempRepoWithFixture("unknown-role.yaml");
    try {
      let caught: WorkflowConfigShapeError | null = null;
      try {
        await loadWorkflowConfig(tmpRoot);
      } catch (err) {
        if (err instanceof WorkflowConfigShapeError) caught = err;
      }
      expect(caught).not.toBeNull();
      expect(caught?.message).toContain("role");
      expect(caught?.message).toContain("archivist");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
