// tests/cost-hygiene-hook.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { runCheckRedundantReadHook } from "../hooks/lib/check-redundant-read.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "check-redundant-read.ts");

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-hook-"));
}
async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * In-process hook runner: import core, call directly, return { exitCode: 0, stdout, stderr: "" }
 */
async function runHook(
  stdin: string,
  env: NodeJS.ProcessEnv = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const out = await runCheckRedundantReadHook(stdin, { ...process.env, ...env });
  return { exitCode: 0, stdout: out ?? "", stderr: "" };
}

/**
 * Spawn-based smoke runner: validates truly-unset env and stdin/stdout wiring.
 */
function runHookSpawn(
  stdin: string,
  env: NodeJS.ProcessEnv = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], {
      env: { ...process.env, ...env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

test("hook with no env-var exits 0 silently on missing file (default-on)", async () => {
  // Default-on: hook runs without CREW_COST_HYGIENE set; missing file → silent no-op.
  const repo = await makeRepo();
  try {
    const result = await runHook(
      JSON.stringify({
        session_id: "s1",
        tool_name: "Read",
        tool_input: { file_path: path.join(repo, "x.txt") },
        cwd: repo
      })
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("hook with no env-var fires and writes state (default-on)", async () => {
  // AC-1: hook fires without any env var set.
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "default-on.txt");
    await fs.writeFile(file, "content", "utf8");
    const result = await runHook(
      JSON.stringify({
        session_id: "s_default",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      })
      // no env override — default-on
    );
    assert.equal(result.exitCode, 0);
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s_default.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    assert.equal(state.entries[file].read_count, 1);
  } finally {
    await cleanup(repo);
  }
});

// SMOKE: Hook runtime contract with gated-off env (not mockable in-process)
test("smoke: hook with CREW_COST_HYGIENE=0 exits 0 silently (opt-out)", async () => {
  // AC-2: CREW_COST_HYGIENE=0 suppresses the hook.
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "opt-out.txt");
    await fs.writeFile(file, "content", "utf8");
    const result = await runHookSpawn(
      JSON.stringify({
        session_id: "s_optout",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      }),
      { CREW_COST_HYGIENE: "0" }
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    // State file must NOT have been written.
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s_optout.json");
    await assert.rejects(fs.readFile(stateFile, "utf8"));
  } finally {
    await cleanup(repo);
  }
});

test("hook with env-var on + first-read stdin emits empty stdout, writes state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "hello.txt");
    await fs.writeFile(file, "hi", "utf8");
    const result = await runHook(
      JSON.stringify({
        session_id: "s2",
        tool_name: "Read",
        tool_input: { file_path: file },
        cwd: repo
      }),
      { CREW_COST_HYGIENE: "1" }
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s2.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    assert.equal(state.entries[file].read_count, 1);
  } finally {
    await cleanup(repo);
  }
});

// SMOKE: Hook runtime contract with warning path (verifies stdin→stdout payload wiring)
test("smoke: hook with env-var on + reread stdin emits decision + systemMessage with content", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "ack.txt");
    await fs.writeFile(file, "snowflake", "utf8");
    const stdin = JSON.stringify({
      session_id: "s3",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    });
    await runHookSpawn(stdin, { CREW_COST_HYGIENE: "1" });

    // Simulate PostToolUse capturing the content — write it directly to the state file.
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s3.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    state.entries[file].content = "snowflake";
    state.entries[file].content_bytes = 9;
    state.total_bytes = 9;
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");

    // Second read attempt → should warn
    const result = await runHookSpawn(stdin, { CREW_COST_HYGIENE: "1" });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /<system-reminder>/);
    assert.match(parsed.systemMessage, /snowflake/);
  } finally {
    await cleanup(repo);
  }
});

test("hook with malformed stdin exits 0 silently", async () => {
  const result = await runHook("not json at all", { CREW_COST_HYGIENE: "1" });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

const POST_HOOK_PATH = path.join(__dirname, "..", "hooks", "record-read-content.ts");

/**
 * @param {string} stdin
 * @param {Record<string, string>} env
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runPostHook(
  stdin: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", POST_HOOK_PATH], {
      env: { ...process.env, ...env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

test("post-hook captures Read tool result content into state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "post.txt");
    await fs.writeFile(file, "wisp", "utf8");
    // Seed state with a first-read record (no content yet).
    const preStdin = JSON.stringify({
      session_id: "s4",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    });
    await runHook(preStdin, { CREW_COST_HYGIENE: "1" });

    const postStdin = JSON.stringify({
      session_id: "s4",
      tool_name: "Read",
      tool_input: { file_path: file },
      tool_response: { content: "wisp" },
      cwd: repo
    });
    const result = await runPostHook(postStdin, { CREW_COST_HYGIENE: "1" });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const state = JSON.parse(
      await fs.readFile(path.join(repo, ".claude", "state", "cost-hygiene", "s4.json"), "utf8")
    );
    assert.equal(state.entries[file].content, "wisp");
  } finally {
    await cleanup(repo);
  }
});

test("post-hook fires by default (no env var) and writes state (default-on)", async () => {
  // AC-1: post-hook fires without any env var set.
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "post-default.txt");
    await fs.writeFile(file, "bloom", "utf8");
    // Seed state via pre-hook (also default-on).
    const preStdin = JSON.stringify({
      session_id: "s5",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    });
    await runHook(preStdin);

    const postStdin = JSON.stringify({
      session_id: "s5",
      tool_name: "Read",
      tool_input: { file_path: file },
      tool_response: { content: "bloom" },
      cwd: repo
    });
    const result = await runPostHook(postStdin);
    assert.equal(result.exitCode, 0);
    const state = JSON.parse(
      await fs.readFile(path.join(repo, ".claude", "state", "cost-hygiene", "s5.json"), "utf8")
    );
    assert.equal(state.entries[file].content, "bloom");
  } finally {
    await cleanup(repo);
  }
});

test("post-hook with CREW_COST_HYGIENE=0 exits without writing state (opt-out)", async () => {
  // AC-2: CREW_COST_HYGIENE=0 suppresses the post-hook.
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "post-optout.txt");
    await fs.writeFile(file, "quiet", "utf8");
    const postStdin = JSON.stringify({
      session_id: "s6",
      tool_name: "Read",
      tool_input: { file_path: file },
      tool_response: { content: "quiet" },
      cwd: repo
    });
    const result = await runPostHook(postStdin, { CREW_COST_HYGIENE: "0" });
    assert.equal(result.exitCode, 0);
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s6.json");
    await assert.rejects(fs.readFile(stateFile, "utf8"));
  } finally {
    await cleanup(repo);
  }
});
