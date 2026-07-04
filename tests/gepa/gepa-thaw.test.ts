/**
 * tests/gepa/gepa-thaw.test.ts — SLICE-106
 *
 * Covers AC-7: gepa-thaw removes an agent from champion_frozen in
 * gepa.config.json via atomic tmp+rename write.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGepaThawCmd } from "../../scripts/lib/gepa/gepa-killswitch-cmds.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
  tmpDir = mkdtempSync(join(tmpdir(), "gepa-thaw-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("gepa-thaw — AC-7 basic thaw", () => {
  it("exits 2 with usage message when no agent provided", async () => {
    writeConfig({ champion_frozen: ["reviewer"] });
    const result = await runGepaThawCmd(tmpDir, []);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("usage:");
  });

  it("exits 1 when gepa.config.json does not exist", async () => {
    const result = await runGepaThawCmd(tmpDir, ["reviewer"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
  });

  it("exits 0 with no-op message when agent not in frozen list", async () => {
    writeConfig({ champion_frozen: ["architect"] });
    const result = await runGepaThawCmd(tmpDir, ["reviewer"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("nothing to do");
  });

  it("AC-7 core: removes reviewer from [reviewer, architect] → [architect]", async () => {
    writeConfig({ champion_frozen: ["reviewer", "architect"] });

    const result = await runGepaThawCmd(tmpDir, ["reviewer"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("removed reviewer");
    expect(result.stdout).toContain("reviewer");

    const config = readConfig();
    const frozen = config.champion_frozen as string[];
    expect(frozen).not.toContain("reviewer");
    expect(frozen).toContain("architect");
    expect(frozen).toHaveLength(1);
  });

  it("removes verifier from [reviewer, verifier, architect] → [reviewer, architect]", async () => {
    writeConfig({ champion_frozen: ["reviewer", "verifier", "architect"] });

    const result = await runGepaThawCmd(tmpDir, ["verifier"]);

    expect(result.exitCode).toBe(0);

    const config = readConfig();
    const frozen = config.champion_frozen as string[];
    expect(frozen).not.toContain("verifier");
    expect(frozen).toContain("reviewer");
    expect(frozen).toContain("architect");
    expect(frozen).toHaveLength(2);
  });

  it("removes single-element list: [reviewer] → []", async () => {
    writeConfig({ champion_frozen: ["reviewer"] });

    const result = await runGepaThawCmd(tmpDir, ["reviewer"]);

    expect(result.exitCode).toBe(0);

    const config = readConfig();
    const frozen = config.champion_frozen as string[];
    expect(frozen).toHaveLength(0);
  });

  it("preserves all other config keys", async () => {
    writeConfig({
      champion_frozen: ["reviewer"],
      optimize: { paused: false, k: 5 },
      policy: { eligible_agents: ["fullstack-dev"] }
    });

    await runGepaThawCmd(tmpDir, ["reviewer"]);

    const config = readConfig();
    expect((config.optimize as { k: number }).k).toBe(5);
    expect((config.policy as { eligible_agents: string[] }).eligible_agents).toContain(
      "fullstack-dev"
    );
  });

  it("atomic write: output file is valid JSON immediately after thaw", async () => {
    writeConfig({ champion_frozen: ["reviewer", "architect"] });

    await runGepaThawCmd(tmpDir, ["reviewer"]);

    // Read raw file and verify it's valid JSON.
    const raw = readFileSync(join(tmpDir, "gepa.config.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("emits gepa_thaw event to events.jsonl", async () => {
    const logsDir = join(tmpDir, ".claude", "logs");
    mkdirSync(logsDir, { recursive: true });
    writeConfig({ champion_frozen: ["reviewer"] });

    await runGepaThawCmd(tmpDir, ["reviewer"]);

    const eventsPath = join(logsDir, "events.jsonl");
    const raw = readFileSync(eventsPath, "utf8");
    const events = raw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const thawEvent = events.find((e: Record<string, unknown>) => e.event === "gepa_thaw");
    expect(thawEvent).toBeDefined();
    expect(thawEvent.agent).toBe("reviewer");
    expect(Array.isArray(thawEvent.champion_frozen_before)).toBe(true);
    expect(Array.isArray(thawEvent.champion_frozen_after)).toBe(true);
  });
});
