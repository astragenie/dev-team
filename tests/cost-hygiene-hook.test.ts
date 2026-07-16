// tests/cost-hygiene-hook.test.mjs
import { test, expect } from "bun:test";
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
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const out = await runCheckRedundantReadHook(stdin);
  return { exitCode: 0, stdout: out ?? "", stderr: "" };
}

/**
 * Spawn-based smoke runner: validates stdin/stdout wiring.
 */
function runHookSpawn(
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], {
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

test("hook exits 0 silently on missing file (default-on)", async () => {
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
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  } finally {
    await cleanup(repo);
  }
});

test("hook fires and writes state (default-on)", async () => {
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
    );
    expect(result.exitCode).toBe(0);
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s_default.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    expect(state.entries[file].read_count).toBe(1);
  } finally {
    await cleanup(repo);
  }
});

test("hook with first-read stdin emits empty stdout, writes state", async () => {
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
      })
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s2.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    expect(state.entries[file].read_count).toBe(1);
  } finally {
    await cleanup(repo);
  }
});

// SMOKE: Hook runtime contract with warning path (verifies stdin→stdout payload wiring)
test("smoke: hook with reread stdin emits decision + systemMessage with content", async () => {
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
    await runHookSpawn(stdin);

    // Simulate PostToolUse capturing the content — write it directly to the state file.
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s3.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    state.entries[file].content = "snowflake";
    state.entries[file].content_bytes = 9;
    state.total_bytes = 9;
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");

    // Second read attempt → should warn
    const result = await runHookSpawn(stdin);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.systemMessage).toMatch(/<system-reminder>/);
    expect(parsed.systemMessage).toMatch(/snowflake/);
  } finally {
    await cleanup(repo);
  }
});

test("hook with malformed stdin exits 0 silently", async () => {
  const result = await runHook("not json at all");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

const POST_HOOK_PATH = path.join(__dirname, "..", "hooks", "record-read-content.ts");

function runPostHook(stdin: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", POST_HOOK_PATH], {
      env: { ...process.env }
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
    await runHook(preStdin);

    const postStdin = JSON.stringify({
      session_id: "s4",
      tool_name: "Read",
      tool_input: { file_path: file },
      tool_response: { content: "wisp" },
      cwd: repo
    });
    const result = await runPostHook(postStdin);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    const state = JSON.parse(
      await fs.readFile(path.join(repo, ".claude", "state", "cost-hygiene", "s4.json"), "utf8")
    );
    expect(state.entries[file].content).toBe("wisp");
  } finally {
    await cleanup(repo);
  }
});

test("post-hook fires by default and writes state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "post-default.txt");
    await fs.writeFile(file, "bloom", "utf8");
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
    expect(result.exitCode).toBe(0);
    const state = JSON.parse(
      await fs.readFile(path.join(repo, ".claude", "state", "cost-hygiene", "s5.json"), "utf8")
    );
    expect(state.entries[file].content).toBe("bloom");
  } finally {
    await cleanup(repo);
  }
});
