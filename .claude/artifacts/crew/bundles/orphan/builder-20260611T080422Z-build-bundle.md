---
slice: unknown
builder: builder
run_id: 20260611T080422Z
feat: FEAT-150
files_touched: ["hooks/hooks.json", "hooks/lib/bash-gate-timer-tap.ts", "hooks/post-tool-use-bash-gate.ts", "hooks/pre-tool-use-bash-gate.ts", "scripts/lib/bash-gate-timer.ts", "tests/bash-gate-timer.test.ts"]
files_read: []
diff_stat: { files: 0, additions: 0, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Task Handoff: FEAT-150: Bash gate timer + hook taps

- Created: 2026-06-11T08:04:22.527Z
- From: builder
- To: lead
- Objective: New bash-gate-timer lib + PreToolUse/PostToolUse Bash hook taps wire per-gate JSONL telemetry into the Phase 1 baseline pipeline
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - scripts/lib/bash-gate-timer.ts
  - tests/bash-gate-timer.test.ts
  - hooks/lib/bash-gate-timer-tap.ts
  - hooks/pre-tool-use-bash-gate.ts
  - hooks/post-tool-use-bash-gate.ts
  - hooks/hooks.json
- Confidence: high
- Risks: 1 pre-existing test failure out of scope (projects-root-override timeout). Hook taps are fire-and-forget additive; no behavior change to existing Bash gate execution.
- Suggested Next Handoff: -


## Diff

```diff

```

## Files touched

### hooks/hooks.json

```
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" session_start"
          }
        ]
      }
    ],
    "TaskCreated": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" task_created"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" task_completed"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" subagent_start"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" subagent_stop"
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh\" teammate_idle"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/check-redundant-read.ts\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/preflight-shell.ts\""
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use-bash-gate.ts\""
          }
        ]
      },
      {
        "matcher": "PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/preflight-shell.ts\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/record-read-content.ts\""
          }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/check-subagent-return.ts\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use-bash-gate.ts\""
          }
        ]
      }
    ]
  }
}

```

### hooks/lib/bash-gate-timer-tap.ts

```
// Core gate-timer tap for PreToolUse/PostToolUse Bash hooks (FEAT-150).
// No stdin/stdout/process.exit — the entry shims own process I/O.
import { type GateHandle, startGateTimer, endGateTimer } from "../../scripts/lib/bash-gate-timer.ts";

/** Bounded map of pending gate handles keyed by session+command identity. */
const _gateHandles = new Map<string, GateHandle>();

const MAX_HANDLES = 1000;

/**
 * Record a gate start from a PreToolUse Bash event.
 * Returns the correlation key used to look up the handle later.
 */
export function recordGateStart(sessionId: string, command: string): string | null {
  const handle = startGateTimer(command);
  if (handle === null) return null;
  // Key = sessionId + first 80 chars of command to avoid collision with concurrent calls.
  const key = `${sessionId}::${command.slice(0, 80)}`;
  if (_gateHandles.size >= MAX_HANDLES) {
    // FIFO eviction
    const oldestKey = _gateHandles.keys().next().value;
    if (oldestKey !== undefined) _gateHandles.delete(oldestKey);
  }
  _gateHandles.set(key, handle);
  return key;
}

/**
 * Record a gate end from a PostToolUse Bash event.
 * No-op if no matching start was recorded (unknown gate or evicted).
 */
export function recordGateEnd(sessionId: string, command: string, exitCode: number): void {
  const key = `${sessionId}::${command.slice(0, 80)}`;
  const handle = _gateHandles.get(key);
  if (handle === undefined) return;
  _gateHandles.delete(key);
  endGateTimer(handle, exitCode);
}

/** Parse PreToolUse Bash payload. */
export function parsePreInput(
  raw: string
): { sessionId: string; command: string } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["session_id"] === "string" &&
      typeof obj["tool_input"] === "object" &&
      obj["tool_input"] !== null &&
      typeof (obj["tool_input"] as Record<string, unknown>)["command"] === "string"
    ) {
      return {
        sessionId: obj["session_id"] as string,
        command: (obj["tool_input"] as Record<string, unknown>)["command"] as string
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse PostToolUse Bash payload. Extracts exit code from tool_response. */
export function parsePostInput(
  raw: string
): { sessionId: string; command: string; exitCode: number } | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof obj["session_id"] !== "string" ||
      typeof obj["tool_input"] !== "object" ||
      obj["tool_input"] === null ||
      typeof (obj["tool_input"] as Record<string, unknown>)["command"] !== "string"
    ) {
      return null;
    }
    const sessionId = obj["session_id"] as string;
    const command = (obj["tool_input"] as Record<string, unknown>)["command"] as string;
    // tool_response may carry exitCode directly or nested in an object
    let exitCode = 0;
    const resp = obj["tool_response"];
    if (typeof resp === "object" && resp !== null) {
      const ec = (resp as Record<string, unknown>)["exitCode"];
      if (typeof ec === "number") exitCode = ec;
    } else if (typeof resp === "number") {
      exitCode = resp;
    }
    return { sessionId, command, exitCode };
  } catch {
    return null;
  }
}

```

### hooks/post-tool-use-bash-gate.ts

```
#!/usr/bin/env node
// PostToolUse hook on Bash. Records gate end time and writes JSONL row (FEAT-150).
// Default-ON; opt out via CREW_BASH_GATE_LOG=0. Always exits 0 — never blocks.
import { parsePostInput, recordGateEnd } from "./lib/bash-gate-timer-tap.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env["CREW_BASH_GATE_LOG"] === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const input = parsePostInput(raw);
  if (input !== null) {
    recordGateEnd(input.sessionId, input.command, input.exitCode);
  }
  // PostToolUse: no output needed
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "post-tool-use-bash-gate", err);
  process.exit(0);
});

```

### hooks/pre-tool-use-bash-gate.ts

```
#!/usr/bin/env node
// PreToolUse hook on Bash. Records gate start time for known gate commands (FEAT-150).
// Default-ON; opt out via CREW_BASH_GATE_LOG=0. Always exits 0 — never blocks.
import { parsePreInput, recordGateStart } from "./lib/bash-gate-timer-tap.ts";
import { logHookError } from "./hook-error.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.env["CREW_BASH_GATE_LOG"] === "0") {
    process.stdin.resume();
    return;
  }
  const raw = await readStdin();
  const input = parsePreInput(raw);
  if (input !== null) {
    recordGateStart(input.sessionId, input.command);
  }
  // PreToolUse: no output = allow (pass through)
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-bash-gate", err);
  process.exit(0);
});

```

### scripts/lib/bash-gate-timer.ts

```
// Bash gate timer helper for per-gate wall-clock telemetry (FEAT-150).
// Phase 1 of slice perf 2-3x spec. Pure additive — no behavior change to existing code.
import fs from "node:fs/promises";
import path from "node:path";

const PATTERNS: Array<[RegExp, string]> = [
  [/\bbun (?:run )?lint\b/, "lint"],
  [/\bbun (?:run )?format:check\b/, "format:check"],
  [/\bbun (?:run )?typecheck\b/, "typecheck"],
  [/\bbun (?:run )?test\b/, "test"],
  [/\bbun audit\b/, "audit"],
  [/\bbun (?:run )?validate:all\b/, "validate:all"],
  [/\bnpm ci\b/, "npm-ci"]
];

export function classifyBashGate(cmd: string): string | null {
  for (const [re, gate] of PATTERNS) if (re.test(cmd)) return gate;
  return null;
}

export type GateHandle = { gate: string; startMs: number };

export function startGateTimer(cmd: string): GateHandle | null {
  const gate = classifyBashGate(cmd);
  if (gate === null) return null;
  return { gate, startMs: Date.now() };
}

export function endGateTimer(handle: GateHandle, exitCode: number): void {
  const row = { gate: handle.gate, durationMs: Date.now() - handle.startMs, exitCode };
  const logPath =
    process.env["CREW_BASH_GATE_LOG"] ??
    path.join(
      process.env["CLAUDE_PLUGIN_ROOT"] ?? process.cwd(),
      ".claude",
      "logs",
      "bash-gates.jsonl"
    );
  void fs
    .mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}

```

### tests/bash-gate-timer.test.ts

```
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
      typeof row["durationMs"] === "number" && row["durationMs"] >= 15,
      `Expected durationMs >= 15, got ${String(row["durationMs"])}`
    );
  } finally {
    delete process.env["CREW_BASH_GATE_LOG"];
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

```

## Files read

