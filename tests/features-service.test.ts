import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isEnabled, readCrewConfig } from "../scripts/lib/features-service.ts";

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
