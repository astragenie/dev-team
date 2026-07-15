// tests/cli-recall-block.test.ts
// FEAT-188 S3a — CLI surface (`node scripts/crew.ts recall-block`) that
// commands/build.md, commands/fix.md, commands/ship.md, and
// commands/orchestrate-slice.md call before dispatching a subagent.
//
// --project coverage (astragenie/dev-team#159, FEAT-423) mirrors
// tests/memory-inject-recall.test.ts's wire-level assertions via the same
// `_setWireProvider` test seam, confirming the CLI flag reaches the same
// buildRecallBlock() plumbing (single value + comma-list -> OR array).
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";
import { fileProvider } from "@astragenie/memory-provider";
import {
  _resetResolveCache,
  _setWireProvider,
  type RecallRequest
} from "@astragenie/astramem-client";

test("CLI recall-block returns an empty block when no memory config exists", async () => {
  const repoPath = await makeTempDir("crew-cli-recall-block-none-");
  const { code, output } = await runCrew(["recall-block", "--repo", repoPath]);
  assert.equal(code, 0);
  const result = JSON.parse(output);
  assert.equal(result.block, "");
});

test("CLI recall-block returns the bridge-format block scoped by --agent/--tags", async () => {
  const repoPath = await makeTempDir("crew-cli-recall-block-scoped-");
  await fileProvider(repoPath).capture({
    kind: "failure",
    severity: "high",
    agent: "crew:fullstack-dev",
    tags: ["stack:typescript"],
    summary: "prior review rejected a missing null guard",
    source: "review_fail"
  });
  await fs.mkdir(path.join(repoPath, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".claude", "loop.json"),
    JSON.stringify({ memory: { provider: "file" } }),
    "utf8"
  );

  const { code, output } = await runCrew([
    "recall-block",
    "--repo",
    repoPath,
    "--agent",
    "crew:fullstack-dev",
    "--tags",
    "stack:typescript"
  ]);
  assert.equal(code, 0);
  const result = JSON.parse(output);
  assert.match(result.block, /## Prior context \(from astramem\)/);
  assert.match(result.block, /prior review rejected a missing null guard/);
});

test("CLI recall-block forwards a single --project value to the wire provider (#159)", async () => {
  const repoPath = await makeTempDir("crew-cli-recall-block-project-single-");
  await fs.mkdir(path.join(repoPath, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".claude", "loop.json"),
    JSON.stringify({ memory: { provider: "astramem" } }),
    "utf8"
  );

  let capturedReq: RecallRequest | undefined;
  _resetResolveCache();
  _setWireProvider({
    async recall(req) {
      capturedReq = req;
      return { hits: [] };
    },
    async remember() {
      return undefined;
    },
    async health() {
      return { ok: true };
    }
  });

  try {
    const { code } = await runCrew(["recall-block", "--repo", repoPath, "--project", "dev-team"]);
    assert.equal(code, 0);
    assert.equal(capturedReq?.project, "dev-team");
  } finally {
    _setWireProvider(null);
    _resetResolveCache();
  }
});

test("CLI recall-block forwards a comma-list --project as an OR array (#159)", async () => {
  const repoPath = await makeTempDir("crew-cli-recall-block-project-list-");
  await fs.mkdir(path.join(repoPath, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".claude", "loop.json"),
    JSON.stringify({ memory: { provider: "astramem" } }),
    "utf8"
  );

  let capturedReq: RecallRequest | undefined;
  _resetResolveCache();
  _setWireProvider({
    async recall(req) {
      capturedReq = req;
      return { hits: [] };
    },
    async remember() {
      return undefined;
    },
    async health() {
      return { ok: true };
    }
  });

  try {
    const { code } = await runCrew([
      "recall-block",
      "--repo",
      repoPath,
      "--project",
      "dev-team,runner-plugin"
    ]);
    assert.equal(code, 0);
    assert.deepEqual(capturedReq?.project, ["dev-team", "runner-plugin"]);
  } finally {
    _setWireProvider(null);
    _resetResolveCache();
  }
});
