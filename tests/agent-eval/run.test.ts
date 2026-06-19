/**
 * Default `bun run test` skips this file (CREW_AGENT_EVAL unset).
 * Run via `bun run test:agents` or `CREW_AGENT_EVAL=1 bun test tests/agent-eval/`.
 * The always-on block provides helper coverage without burning subscription quota.
 */
import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactContains,
  dispatchedAgent,
  findArtifact,
  hasToolCall,
  toolCallsOf
} from "./lib/assert-trace.ts";
import { runClaude } from "./lib/run-claude.ts";
import type { CapturedTrace } from "./lib/types.ts";
import dryRunFixture from "./fixtures/00-dry-run-replay.fixture.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACE_PATH = path.join(
  __dirname,
  "fixtures",
  "captured-traces",
  "00-builder-handoff.trace.json"
);

/** Maps a fixture name to its captured-traces file path (SLICE-A convention). */
function capturedTracePath(fixtureName: string): string {
  const mapping: Record<string, string> = {
    "00-dry-run-replay": path.join(
      __dirname,
      "fixtures",
      "captured-traces",
      "00-builder-handoff.trace.json"
    )
  };
  const p = mapping[fixtureName];
  if (!p) throw new Error(`No captured trace registered for fixture: ${fixtureName}`);
  return p;
}

const EVAL_ENABLED = process.env.CREW_AGENT_EVAL === "1";

// Load at module level (top-level await — Bun supports it in ESM).
const _raw = await fs.readFile(TRACE_PATH, "utf8");
const baseTrace = JSON.parse(_raw) as CapturedTrace;

// ---------------------------------------------------------------------------
// Always-on: assert-trace helpers (run on every bun run test)
// ---------------------------------------------------------------------------

describe("assert-trace helpers (always-on)", () => {
  const trace = baseTrace;

  test("toolCallsOf happy path — returns matching events", () => {
    const calls = toolCallsOf(trace, "Bash");
    expect(calls.length).toBe(1);
    expect(calls[0]?.input.command).toBe("bun run test --parallel");
  });

  test("toolCallsOf empty path — returns empty array, never undefined", () => {
    const calls = toolCallsOf(trace, "NoSuchTool");
    expect(calls.length).toBe(0);
    expect(Array.isArray(calls)).toBe(true);
  });

  test("hasToolCall fuzzy regex match — matcher participates in result", () => {
    expect(
      hasToolCall(trace, "Bash", (inp) => /bun (run )?test/.test(String(inp.command ?? "")))
    ).toBe(true);
    expect(hasToolCall(trace, "Bash", (inp) => /npm test/.test(String(inp.command ?? "")))).toBe(
      false
    );
  });

  test("dispatchedAgent regex match — finds crew:builder, not crew:reviewer", () => {
    expect(dispatchedAgent(trace, /^crew:builder/)?.input.subagent_type).toBe("crew:builder");
    expect(dispatchedAgent(trace, "crew:reviewer")).toBeNull();
  });

  test("findArtifact — returns Write event or null", () => {
    expect(findArtifact(trace, /SLICE-.*-builder\.md$/)?.name).toBe("Write");
    expect(findArtifact(trace, "nonexistent-path")).toBeNull();
  });

  test("artifactContains — path AND body matchers both participate", () => {
    expect(artifactContains(trace, /-builder\.md$/, /verdict:\s*PASS/i)).toBe(true);
    expect(artifactContains(trace, /-builder\.md$/, /verdict:\s*FAIL/i)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Always-on: runClaude stub assertion
// ---------------------------------------------------------------------------

describe("runClaude stub (always-on)", () => {
  test("runClaude throws with 'not implemented' and 'SLICE-B' in message", async () => {
    let caughtMessage = "";
    await runClaude({ prompt: "x", cwd: "/tmp" }).catch((e: unknown) => {
      caughtMessage = e instanceof Error ? e.message : String(e);
    });
    expect(caughtMessage).toMatch(/not implemented/);
    expect(caughtMessage).toMatch(/SLICE-B/);
  });
});

// ---------------------------------------------------------------------------
// Opt-in: live fixture loop (skipped unless CREW_AGENT_EVAL=1)
// ---------------------------------------------------------------------------

describe.skipIf(!EVAL_ENABLED)("agent-eval fixtures", () => {
  for (const fixture of [dryRunFixture]) {
    test(
      fixture.name,
      async () => {
        const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "agent-eval-"));
        try {
          await fixture.setup?.(cwd);
          // SLICE-A: fixture loads its own captured trace; trace arg unused.
          const tracePath = capturedTracePath(fixture.name);
          const raw = await fs.readFile(tracePath, "utf8");
          const trace = JSON.parse(raw) as CapturedTrace;
          await fixture.expect(trace);
        } finally {
          await fs.rm(cwd, { recursive: true, force: true });
        }
      },
      fixture.timeoutMs ?? 180_000
    );
  }
});
