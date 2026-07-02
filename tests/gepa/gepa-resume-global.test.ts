/**
 * tests/gepa/gepa-resume-global.test.ts — SLICE-106 regression guard
 *
 * Covers the inspector [MEDIUM] finding on PR #148: `runGepaResumeCmdExtended`
 * with no agent argument enters the "global optimize.paused clear" branch,
 * which had no test coverage.
 *
 * Two cases:
 *   1. Config exists with `optimize.paused: true` → clears to false, exits 0.
 *   2. Config absent → exits 1 with informative stderr.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGepaResumeCmdExtended } from "../../scripts/lib/gepa/gepa-killswitch-cmds.ts";

let tmpDir: string;

function writeConfig(config: Record<string, unknown>): void {
  writeFileSync(join(tmpDir, "gepa.config.json"), JSON.stringify(config, null, 2) + "\n", "utf8");
}

function readConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(tmpDir, "gepa.config.json"), "utf8")) as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gepa-resume-global-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("gepa-resume — global-pause path (no agent)", () => {
  it("clears optimize.paused to false when config exists with paused: true", async () => {
    writeConfig({ optimize: { paused: true, other_key: "keep-me" }, unrelated: "field" });

    const result = await runGepaResumeCmdExtended(tmpDir, []);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("global optimize.paused cleared");
    expect(result.stdout).toContain("was: true");

    const cfg = readConfig();
    const optimize = cfg.optimize as Record<string, unknown>;
    expect(optimize.paused).toBe(false);
    // Sibling keys preserved.
    expect(optimize.other_key).toBe("keep-me");
    expect(cfg.unrelated).toBe("field");
  });

  it("still exits 0 when config exists with paused: false (idempotent)", async () => {
    writeConfig({ optimize: { paused: false } });

    const result = await runGepaResumeCmdExtended(tmpDir, []);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("was: false");
    const cfg = readConfig();
    const optimize = cfg.optimize as Record<string, unknown>;
    expect(optimize.paused).toBe(false);
  });

  it("exits 1 with informative stderr when gepa.config.json is absent", async () => {
    // Do NOT write config.
    expect(existsSync(join(tmpDir, "gepa.config.json"))).toBe(false);

    const result = await runGepaResumeCmdExtended(tmpDir, []);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("gepa.config.json not found");
    expect(result.stderr).toContain("cannot clear global pause");
  });

  it("exits 1 when gepa.config.json is malformed", async () => {
    writeFileSync(join(tmpDir, "gepa.config.json"), "{ not valid json", "utf8");

    const result = await runGepaResumeCmdExtended(tmpDir, []);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("failed to parse gepa.config.json");
  });
});
