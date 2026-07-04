import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  isEnabled,
  readCrewConfig,
  FEATURES,
  getFeatureMeta
} from "../scripts/lib/features-service.ts";
import { HOOK_FLAG_DEFAULTS } from "../scripts/lib/telemetry/feature-flag-lite.ts";

test("isEnabled: no config → true", () => {
  const result = isEnabled("test-feature", null);
  assert.equal(result, true);
});

test("isEnabled: undefined config → true", () => {
  const result = isEnabled("test-feature", undefined);
  assert.equal(result, true);
});

test("isEnabled: empty object config → true", () => {
  const result = isEnabled("test-feature", {});
  assert.equal(result, true);
});

test("isEnabled: config without features key → true", () => {
  const result = isEnabled("test-feature", { other: "value" });
  assert.equal(result, true);
});

test("isEnabled: config.features is not an object → true", () => {
  const result = isEnabled("test-feature", { features: "not-an-object" });
  assert.equal(result, true);
});

test("isEnabled: missing feature entry → true", () => {
  const result = isEnabled("test-feature", { features: {} });
  assert.equal(result, true);
});

test("isEnabled: feature entry is not an object → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": "not-an-object" }
  });
  assert.equal(result, true);
});

test("isEnabled: enabled field is not a boolean (string) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: "yes" } }
  });
  assert.equal(result, true);
});

test("isEnabled: enabled field is not a boolean (number) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: 1 } }
  });
  assert.equal(result, true);
});

test("isEnabled: enabled field is not a boolean (null) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: null } }
  });
  assert.equal(result, true);
});

test("isEnabled: enabled is explicitly true → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: true } }
  });
  assert.equal(result, true);
});

test("isEnabled: enabled is explicitly false → false", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: false } }
  });
  assert.equal(result, false);
});

test("isEnabled: multiple features, one enabled false", () => {
  const config = {
    features: {
      "feature-a": { enabled: true },
      "feature-b": { enabled: false },
      "feature-c": { enabled: true }
    }
  };
  assert.equal(isEnabled("feature-a", config), true);
  assert.equal(isEnabled("feature-b", config), false);
  assert.equal(isEnabled("feature-c", config), true);
  assert.equal(isEnabled("feature-d", config), true);
});

test("isEnabled: emits stderr diagnostic line (enabled)", () => {
  const originalWrite = process.stderr.write;
  const lines: string[] = [];
  process.stderr.write = (chunk) => {
    if (typeof chunk === "string") {
      lines.push(chunk);
    }
    return true;
  };

  try {
    isEnabled("my-feature", { features: { "my-feature": { enabled: true } } });
    assert.ok(
      lines.some((line) => line.includes("[features] my-feature: enabled")),
      "Expected stderr diagnostic for enabled feature"
    );
  } finally {
    process.stderr.write = originalWrite;
  }
});

test("isEnabled: emits stderr diagnostic line (disabled)", () => {
  const originalWrite = process.stderr.write;
  const lines: string[] = [];
  process.stderr.write = (chunk) => {
    if (typeof chunk === "string") {
      lines.push(chunk);
    }
    return true;
  };

  try {
    isEnabled("my-feature", { features: { "my-feature": { enabled: false } } });
    assert.ok(
      lines.some((line) => line.includes("[features] my-feature: disabled")),
      "Expected stderr diagnostic for disabled feature"
    );
  } finally {
    process.stderr.write = originalWrite;
  }
});

// readCrewConfig tests

