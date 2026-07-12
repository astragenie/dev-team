// tests/check-builder-terminal-state.test.ts
// Wave 3 Guard 1 (dev-team#187 #174) — SubagentStop guard for builder-tier
// agents. In-process, mkdtemp-repo shape mirrors
// tests/check-task-update-burst.test.ts; the runCheckXHook(raw) contract
// mirrors hooks/lib/check-reviewer-decision.ts's runCheckReviewerDecisionHook
// (dev-team#199 precedent this guard generalizes to builder tier).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckBuilderTerminalStateHook } from "../hooks/lib/check-builder-terminal-state.ts";

async function makeRepo(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "builder-terminal-state-test-"));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

function payload(opts: {
  session_id?: string;
  cwd: string;
  agent_name?: string | null;
  last_assistant_message?: string | null;
  stop_hook_active?: boolean;
}): string {
  const obj: Record<string, unknown> = {
    session_id: opts.session_id ?? "sess-1",
    cwd: opts.cwd
  };
  if (opts.agent_name !== undefined && opts.agent_name !== null) obj.agent_name = opts.agent_name;
  if (opts.last_assistant_message !== undefined && opts.last_assistant_message !== null) {
    obj.last_assistant_message = opts.last_assistant_message;
  }
  if (opts.stop_hook_active !== undefined) obj.stop_hook_active = opts.stop_hook_active;
  return JSON.stringify(obj);
}

async function readEvents(repo: string): Promise<Record<string, unknown>[]> {
  const file = path.join(repo, ".claude", "logs", "events.jsonl");
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}

// (a) builder-tier + no marker + no artifact → block
test("builder-tier stop with no STATUS marker and no artifact path → block", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "Now let's open the PR."
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.ok(out !== null);
    const parsed = JSON.parse(out as string);
    assert.equal(parsed.decision, "block");
    assert.match(parsed.reason, /STATUS/);
  } finally {
    await cleanup(repo);
  }
});

// (b) builder-tier + BLOCKED: line → pass (AC2 guardrail — must NOT block)
test("builder-tier stop with a BLOCKED: line → pass (blocked is itself a valid terminal state)", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:backend-dev",
      last_assistant_message: "BLOCKED: waiting on external API credentials."
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

// (c) artifact path only (no STATUS line) → pass
test("builder-tier stop with only an artifact path (no STATUS line) → pass", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:frontend-dev",
      last_assistant_message:
        "Wrote the handoff: .claude/artifacts/crew/handoffs/20260712T000000Z-handoff-slice.md"
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

// (d) non-builder-tier → pass, untouched
test("non-builder-tier agent (reviewer) → pass, untouched (scope check only)", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:reviewer",
      last_assistant_message: "Now let's open the PR."
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

// (e) stop_hook_active: true → pass regardless (one-retry re-entry guard)
test("stop_hook_active true → pass regardless of content", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "Now let's open the PR.",
      stop_hook_active: true
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

// (f) malformed / missing last_assistant_message → pass + logged, never guess
test("malformed JSON → pass, no throw", async () => {
  const out = await runCheckBuilderTerminalStateHook("not json");
  assert.equal(out, null);
});

test("missing agent_name → pass (fail-open, untyped payload)", async () => {
  const repo = await makeRepo();
  try {
    const raw = JSON.stringify({ session_id: "s1", cwd: repo });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

test("missing last_assistant_message → pass + logged, never guess", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({ cwd: repo, agent_name: "crew:fullstack-dev" });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
    const events = await readEvents(repo);
    assert.ok(
      events.some(
        (e) =>
          typeof e.event === "string" &&
          e.event.includes("builder-terminal-state-guard") &&
          e.event.includes("no-message")
      )
    );
  } finally {
    await cleanup(repo);
  }
});

// (g) feature flag disabled → pass unconditionally, via shared isEnabled helper
test("builder-terminal-state-guard feature disabled → pass unconditionally", async () => {
  const repo = await makeRepo();
  try {
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "builder-terminal-state-guard": { enabled: false } } }),
      "utf8"
    );
    const raw = payload({
      cwd: repo,
      agent_name: "crew:fullstack-dev",
      last_assistant_message: "Now let's open the PR."
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});

test("missing crew.json → builder-terminal-state-guard defaults enabled, still blocks", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:dev-lite",
      last_assistant_message: "Done editing."
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.ok(out !== null);
    const parsed = JSON.parse(out as string);
    assert.equal(parsed.decision, "block");
  } finally {
    await cleanup(repo);
  }
});

// DONE: line also passes (positive control alongside the BLOCKED guardrail case)
test("builder-tier stop with a DONE: line → pass", async () => {
  const repo = await makeRepo();
  try {
    const raw = payload({
      cwd: repo,
      agent_name: "crew:aiplugin-dev",
      last_assistant_message: "DONE: shipped the guard.\nFiles: hooks/foo.ts"
    });
    const out = await runCheckBuilderTerminalStateHook(raw);
    assert.equal(out, null);
  } finally {
    await cleanup(repo);
  }
});
