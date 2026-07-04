// tests/apply-model-profile.test.ts — FEAT-crew-architecture-review Section 7, Decision 4
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadModelsConfig,
  resolveProfile,
  tierForModel,
  applyModelProfile
} from "../scripts/apply-model-profile.ts";

const TWO_PROFILE_YAML = `version: "1.0.0"
default_profile: claude
profiles:
  claude:
    reasoning: opus
    standard: sonnet
    light: haiku
  other:
    reasoning: reasoning-model
    standard: standard-model
    light: light-model
`;

async function makeFixture(): Promise<{ root: string; modelsYamlPath: string; agentsDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apply-model-profile-"));
  const modelsYamlPath = path.join(root, "models.yaml");
  await fs.writeFile(modelsYamlPath, TWO_PROFILE_YAML, "utf8");
  const agentsDir = path.join(root, "agents");
  await fs.mkdir(agentsDir, { recursive: true });
  return { root, modelsYamlPath, agentsDir };
}

const AGENT_BODY = (model: string) => `---
name: fake-agent
model: ${model}
---

You are the fake-agent.
`;

test("loadModelsConfig parses a well-formed models.yaml", async () => {
  const { modelsYamlPath } = await makeFixture();
  const config = await loadModelsConfig(modelsYamlPath);
  assert.equal(config.default_profile, "claude");
  assert.equal(Object.keys(config.profiles).length, 2);
});

test("loadModelsConfig rejects malformed yaml (missing tier)", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apply-model-profile-bad-"));
  const modelsYamlPath = path.join(root, "models.yaml");
  await fs.writeFile(
    modelsYamlPath,
    'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n',
    "utf8"
  );
  await assert.rejects(() => loadModelsConfig(modelsYamlPath));
});

test("resolveProfile returns the named profile", async () => {
  const { modelsYamlPath } = await makeFixture();
  const config = await loadModelsConfig(modelsYamlPath);
  assert.deepEqual(resolveProfile(config, "claude"), {
    reasoning: "opus",
    standard: "sonnet",
    light: "haiku"
  });
});

test("resolveProfile throws on an unknown profile name", async () => {
  const { modelsYamlPath } = await makeFixture();
  const config = await loadModelsConfig(modelsYamlPath);
  assert.throws(() => resolveProfile(config, "nonexistent"));
});

test("tierForModel reverse-maps a concrete model to its tier", async () => {
  const { modelsYamlPath } = await makeFixture();
  const config = await loadModelsConfig(modelsYamlPath);
  const claudeProfile = resolveProfile(config, "claude");
  assert.equal(tierForModel(claudeProfile, "sonnet"), "standard");
  assert.equal(tierForModel(claudeProfile, "opus"), "reasoning");
  assert.equal(tierForModel(claudeProfile, "haiku"), "light");
});

test("tierForModel returns null for an unrecognized model value", async () => {
  const { modelsYamlPath } = await makeFixture();
  const config = await loadModelsConfig(modelsYamlPath);
  const claudeProfile = resolveProfile(config, "claude");
  assert.equal(tierForModel(claudeProfile, "gpt-4"), null);
});

test("applyModelProfile is a no-op when target profile equals source (dry-run)", async () => {
  const { modelsYamlPath, agentsDir } = await makeFixture();
  await fs.writeFile(path.join(agentsDir, "a.md"), AGENT_BODY("sonnet"), "utf8");
  const result = await applyModelProfile({
    profileName: "claude",
    modelsYamlPath,
    agentsDir,
    dryRun: true
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.skipped.length, 0);
});

test("applyModelProfile computes changes per-tier without writing in dry-run mode", async () => {
  const { modelsYamlPath, agentsDir } = await makeFixture();
  await fs.writeFile(path.join(agentsDir, "reasoning-agent.md"), AGENT_BODY("opus"), "utf8");
  await fs.writeFile(path.join(agentsDir, "standard-agent.md"), AGENT_BODY("sonnet"), "utf8");
  await fs.writeFile(path.join(agentsDir, "light-agent.md"), AGENT_BODY("haiku"), "utf8");

  const result = await applyModelProfile({
    profileName: "other",
    modelsYamlPath,
    agentsDir,
    dryRun: true
  });

  assert.equal(result.changes.length, 3);
  const byTier = Object.fromEntries(result.changes.map((c) => [c.tier, c.toModel]));
  assert.equal(byTier["reasoning"], "reasoning-model");
  assert.equal(byTier["standard"], "standard-model");
  assert.equal(byTier["light"], "light-model");

  // dry-run must not have written anything
  const stillOriginal = await fs.readFile(path.join(agentsDir, "standard-agent.md"), "utf8");
  assert.match(stillOriginal, /model: sonnet/);
});

test("applyModelProfile writes the new model when dryRun is false", async () => {
  const { modelsYamlPath, agentsDir } = await makeFixture();
  await fs.writeFile(path.join(agentsDir, "standard-agent.md"), AGENT_BODY("sonnet"), "utf8");

  await applyModelProfile({ profileName: "other", modelsYamlPath, agentsDir, dryRun: false });

  const updated = await fs.readFile(path.join(agentsDir, "standard-agent.md"), "utf8");
  assert.match(updated, /model: standard-model/);
  assert.doesNotMatch(updated, /model: sonnet/);
});

test("applyModelProfile skips an agent whose model doesn't map to a known tier", async () => {
  const { modelsYamlPath, agentsDir } = await makeFixture();
  await fs.writeFile(path.join(agentsDir, "weird-agent.md"), AGENT_BODY("gpt-4"), "utf8");

  const result = await applyModelProfile({
    profileName: "other",
    modelsYamlPath,
    agentsDir,
    dryRun: true
  });

  assert.equal(result.changes.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0]?.reason ?? "", /not a recognized/);
});

test("applyModelProfile throws for an unknown --profile name", async () => {
  const { modelsYamlPath, agentsDir } = await makeFixture();
  await assert.rejects(() =>
    applyModelProfile({ profileName: "nonexistent", modelsYamlPath, agentsDir, dryRun: true })
  );
});