test("readCrewConfig: missing file → {}", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  try {
    const result = await readCrewConfig(tmpDir);
    assert.deepEqual(result, {});
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("readCrewConfig: valid JSON file → parsed object", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  const configPath = path.join(tmpDir, ".claude", "crew.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  const testConfig = {
    features: {
      "test-feature": { enabled: false }
    }
  };
  await fs.writeFile(configPath, JSON.stringify(testConfig), "utf8");

  try {
    const result = await readCrewConfig(tmpDir);
    assert.deepEqual(result, testConfig);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("readCrewConfig: malformed JSON file → {}", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  const configPath = path.join(tmpDir, ".claude", "crew.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  await fs.writeFile(configPath, "{ invalid json", "utf8");

  try {
    const result = await readCrewConfig(tmpDir);
    assert.deepEqual(result, {});
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("readCrewConfig: empty JSON object → parsed object", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  const configPath = path.join(tmpDir, ".claude", "crew.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  await fs.writeFile(configPath, "{}", "utf8");

  try {
    const result = await readCrewConfig(tmpDir);
    assert.deepEqual(result, {});
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("readCrewConfig: complex nested config → preserves structure", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  const configPath = path.join(tmpDir, ".claude", "crew.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  const testConfig = {
    features: {
      "feature-a": { enabled: true, metadata: { key: "value" } },
      "feature-b": { enabled: false }
    },
    other: { nested: { value: 123 } }
  };
  await fs.writeFile(configPath, JSON.stringify(testConfig), "utf8");

  try {
    const result = await readCrewConfig(tmpDir);
    assert.deepEqual(result, testConfig);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// registry-default tests

test("isEnabled: unknown feature not in registry → defaults to true", () => {
  const result = isEnabled("test-feature", { features: {} });
  assert.equal(result, true);
});

test("isEnabled: push-verify not in config → defaults to false (registry default)", () => {
  const result = isEnabled("push-verify", { features: {} });
  assert.equal(result, false);
});

test("isEnabled: push-verify explicitly enabled in config → true", () => {
  const result = isEnabled("push-verify", {
    features: { "push-verify": { enabled: true } }
  });
  assert.equal(result, true);
});

test("isEnabled: push-verify no config at all → defaults to false (registry default)", () => {
  const result = isEnabled("push-verify", null);
  assert.equal(result, false);
});

// ──────────────────────────────────────────────────────────────────────────
// P1.0 feature-flag envelope — 5 new registry entries
// ──────────────────────────────────────────────────────────────────────────

test("registry: P1.0 features are present with expected shape", () => {
  const expected: Record<string, { default: boolean; scope: "crew" | "shared" }> = {
    "git-gate-block": { default: false, scope: "shared" },
    "otel-telemetry": { default: true, scope: "crew" },
    "bash-gate-telemetry": { default: true, scope: "crew" },
    "task-update-burst-warn": { default: true, scope: "crew" },
    "event-emit": { default: true, scope: "shared" }
  };

  for (const [name, expectation] of Object.entries(expected)) {
    const meta = getFeatureMeta(name);
    assert.ok(meta, `expected ${name} to be registered in FEATURES`);
    assert.equal(meta!.default, expectation.default, `${name}.default`);
    assert.equal(meta!.scope, expectation.scope, `${name}.scope`);
    assert.equal(typeof meta!.version, "string", `${name}.version`);
    assert.equal(typeof meta!.description, "string", `${name}.description`);
    assert.equal(typeof meta!.since, "string", `${name}.since`);
  }

  // Also present in the raw FEATURES record (not just via getFeatureMeta).
  for (const name of Object.keys(expected)) {
    assert.ok(name in FEATURES, `expected ${name} key in FEATURES record`);
  }
});

test("isEnabled: git-gate-block defaults to false (warn) with no config", () => {
  assert.equal(isEnabled("git-gate-block", null), false);
  assert.equal(isEnabled("git-gate-block", { features: {} }), false);
});

test("isEnabled: git-gate-block explicitly enabled in config → true", () => {
  const result = isEnabled("git-gate-block", {
    features: { "git-gate-block": { enabled: true } }
  });
  assert.equal(result, true);
});

test("isEnabled: otel-telemetry / bash-gate-telemetry / task-update-burst-warn / event-emit default to true with no config", () => {
  for (const name of [
    "otel-telemetry",
    "bash-gate-telemetry",
    "task-update-burst-warn",
    "event-emit"
  ]) {
    assert.equal(isEnabled(name, null), true, `${name} should default true`);
    assert.equal(isEnabled(name, { features: {} }), true, `${name} should default true`);
  }
});

test("isEnabled: otel-telemetry / bash-gate-telemetry / task-update-burst-warn / event-emit flip off via crew.json override", () => {
  for (const name of [
    "otel-telemetry",
    "bash-gate-telemetry",
    "task-update-burst-warn",
    "event-emit"
  ]) {
    const config = { features: { [name]: { enabled: false } } };
    assert.equal(isEnabled(name, config), false, `${name} should flip to false when disabled`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// scripts/lib/telemetry/feature-flag-lite.ts parity — the otel hooks read
// this dependency-free copy (not the full registry) so they survive the
// plugin-cache smoke test's narrower static-import tree. It must not drift
// from the registry default it duplicates.
// ──────────────────────────────────────────────────────────────────────────

test("feature-flag-lite: HOOK_FLAG_DEFAULTS matches the registry default for every flag it duplicates", () => {
  for (const [name, liteDefault] of Object.entries(HOOK_FLAG_DEFAULTS)) {
    const registryMeta = getFeatureMeta(name);
    assert.ok(registryMeta, `${name} in HOOK_FLAG_DEFAULTS must also be registered in FEATURES`);
    assert.equal(
      liteDefault,
      registryMeta!.default,
      `feature-flag-lite default for ${name} (${liteDefault}) must match registry default (${registryMeta!.default})`
    );
  }
});
