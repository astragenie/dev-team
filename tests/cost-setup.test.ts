import { test, expect } from "bun:test";
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
  expect(parseFeatureOverrides(null)).toEqual([]);
  expect(parseFeatureOverrides("")).toEqual([]);
  expect(parseFeatureOverrides(undefined)).toEqual([]);
});

test("parseFeatureOverrides: parses on|off|true|false|1|0", () => {
  const out = parseFeatureOverrides("cost-hygiene=on,shell-preflight=off,subagent-inline-warn=1");
  expect(out).toEqual([
    { feature: "cost-hygiene", enabled: true },
    { feature: "shell-preflight", enabled: false },
    { feature: "subagent-inline-warn", enabled: true }
  ]);
});

test("parseFeatureOverrides: unknown feature throws", () => {
  expect(() => parseFeatureOverrides("not-a-real-feature=on")).toThrow(/Unknown feature/);
});

test("parseFeatureOverrides: invalid value throws", () => {
  expect(() => parseFeatureOverrides("cost-hygiene=maybe")).toThrow(/Invalid value/);
});

test("parseFeatureOverrides: missing = throws", () => {
  expect(() => parseFeatureOverrides("cost-hygiene")).toThrow(/Expected NAME=on\|off/);
});

test("runCostSetup: writes default features block on empty repo", async () => {
  const repo = await makeRepo();
  try {
    const result = await runCostSetup(repo);
    expect(result.written).toBe(true);
    const config = await readCrewConfigOrEmpty(repo);
    expect(config.features).toBeTruthy();
    for (const name of Object.keys(FEATURES)) {
      expect(config.features![name]?.enabled, `${name} should match registry default`).toBe(
        FEATURES[name as keyof typeof FEATURES]!.default
      );
    }
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: idempotent — second call writes nothing", async () => {
  const repo = await makeRepo();
  try {
    const first = await runCostSetup(repo);
    expect(first.written).toBe(true);
    const second = await runCostSetup(repo);
    expect(second.written, "second call should detect no change").toBe(false);
  } finally {
    await cleanup(repo);
  }
});

test("runCostSetup: overrides flip a feature off", async () => {
  const repo = await makeRepo();
  try {
    const result = await runCostSetup(repo, [{ feature: "cost-hygiene", enabled: false }]);
    expect(result.written).toBe(true);
    const config = await readCrewConfigOrEmpty(repo);
    expect(config.features!["cost-hygiene"]!.enabled).toBe(false);
    expect(config.features!["shell-preflight"]!.enabled).toBe(true);
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
    expect((config as Record<string, unknown>).customKey).toBe("preserved");
    expect((config as Record<string, unknown>).nested).toEqual({ foo: 1 });
    expect(config.features).toBeTruthy();
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
    expect(config.features!["cost-hygiene"]!.enabled, "user's off should stick").toBe(false);
    expect(config.features!["shell-preflight"]!.enabled, "missing entries get defaults").toBe(true);
    expect(result.written, "missing default entries triggered a write").toBe(true);
  } finally {
    await cleanup(repo);
  }
});
