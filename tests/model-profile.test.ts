/**
 * tests/model-profile.test.ts — FEAT-crew-architecture-review Section 7, Decision 4
 *
 * Covers evals/lib/model-profile.ts: schema validation happy/sad path,
 * resolveCandidateModel's "no behavior change when CREW_MODEL_PROFILE unset"
 * guarantee, and profile-override resolution.
 */
import { test, describe } from "bun:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  validateModelsConfig,
  loadModelsConfig,
  clearModelsConfigCache,
  resolveProfileTier,
  resolveCandidateModel,
  ModelProfileError,
  DEFAULT_CANDIDATE_MODEL
} from "../evals/lib/model-profile.ts";

const VALID_CONFIG = {
  version: "1.0.0",
  default_profile: "claude",
  profiles: {
    claude: { reasoning: "opus", standard: "sonnet", light: "haiku" }
  }
};

async function makeTmpRepo(modelsYamlContent: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "model-profile-"));
  await fs.writeFile(path.join(root, "models.yaml"), modelsYamlContent, "utf8");
  return root;
}

describe("validateModelsConfig", () => {
  test("accepts a well-formed config", () => {
    const config = validateModelsConfig(VALID_CONFIG);
    assert.equal(config.default_profile, "claude");
    assert.equal(config.profiles["claude"]?.standard, "sonnet");
  });

  test("rejects a non-object root", () => {
    assert.throws(() => validateModelsConfig("not an object"), ModelProfileError);
  });

  test("rejects a profile missing a tier", () => {
    const bad = {
      version: "1.0.0",
      default_profile: "claude",
      profiles: { claude: { reasoning: "opus", standard: "sonnet" } } // missing 'light'
    };
    assert.throws(() => validateModelsConfig(bad), ModelProfileError);
  });

  test("rejects an unknown default_profile", () => {
    const bad = {
      version: "1.0.0",
      default_profile: "codex",
      profiles: { claude: { reasoning: "opus", standard: "sonnet", light: "haiku" } }
    };
    assert.throws(() => validateModelsConfig(bad), ModelProfileError);
  });
});

describe("resolveProfileTier", () => {
  test("resolves the standard tier by default", () => {
    const config = validateModelsConfig(VALID_CONFIG);
    assert.equal(resolveProfileTier(config, "claude"), "sonnet");
  });

  test("resolves an explicit tier", () => {
    const config = validateModelsConfig(VALID_CONFIG);
    assert.equal(resolveProfileTier(config, "claude", "reasoning"), "opus");
    assert.equal(resolveProfileTier(config, "claude", "light"), "haiku");
  });

  test("throws on an unknown profile name", () => {
    const config = validateModelsConfig(VALID_CONFIG);
    assert.throws(() => resolveProfileTier(config, "nonexistent"), ModelProfileError);
  });
});

describe("loadModelsConfig", () => {
  test("reads and validates models.yaml from a repo root", async () => {
    const root = await makeTmpRepo(
      'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
    );
    const config = await loadModelsConfig(root);
    assert.equal(config.default_profile, "claude");
  });

  test("memoizes per repo root — a second call does not re-read the file", async () => {
    clearModelsConfigCache();
    const root = await makeTmpRepo(
      'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
    );
    const first = await loadModelsConfig(root);
    await fs.rm(path.join(root, "models.yaml")); // file gone — cached parse must still serve
    const second = await loadModelsConfig(root);
    assert.equal(second, first);
    clearModelsConfigCache();
    await assert.rejects(() => loadModelsConfig(root)); // cache cleared -> real read fails
  });
});

describe("resolveCandidateModel — no behavior change when profile absent", () => {
  test("returns candidateCfg.model when CREW_MODEL_PROFILE is unset", async () => {
    const model = await resolveCandidateModel("/does/not/matter", { model: "claude-opus-4-8" }, {});
    assert.equal(model, "claude-opus-4-8");
  });

  test("falls back to DEFAULT_CANDIDATE_MODEL when both are absent", async () => {
    const model = await resolveCandidateModel("/does/not/matter", undefined, {});
    assert.equal(model, DEFAULT_CANDIDATE_MODEL);
  });

  test("never reads models.yaml when CREW_MODEL_PROFILE is unset (a bogus repoRoot must not throw)", async () => {
    const model = await resolveCandidateModel("/definitely/does/not/exist", { model: "x" }, {});
    assert.equal(model, "x");
  });
});

describe("resolveCandidateModel — profile override", () => {
  test("overrides candidateCfg.model with the profile's standard tier when set", async () => {
    const root = await makeTmpRepo(
      'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
    );
    const model = await resolveCandidateModel(
      root,
      { model: "claude-opus-4-8" }, // yaml explicitly pins a model — profile still wins
      { CREW_MODEL_PROFILE: "claude" }
    );
    assert.equal(model, "sonnet");
  });

  test("CREW_CANDIDATE_MODEL wins over profile and yaml, without reading models.yaml", async () => {
    const model = await resolveCandidateModel(
      "/definitely/does/not/exist", // direct override must not touch disk
      { model: "claude-opus-4-8" },
      { CREW_CANDIDATE_MODEL: "gpt-x-test", CREW_MODEL_PROFILE: "claude" }
    );
    assert.equal(model, "gpt-x-test");
  });

  test("throws a ModelProfileError for an unknown CREW_MODEL_PROFILE value", async () => {
    const root = await makeTmpRepo(
      'version: "1.0.0"\ndefault_profile: claude\nprofiles:\n  claude:\n    reasoning: opus\n    standard: sonnet\n    light: haiku\n'
    );
    await assert.rejects(
      () => resolveCandidateModel(root, undefined, { CREW_MODEL_PROFILE: "nonexistent" }),
      ModelProfileError
    );
  });
});
