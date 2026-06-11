import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyBashGate, startGateTimer, endGateTimer } from "../scripts/lib/bash-gate-timer.ts";

test("classifyBashGate returns correct gate for bun run typecheck", () => {
  assert.equal(classifyBashGate("bun run typecheck"), "typecheck");
});

test("classifyBashGate returns correct gate for bun run lint", () => {
  assert.equal(classifyBashGate("bun run lint"), "lint");
});

test("classifyBashGate returns correct gate for bun run format:check", () => {
  assert.equal(classifyBashGate("bun run format:check"), "format:check");
});

test("classifyBashGate returns correct gate for bun audit", () => {
  assert.equal(classifyBashGate("bun audit"), "audit");
});

test("classifyBashGate returns correct gate for bun run validate:all", () => {
  assert.equal(classifyBashGate("bun run validate:all"), "validate:all");
});

test("classifyBashGate returns test for bun test", () => {
  assert.equal(classifyBashGate("bun test"), "test");
});

test("classifyBashGate returns test for bun run test", () => {
  assert.equal(classifyBashGate("bun run test"), "test");
});

test("classifyBashGate returns npm-ci for npm ci", () => {
  assert.equal(classifyBashGate("npm ci"), "npm-ci");
});

test("classifyBashGate returns null for ls -la", () => {
  assert.equal(classifyBashGate("ls -la"), null);
});

test("classifyBashGate returns null for bun run test:node (Node fallback — must not contaminate test bucket)", () => {
  assert.equal(classifyBashGate("bun run test:node"), null);
});

test("classifyBashGate returns null for bun audit-fix (colon-suffixed variant)", () => {
  assert.equal(classifyBashGate("bun audit-fix"), null);
});

test("classifyBashGate returns null for bun run typecheck:strict (colon-suffixed variant)", () => {
  assert.equal(classifyBashGate("bun run typecheck:strict"), null);
});

test("classifyBashGate returns test for bun run test (regression — still classifies correctly)", () => {
  assert.equal(classifyBashGate("bun run test"), "test");
});

test("classifyBashGate returns audit for bun audit (regression — still classifies correctly)", () => {
  assert.equal(classifyBashGate("bun audit"), "audit");
});

test("startGateTimer returns null for unknown command", () => {
  assert.equal(startGateTimer("ls -la"), null);
});

test("end-to-end: startGateTimer + endGateTimer writes JSONL row with correct fields", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bash-gate-timer-"));
  const logPath = path.join(tmp, "bash-gates.jsonl");
  process.env["CREW_BASH_GATE_LOG"] = logPath;
  try {
    const handle = startGateTimer("bun run lint");
    assert.ok(handle !== null, "startGateTimer should return a handle for known command");
    // Sleep 15ms
    await new Promise<void>((r) => setTimeout(r, 15));
    endGateTimer(handle, 0);
    // Allow fire-and-forget append to flush
    await new Promise<void>((r) => setTimeout(r, 50));
    const raw = await fs.readFile(logPath, "utf-8");
    const row = JSON.parse(raw.trim()) as Record<string, unknown>;
    assert.equal(row["gate"], "lint");
    assert.equal(row["exitCode"], 0);
    assert.ok(
      typeof row["durationMs"] === "number" && row["durationMs"] >= 10,
      `durationMs ${row["durationMs"]} below floor`
    );
  } finally {
    delete process.env["CREW_BASH_GATE_LOG"];
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
