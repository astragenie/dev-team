/**
 * tests/scripts/lib/slice-linker/dispatch.memory-hint.test.ts — FEAT-188 S3a
 *
 * planDispatch's emitted-shape extension: an optional `memory` scoping hint
 * per phase (tags + resolved agent) for the runtime consumer (S3b) to apply
 * at the live dispatch call. dispatch.mts stays a pure plan generator — no
 * recall() call, no I/O to the memory store happens here.
 *
 * Tests:
 *   1. no memoryConfig opt → no `memory` field on any phase (today's shape).
 *   2. memoryConfig resolving to provider:"none" → no `memory` field.
 *   3. memoryConfig resolving to recall.enabled:false → no `memory` field.
 *   4. memoryConfig resolving to recall-enabled → single-agent phases get
 *      { agent, tags }; parallel_dispatch phases get { tags } only.
 */
import { test, expect } from "bun:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planDispatch } from "../../../../scripts/lib/slice-linker/dispatch.mts";

const REPO_ROOT = path.dirname(
  path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))))
);

test("no memoryConfig opt -> no memory field on any phase (today's shape preserved)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"]
  });

  for (const phase of plan) {
    expect(phase.memory).toBeUndefined();
  }
});

test("memoryConfig provider:none -> no memory field (explicit disable, same as default)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"],
    memoryConfig: { provider: "none" }
  });

  for (const phase of plan) {
    expect(phase.memory).toBeUndefined();
  }
});

test("memoryConfig recall.enabled:false -> no memory field even with provider:file", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"],
    memoryConfig: { provider: "file", recall: { enabled: false } }
  });

  for (const phase of plan) {
    expect(phase.memory).toBeUndefined();
  }
});

test("memoryConfig recall-enabled -> single-agent phase gets {agent, tags}", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["scripts/lib/foo.ts"],
    sliceTags: ["stack:typescript"],
    memoryConfig: { provider: "file" }
  });

  const builderPhase = plan[0];
  expect(builderPhase?.agent).toBe("crew:fullstack-dev");
  expect(builderPhase?.memory).toEqual({ agent: "crew:fullstack-dev", tags: ["stack:typescript"] });
});

test("memoryConfig recall-enabled -> parallel_dispatch phase gets {tags} only (no single agent)", async () => {
  const plan = await planDispatch({
    repoRoot: REPO_ROOT,
    changedFiles: ["src/components/Foo.tsx", "api/routes/foo.ts"],
    sliceTags: ["parallel-fe-be"],
    memoryConfig: { provider: "file" }
  });

  const builderPhase = plan[0];
  expect(builderPhase?.agent).toBe("");
  expect(builderPhase?.parallel_dispatch).toBeDefined();
  expect(builderPhase?.memory).toEqual({ tags: ["parallel-fe-be"] });
});
