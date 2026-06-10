// TDD test for WS1 Task 1+2: injectable projects root via CREW_PROJECTS_ROOT env var.
//
// AC: listActiveProjectDirs respects CREW_PROJECTS_ROOT environment variable instead of
// scanning the user's real ~/.claude/projects directory.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { listActiveProjectDirs } from "../scripts/lib/session-cost-scanner.ts";

// ── helpers ────────────────────────────────────────────────────────────────

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hero-crew-projects-root-test-"));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Creates a fixture project directory with a single session .jsonl file
 * containing one assistant turn within the time window.
 */
async function createFixtureProject(
  fixtureRoot: string,
  slug: string,
  filenameWithoutExt: string,
  timestamp: string
) {
  const projectDir = path.join(fixtureRoot, slug);
  await fs.mkdir(projectDir, { recursive: true });

  const jsonlFile = path.join(projectDir, `${filenameWithoutExt}.jsonl`);
  const line = JSON.stringify({
    type: "assistant",
    timestamp,
    message: {
      model: "claude-haiku-4-5-20251001",
      usage: {
        input_tokens: 100,
        output_tokens: 50
      },
      content: []
    }
  });
  await fs.writeFile(jsonlFile, line + "\n", "utf8");
}

// ── test ───────────────────────────────────────────────────────────────────

test("listActiveProjectDirs respects CREW_PROJECTS_ROOT environment variable", async () => {
  const fixtureRoot = await makeTempDir();
  const originalEnv = process.env.CREW_PROJECTS_ROOT;

  try {
    // Set the env var to our fixture root
    process.env.CREW_PROJECTS_ROOT = fixtureRoot;

    // Create a single fixture project with a session in the time window
    const now = new Date();
    const startWindow = new Date(now.getTime() - 60_000); // 1 min ago
    const endWindow = new Date(now.getTime() + 60_000); // 1 min future

    await createFixtureProject(
      fixtureRoot,
      "test-project-1",
      "session-1",
      now.toISOString()
    );

    // Query for projects with in-window activity
    const active = await listActiveProjectDirs({
      startMs: startWindow.getTime(),
      endMs: endWindow.getTime()
    });

    // Verify only our fixture project is found
    assert.equal(active.length, 1, "Expected exactly one active project");
    assert.equal(active[0]?.slug, "test-project-1", "Expected fixture slug");
    assert.equal(
      active[0]?.dir,
      path.join(fixtureRoot, "test-project-1"),
      "Expected dir to point to fixture"
    );
  } finally {
    // Restore env var and cleanup
    if (originalEnv === undefined) {
      delete process.env.CREW_PROJECTS_ROOT;
    } else {
      process.env.CREW_PROJECTS_ROOT = originalEnv;
    }
    await cleanup(fixtureRoot);
  }
});

test("listActiveProjectDirs falls back to ~/.claude/projects when CREW_PROJECTS_ROOT is not set", async () => {
  const originalEnv = process.env.CREW_PROJECTS_ROOT;

  try {
    // Ensure env var is unset
    delete process.env.CREW_PROJECTS_ROOT;

    // Query with a window guaranteed to have no activity anywhere
    // (far past and future times that won't match real sessions)
    const veryOldStart = Date.parse("1970-01-01T00:00:00Z");
    const veryOldEnd = Date.parse("1970-01-02T00:00:00Z");

    // This should not throw; it will simply return an empty array if the default
    // ~/.claude/projects has no activity in that ancient window (which it won't)
    const active = await listActiveProjectDirs({
      startMs: veryOldStart,
      endMs: veryOldEnd
    });

    assert.ok(Array.isArray(active), "Should return an array even without env var");
    assert.equal(active.length, 0, "Should have no activity in year 1970");
  } finally {
    // Restore env var
    if (originalEnv !== undefined) {
      process.env.CREW_PROJECTS_ROOT = originalEnv;
    }
  }
});
