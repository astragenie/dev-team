import { test, expect } from "bun:test";
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
  expect(result).toBe(true);
});

test("isEnabled: undefined config → true", () => {
  const result = isEnabled("test-feature", undefined);
  expect(result).toBe(true);
});

test("isEnabled: empty object config → true", () => {
  const result = isEnabled("test-feature", {});
  expect(result).toBe(true);
});

test("isEnabled: config without features key → true", () => {
  const result = isEnabled("test-feature", { other: "value" });
  expect(result).toBe(true);
});

test("isEnabled: config.features is not an object → true", () => {
  const result = isEnabled("test-feature", { features: "not-an-object" });
  expect(result).toBe(true);
});

test("isEnabled: missing feature entry → true", () => {
  const result = isEnabled("test-feature", { features: {} });
  expect(result).toBe(true);
});

test("isEnabled: feature entry is not an object → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": "not-an-object" }
  });
  expect(result).toBe(true);
});

test("isEnabled: enabled field is not a boolean (string) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: "yes" } }
  });
  expect(result).toBe(true);
});

test("isEnabled: enabled field is not a boolean (number) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: 1 } }
  });
  expect(result).toBe(true);
});

test("isEnabled: enabled field is not a boolean (null) → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: null } }
  });
  expect(result).toBe(true);
});

test("isEnabled: enabled is explicitly true → true", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: true } }
  });
  expect(result).toBe(true);
});

test("isEnabled: enabled is explicitly false → false", () => {
  const result = isEnabled("test-feature", {
    features: { "test-feature": { enabled: false } }
  });
  expect(result).toBe(false);
});

test("isEnabled: multiple features, one enabled false", () => {
  const config = {
    features: {
      "feature-a": { enabled: true },
      "feature-b": { enabled: false },
      "feature-c": { enabled: true }
    }
  };
  expect(isEnabled("feature-a", config)).toBe(true);
  expect(isEnabled("feature-b", config)).toBe(false);
  expect(isEnabled("feature-c", config)).toBe(true);
  expect(isEnabled("feature-d", config)).toBe(true);
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
    expect(
      lines.some((line) => line.includes("[features] my-feature: enabled")),
      "Expected stderr diagnostic for enabled feature"
    ).toBeTruthy();
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
    expect(
      lines.some((line) => line.includes("[features] my-feature: disabled")),
      "Expected stderr diagnostic for disabled feature"
    ).toBeTruthy();
  } finally {
    process.stderr.write = originalWrite;
  }
});

// readCrewConfig tests

test("readCrewConfig: missing file → {}", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crew-config-"));
  try {
    const result = await readCrewConfig(tmpDir);
    expect(result).toEqual({});
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
    expect(result).toEqual(testConfig);
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
    expect(result).toEqual({});
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
    expect(result).toEqual({});
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
    expect(result).toEqual(testConfig);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// registry-default tests

test("isEnabled: unknown feature not in registry → defaults to true", () => {
  const result = isEnabled("test-feature", { features: {} });
  expect(result).toBe(true);
});

test("isEnabled: push-verify not in config → defaults to false (registry default)", () => {
  const result = isEnabled("push-verify", { features: {} });
  expect(result).toBe(false);
});

test("isEnabled: push-verify explicitly enabled in config → true", () => {
  const result = isEnabled("push-verify", {
    features: { "push-verify": { enabled: true } }
  });
  expect(result).toBe(true);
});

test("isEnabled: push-verify no config at all → defaults to false (registry default)", () => {
  const result = isEnabled("push-verify", null);
  expect(result).toBe(false);
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
    expect(meta, `expected ${name} to be registered in FEATURES`).toBeTruthy();
    expect(meta!.default, `${name}.default`).toBe(expectation.default);
    expect(meta!.scope, `${name}.scope`).toBe(expectation.scope);
    expect(typeof meta!.version, `${name}.version`).toBe("string");
    expect(typeof meta!.description, `${name}.description`).toBe("string");
    expect(typeof meta!.since, `${name}.since`).toBe("string");
  }

  // Also present in the raw FEATURES record (not just via getFeatureMeta).
  for (const name of Object.keys(expected)) {
    expect(name in FEATURES, `expected ${name} key in FEATURES record`).toBeTruthy();
  }
});

test("isEnabled: git-gate-block defaults to false (warn) with no config", () => {
  expect(isEnabled("git-gate-block", null)).toBe(false);
  expect(isEnabled("git-gate-block", { features: {} })).toBe(false);
});

test("isEnabled: git-gate-block explicitly enabled in config → true", () => {
  const result = isEnabled("git-gate-block", {
    features: { "git-gate-block": { enabled: true } }
  });
  expect(result).toBe(true);
});

test("isEnabled: otel-telemetry / bash-gate-telemetry / task-update-burst-warn / event-emit default to true with no config", () => {
  for (const name of [
    "otel-telemetry",
    "bash-gate-telemetry",
    "task-update-burst-warn",
    "event-emit"
  ]) {
    expect(isEnabled(name, null), `${name} should default true`).toBe(true);
    expect(isEnabled(name, { features: {} }), `${name} should default true`).toBe(true);
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
    expect(isEnabled(name, config), `${name} should flip to false when disabled`).toBe(false);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// scripts/lib/telemetry/feature-flag-lite.ts parity — the otel hooks read
// this dependency-free copy (not the full registry) so they survive the
// plugin-cache smoke test's narrower static-import tree. It must not drift
// from the registry default it duplicates.
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// FEAT-194 S1 — model-routing toggle (mirrors redundant-read-stop /
// subagent-inline-warn / shell-preflight). Gates the `crew resolve-model`
// CLI, not a hook — default-on since routing is now the desired baseline.
// ──────────────────────────────────────────────────────────────────────────

test("registry: model-routing is present, default true, scope crew", () => {
  const meta = getFeatureMeta("model-routing");
  expect(meta, "expected model-routing to be registered in FEATURES").toBeTruthy();
  expect(meta!.default).toBe(true);
  expect(meta!.scope).toBe("crew");
  expect(typeof meta!.version).toBe("string");
  expect(typeof meta!.description).toBe("string");
  expect(typeof meta!.since).toBe("string");
  expect("model-routing" in FEATURES).toBeTruthy();
});

test("isEnabled: model-routing defaults to true with no config", () => {
  expect(isEnabled("model-routing", null)).toBe(true);
  expect(isEnabled("model-routing", { features: {} })).toBe(true);
});

test("isEnabled: model-routing flips off via crew.json override", () => {
  const result = isEnabled("model-routing", {
    features: { "model-routing": { enabled: false } }
  });
  expect(result).toBe(false);
});

test("feature-flag-lite: HOOK_FLAG_DEFAULTS matches the registry default for every flag it duplicates", () => {
  for (const [name, liteDefault] of Object.entries(HOOK_FLAG_DEFAULTS)) {
    const registryMeta = getFeatureMeta(name);
    expect(
      registryMeta,
      `${name} in HOOK_FLAG_DEFAULTS must also be registered in FEATURES`
    ).toBeTruthy();
    expect(
      liteDefault,
      `feature-flag-lite default for ${name} (${liteDefault}) must match registry default (${registryMeta!.default})`
    ).toBe(registryMeta!.default);
  }
});
