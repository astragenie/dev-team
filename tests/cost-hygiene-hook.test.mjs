// tests/cost-hygiene-hook.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "check-redundant-read.ts");

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-hook-"));
}
async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * @param {string} stdin
 * @param {Record<string, string>} env
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runHook(stdin, env = {}) {
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

test("hook with no env-var exits 0 silently (gate off)", async () => {
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

test("hook with env-var on + reread stdin emits decision + systemMessage with content", async () => {
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
    await runHook(stdin, { CREW_COST_HYGIENE: "1" });

    // Simulate PostToolUse capturing the content — write it directly to the state file.
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s3.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    state.entries[file].content = "snowflake";
    state.entries[file].content_bytes = 9;
    state.total_bytes = 9;
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");

    // Second read attempt → should warn
    const result = await runHook(stdin, { CREW_COST_HYGIENE: "1" });
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
function runPostHook(stdin, env = {}) {
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
