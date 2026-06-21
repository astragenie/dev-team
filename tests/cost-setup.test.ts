import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseFeatureOverrides,
  runCostSetup,
  readCrewConfigOrEmpty
} from "../scripts/lib/cost-setup.ts";
import { FEATURES } from "../scripts/lib/features-service.ts";

async function makeRepo(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-setup-test-"));
}
async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

test("parseFeatureOverrides: empty input returns empty array", () => {
  assert.deepEqual(parseFeatureOverrides(null), []);
  assert.deepEqual(parseFeatureOverrides(""), []);
  assert.deepEqual(parseFeatureOverrides(undefined), []);
});

test("parseFeatureOverrides: parses on|off|true|false|1|0", () => {
  const out = parseFeatureOverrides("cost-hygiene=on,shell-preflight=off,subagent-inline-warn=1");
  assert.deepEqual(out, [
    { feature: "cost-hygiene", enabled: true },
    { feature: "shell-preflight", enabled: false },
    { feature: "subagent-inline-warn", enabled: true }
  ]);
});

test("parseFeatureOverrides: unknown feature throws", () => {
  assert.throws(
    () => parseFeatureOverrides("not-a-real-feature=on"),
    /Unknown feature/
  );
});

test("parseFeatureOverrides: invalid value throws", () => {
  assert.throws(
    () => parseFeatureOverrides("cost-hygiene=maybe"),
    /Invalid value/
  );
});

test("parseFeatureOverrides: missing = throws", () => {
  assert.throws(() => parseFeatureOverrides("cost-hygiene"), /Expected NAME=on\|off/);
});

test("runCostSetup: writes default features block on empty repo", async () => {
  const repo = await makeRepo();
  try {
    const result = await runCostSetup(repo);
    assert.equal(result.written, true);
    const config = await readCrewConfigOrEmpty(repo);
    assert.ok(config.features);
    for (const name of Object.keys(FEATURES)) {
      assert.equal(config.features![name]?.enabled, FEATURES[name as keyof typeof FEATURES]!.default,
        `${name} should match registry default`);
    }
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: idempotent — second call writes nothing", async () => {
  const repo = await makeRepo();
  try {
    const first = await runCostSetup(repo);
    assert.equal(first.written, true);
    const second = await runCostSetup(repo);
    assert.equal(second.written, false, "second call should detect no change");
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: overrides flip a feature off", async () => {
  const repo = await makeRepo();
  try {
    const result = await runCostSetup(repo, [{ feature: "cost-hygiene", enabled: false }]);
    assert.equal(result.written, true);
    const config = await readCrewConfigOrEmpty(repo);
    assert.equal(config.features!["cost-hygiene"]!.enabled, false);
    assert.equal(config.features!["shell-preflight"]!.enabled, true);
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: preserves user-set fields outside features", async () => {
  const repo = await makeRepo();
  try {
    await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(repo, ".claude", "crew.json"),
      JSON.stringify({ customKey: "preserved", nested: { foo: 1 } }),
      "utf8"
    );
    await runCostSetup(repo);
    const config = await readCrewConfigOrEmpty(repo);
    assert.equal((config as Record<string, unknown>).customKey, "preserved");
    assert.deepEqual((config as Record<string, unknown>).nested, { foo: 1 });
    assert.ok(config.features);
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: existing feature override is preserved when not in overrides arg", async () => {
  const repo = await makeRepo();
  try {
    await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(repo, ".claude", "crew.json"),
      JSON.stringify({
        features: { "cost-hygiene": { enabled: false } }
      }),
      "utf8"
    );
    const result = await runCostSetup(repo);
    const config = await readCrewConfigOrEmpty(repo);
    assert.equal(config.features!["cost-hygiene"]!.enabled, false, "user's off should stick");
    assert.equal(config.features!["shell-preflight"]!.enabled, true, "missing entries get defaults");
    assert.equal(result.written, true, "missing default entries triggered a write");
  } finally {
    await cleanup(repo);
  }
});
