/**
 * tests/scripts/lib/workflow-config.env-sub.test.ts — FEAT-166 SLICE-82
 *
 * Unit tests for the ${env:VAR} and ${env:VAR:-default} substitution in
 * scripts/lib/workflow-config.ts.
 *
 * Tests:
 *   1. Substitution succeeds when env var is set
 *   2. Substitution falls back to default when env var is unset
 *   3. Missing env var with no default throws EnvSubstitutionError with .variable field
 */
import { test, describe, expect, afterEach } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkflowConfig, EnvSubstitutionError } from "../../../scripts/lib/workflow-config.ts";

const REPO_ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
);
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "fixtures", "workflows");

/** Create a temp repo rooted at a dir with the given fixture as .claude/workflows.yaml. */
async function makeTempRepoWithFixture(fixtureName: string): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "env-sub-test-"));
  const claudeDir = path.join(tmpRoot, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });
  const src = path.join(FIXTURES_DIR, fixtureName);
  await fs.copyFile(src, path.join(claudeDir, "workflows.yaml"));
  return tmpRoot;
}

describe("${env:VAR} substitution", () => {
  // Track the original env value for cleanup
  let savedValue: string | undefined;

  afterEach(() => {
    // Clean up any env vars touched during the test
    if (savedValue !== undefined) {
      process.env.CREW_TEST_DESC = savedValue;
    } else {
      delete process.env.CREW_TEST_DESC;
    }
    delete process.env.CREW_UNSET_VAR;
    delete process.env.CREW_DEFINITELY_UNSET;
  });

  test("1. substitution succeeds when env var is set", async () => {
    savedValue = process.env.CREW_TEST_DESC;
    process.env.CREW_TEST_DESC = "hello";

    const tmpRoot = await makeTempRepoWithFixture("with-env-default.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      // The "test-workflow" workflow has description: ${env:CREW_TEST_DESC}
      const workflow = config.workflows["test-workflow"];
      expect(workflow).toBeDefined();
      expect(workflow?.description).toBe("hello");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("2. substitution falls back to default when env var is unset", async () => {
    delete process.env.CREW_UNSET_VAR;

    // Uses a separate fixture that only contains the default-value form
    const tmpRoot = await makeTempRepoWithFixture("with-env-default-value.yaml");
    try {
      const config = await loadWorkflowConfig(tmpRoot);
      // The workflow has description: ${env:CREW_UNSET_VAR:-fallback-value}
      const workflow = config.workflows["test-workflow"];
      expect(workflow).toBeDefined();
      expect(workflow?.description).toBe("fallback-value");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("3. missing env var with no default throws EnvSubstitutionError", async () => {
    delete process.env.CREW_DEFINITELY_UNSET;

    const tmpRoot = await makeTempRepoWithFixture("missing-env.yaml");
    try {
      let caught: EnvSubstitutionError | null = null;
      try {
        await loadWorkflowConfig(tmpRoot);
      } catch (err) {
        if (err instanceof EnvSubstitutionError) caught = err;
      }
      expect(caught).not.toBeNull();
      expect(caught?.variable).toBe("CREW_DEFINITELY_UNSET");
      expect(caught?.message).toContain("CREW_DEFINITELY_UNSET");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
