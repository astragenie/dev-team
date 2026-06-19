/**
 * tests/scripts/lib/workflow-config.test.ts — FEAT-166 SLICE-78
 *
 * Unit tests for scripts/lib/workflow-config.ts:
 *   1. Happy path — load + expand default (new shape: 2 phases, builder with routing + fanout)
 *   2. Named workflow lookup
 *   3. Unknown workflow throws typed error
 *   4. Missing file throws typed error
 *   5. Invalid phase order fails validator (CLI)
 *   6. Unknown role fails Zod schema
 *   7. parallel_dispatch schema — valid fanout group parses correctly
 *   8. routing schema — tag_routes + default parses correctly
 *   9. Phase without agent/routing/parallel_dispatch fails refine check
 *  10. parallel-fe-be tag_routes value with nested parallel_dispatch parses correctly
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
  WorkflowPhaseSchema,
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
  test("1. happy path — load + expand default (routing + parallel_dispatch shape)", async () => {
    const tmpRoot = await makeTempRepoWithFixture("regular.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      const workflow = expandWorkflow(config);

      // New shape: 2 phases (builder-routing + reviewer-fanout)
      expect(workflow.phases.length).toBe(2);

      // Phase 0: builder with routing
      const builderPhase = workflow.phases[0];
      expect(builderPhase?.role).toBe("builder");
      expect(builderPhase?.routing).toBeDefined();
      expect(builderPhase?.routing?.default).toBe("crew:fullstack-dev");
      expect(builderPhase?.agent).toBeUndefined();

      // Phase 1: reviewer fanout with parallel_dispatch
      const fanoutPhase = workflow.phases[1];
      expect(fanoutPhase?.role).toBe("reviewer");
      expect(fanoutPhase?.parallel_dispatch).toBeDefined();
      expect(fanoutPhase?.parallel_dispatch?.group).toHaveLength(3);
      expect(fanoutPhase?.parallel_dispatch?.policy).toBe("wait_for_all");
      expect(fanoutPhase?.parallel_dispatch?.halt_on).toBe("any_FAIL");
      expect(fanoutPhase?.aggregation?.halt_on_any_FAIL).toBe(true);
      expect(fanoutPhase?.aggregation?.wait_for_all).toBe(true);
      expect(fanoutPhase?.gate?.policy).toBe("all_pass");
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
    const result = spawnSync("node", [VALIDATE_SCRIPT, "--config", fixturePath], {
      encoding: "utf8",
      cwd: REPO_ROOT
    });

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

  test("7. parallel_dispatch schema — valid fanout group parses correctly", () => {
    const result = WorkflowPhaseSchema.safeParse({
      role: "reviewer",
      parallel_dispatch: {
        group: ["crew:inspector", "crew:inspector", "crew:verifier"],
        policy: "wait_for_all",
        halt_on: "any_FAIL"
      },
      aggregation: {
        halt_on_any_FAIL: true,
        wait_for_all: true
      },
      gate: { policy: "all_pass" }
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parallel_dispatch?.group).toHaveLength(3);
      expect(result.data.parallel_dispatch?.policy).toBe("wait_for_all");
      expect(result.data.parallel_dispatch?.halt_on).toBe("any_FAIL");
      expect(result.data.aggregation?.halt_on_any_FAIL).toBe(true);
      expect(result.data.aggregation?.wait_for_all).toBe(true);
    }
  });

  test("8. routing schema — tag_routes + default parses correctly", () => {
    const result = WorkflowPhaseSchema.safeParse({
      role: "builder",
      routing: {
        tag_routes: {
          frontend: "crew:frontend-dev",
          backend: "crew:backend-dev"
        },
        default: "crew:fullstack-dev"
      },
      emit: "handoff"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routing?.default).toBe("crew:fullstack-dev");
      expect(result.data.routing?.tag_routes?.["frontend"]).toBe("crew:frontend-dev");
    }
  });

  test("9. phase without agent/routing/parallel_dispatch fails refine check", () => {
    const result = WorkflowPhaseSchema.safeParse({
      role: "builder",
      emit: "handoff"
      // No agent, no routing, no parallel_dispatch
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("agent");
    }
  });

  test("10. parallel-fe-be tag_routes with nested parallel_dispatch parses correctly", () => {
    const result = WorkflowPhaseSchema.safeParse({
      role: "builder",
      routing: {
        tag_routes: {
          "parallel-fe-be": {
            parallel_dispatch: {
              group: ["crew:frontend-dev", "crew:backend-dev"],
              policy: "wait_for_all",
              halt_on: "any_FAIL"
            }
          }
        },
        default: "crew:fullstack-dev"
      },
      emit: "handoff"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const pfebeRoute = result.data.routing?.tag_routes?.["parallel-fe-be"];
      expect(pfebeRoute).toBeDefined();
      expect(typeof pfebeRoute).not.toBe("string");
      if (
        typeof pfebeRoute === "object" &&
        pfebeRoute !== null &&
        "parallel_dispatch" in pfebeRoute
      ) {
        expect(pfebeRoute.parallel_dispatch.group).toContain("crew:frontend-dev");
        expect(pfebeRoute.parallel_dispatch.group).toContain("crew:backend-dev");
      }
    }
  });
});
