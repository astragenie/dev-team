// tests/cli-resolve-model.test.ts
// FEAT-194 S1 — model routing as a crew.json feature toggle. Covers the
// `crew resolve-model` CLI handler (scripts/crew.ts) end-to-end: reading
// .claude/loop.json (modelRouting) AND .claude/crew.json
// (features["model-routing"].enabled), the same isEnabled() gate the other
// three crew.json feature flags use. Unit coverage for the pure resolver
// itself lives in tests/resolve-model.test.ts.
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { runCrew } from "../scripts/crew.ts";
import { makeTempDir } from "./helpers/cli-fixtures.ts";

async function writeLoopModelRouting(repoPath: string): Promise<void> {
  await fs.mkdir(path.join(repoPath, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".claude", "loop.json"),
    JSON.stringify({
      loop: { modelRouting: { architect: "opus", build: "sonnet", default: "sonnet" } }
    }),
    "utf8"
  );
}

async function writeCrewFeatureToggle(repoPath: string, enabled: boolean): Promise<void> {
  await fs.mkdir(path.join(repoPath, ".claude"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".claude", "crew.json"),
    JSON.stringify({ features: { "model-routing": { enabled } } }),
    "utf8"
  );
}

test("CLI resolve-model: toggle absent (no crew.json) defaults to routing-on — build resolves to sonnet", async () => {
  const repoPath = await makeTempDir("crew-cli-resolve-model-default-on-");
  await writeLoopModelRouting(repoPath);

  const { code, output } = await runCrew(["resolve-model", "--repo", repoPath, "--phase", "build"]);
  assert.equal(code, 0);
  assert.equal(output, "sonnet");
});

test("CLI resolve-model: toggle explicitly enabled — behaves as today, build resolves to sonnet", async () => {
  const repoPath = await makeTempDir("crew-cli-resolve-model-on-");
  await writeLoopModelRouting(repoPath);
  await writeCrewFeatureToggle(repoPath, true);

  const { code, output } = await runCrew(["resolve-model", "--repo", repoPath, "--phase", "build"]);
  assert.equal(code, 0);
  assert.equal(output, "sonnet");
});

test("CLI resolve-model: toggle disabled — returns the opus fallback even though loop.json routes build to sonnet", async () => {
  const repoPath = await makeTempDir("crew-cli-resolve-model-off-");
  await writeLoopModelRouting(repoPath);
  await writeCrewFeatureToggle(repoPath, false);

  const { code, output } = await runCrew(["resolve-model", "--repo", repoPath, "--phase", "build"]);
  assert.equal(code, 0);
  assert.equal(output, "opus");
});

test("CLI resolve-model: toggle disabled also bypasses the trivial-shape override", async () => {
  const repoPath = await makeTempDir("crew-cli-resolve-model-off-shape-");
  await writeLoopModelRouting(repoPath);
  await writeCrewFeatureToggle(repoPath, false);

  const { code, output } = await runCrew([
    "resolve-model",
    "--repo",
    repoPath,
    "--phase",
    "build",
    "--shape",
    "doc-update"
  ]);
  assert.equal(code, 0);
  assert.equal(output, "opus");
});

test("CLI resolve-model: no loop.json and no crew.json — default-on routing falls back to opus (no routing configured)", async () => {
  const repoPath = await makeTempDir("crew-cli-resolve-model-none-");

  const { code, output } = await runCrew(["resolve-model", "--repo", repoPath, "--phase", "build"]);
  assert.equal(code, 0);
  assert.equal(output, "opus");
});
