---
slice: unknown
builder: builder
run_id: 20260611T075023Z
feat: FEAT-149
files_touched: ["hooks/lib/check-subagent-return.ts", "scripts/lib/dispatch-timing.ts", "tests/dispatch-timing.test.ts"]
files_read: []
diff_stat: { files: 0, additions: 0, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Task Handoff: FEAT-149: dispatch-timing JSONL writer + hook tap

- Created: 2026-06-11T07:50:23.369Z
- From: builder
- To: lead
- Objective: Pure-additive Phase 1 telemetry: recordDispatchStart/recordDispatchEnd JSONL writer + guarded tap site in check-subagent-return hook
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - scripts/lib/dispatch-timing.ts
  - tests/dispatch-timing.test.ts
  - hooks/lib/check-subagent-return.ts
- Confidence: high
- Risks: 2 pre-existing test timeouts (projects-root-override, validate-contracts) unrelated to this change — confirmed on base branch before stash pop
- Suggested Next Handoff: -


## Diff

```diff

```

## Files touched

### hooks/lib/check-subagent-return.ts

```
// Core flow for the check-subagent-return hook. No stdin/stdout/process.exit — the
// hooks/check-subagent-return.ts shim owns process I/O.
import fs from "node:fs/promises";
import path from "node:path";
import { parseThreshold, checkSubagentReturn } from "../../scripts/lib/subagent-return/check.ts";
import { isEnabled, readCrewConfig } from "../../scripts/lib/features-service.ts";
// TELEMETRY: dispatch-timing tap (FEAT-149)
import {
  type DispatchHandle,
  recordDispatchEnd,
} from "../../scripts/lib/dispatch-timing.ts";

/** Module-level map for start↔end correlation once upstream start sites are wired. */
const _dispatchHandles = new Map<string, DispatchHandle>();

/** Register a dispatch start handle for later end correlation (called by upstream start sites). */
export function registerDispatchHandle(taskId: string, handle: DispatchHandle): void {
  _dispatchHandles.set(taskId, handle);
}

function hasHandle(taskId: string): boolean {
  return _dispatchHandles.has(taskId);
}

async function logEvent(repoPath: string, code: string, sessionId: string, detail: string): Promise<void> {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `subagent-return:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

function extractBody(toolResponse: unknown): string | null {
  if (toolResponse === null || toolResponse === undefined) {
    return null;
  }
  if (typeof toolResponse === "string") {
    return toolResponse.length > 0 ? toolResponse : null;
  }
  if (typeof toolResponse === "object") {
    const obj = toolResponse as Record<string, unknown>;
    if (typeof obj["content"] === "string") {
      return obj["content"].length > 0 ? obj["content"] : null;
    }
    if (typeof obj["body"] === "string") {
      return obj["body"].length > 0 ? obj["body"] : null;
    }
  }
  return null;
}

function parseInput(raw: string): { session_id: string; cwd: string; tool_name: string; body: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_name === "string"
    ) {
      const body = extractBody(obj.tool_response);
      if (body === null) {
        return null;
      }
      return {
        session_id: obj.session_id,
        cwd: obj.cwd,
        tool_name: obj.tool_name,
        body
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function runCheckSubagentReturnHook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") return null;
  const input = parseInput(raw);
  if (input === null) return null;
  const { session_id, cwd, body } = input;
  const config = await readCrewConfig(cwd);
  if (!isEnabled("subagent-inline-warn", config)) return null;
  const threshold = parseThreshold(env.CREW_SUBAGENT_INLINE_THRESHOLD);
  const { warnings } = checkSubagentReturn({ body, threshold });

  // TELEMETRY: dispatch-timing tap (FEAT-149)
  // Fire-and-forget end recording when a correlated start handle exists.
  // No start sites are wired yet — this guard ensures no-op until they are.
  if (env.CREW_DISPATCH_TIMING_LOG !== undefined || hasHandle(session_id)) {
    const handle = _dispatchHandles.get(session_id);
    if (handle !== undefined) {
      _dispatchHandles.delete(session_id);
      recordDispatchEnd(handle, {
        toolCalls: {},
        bashDurationMs: 0,
        skillLoadCount: 0,
        tokenIn: 0,
        tokenOut: 0,
      });
    }
  }

  if (warnings.length > 0) {
    await logEvent(cwd, "inline-return-warn", session_id, warnings[0] ?? "");
    return JSON.stringify({ decision: "approve", systemMessage: warnings.join("\n") });
  }
  return null;
}

```

### scripts/lib/dispatch-timing.ts

```
// Dispatch-timing JSONL writer for per-subagent-dispatch wall-clock telemetry (FEAT-149).
// Phase 1 of slice perf 2-3x spec. Pure additive — no behavior change to existing code.
import { promises as fs } from "node:fs";
import path from "node:path";

export type DispatchStartMeta = {
  runId: string;
  sliceId: string;
  agent: string;
  model: string;
};

export type DispatchEndMeta = {
  toolCalls: Record<string, number>;
  bashDurationMs: number;
  skillLoadCount: number;
  tokenIn: number;
  tokenOut: number;
};

export type DispatchHandle = DispatchStartMeta & { startMs: number };

export function recordDispatchStart(meta: DispatchStartMeta): DispatchHandle {
  return { ...meta, startMs: Date.now() };
}

export function recordDispatchEnd(handle: DispatchHandle, end: DispatchEndMeta): void {
  const row = {
    runId: handle.runId,
    sliceId: handle.sliceId,
    agent: handle.agent,
    model: handle.model,
    startMs: handle.startMs,
    wallMs: Date.now() - handle.startMs,
    ...end
  };
  const logPath =
    process.env.CREW_DISPATCH_TIMING_LOG ??
    path.join(
      process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd(),
      ".claude",
      "logs",
      "dispatch-timing.jsonl"
    );
  void fs
    .mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}

```

### tests/dispatch-timing.test.ts

```
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { recordDispatchStart, recordDispatchEnd } from "../scripts/lib/dispatch-timing.ts";

test("records start + end as single JSONL row with wallMs", async () => {
  const tmp = await fs.mkdtemp("/tmp/dispatch-timing-");
  const logPath = path.join(tmp, "dispatch-timing.jsonl");
  process.env.CREW_DISPATCH_TIMING_LOG = logPath;
  try {
    const handle = recordDispatchStart({
      runId: "run-1",
      sliceId: "SLICE-99",
      agent: "crew:builder",
      model: "claude-sonnet-4-6"
    });
    await new Promise<void>((r) => setTimeout(r, 25));
    recordDispatchEnd(handle, {
      toolCalls: { Read: 3, Edit: 1, Bash: 2 },
      bashDurationMs: 800,
      skillLoadCount: 1,
      tokenIn: 12000,
      tokenOut: 3500
    });
    // Allow fire-and-forget append to flush
    await new Promise<void>((r) => setTimeout(r, 50));
    const raw = await fs.readFile(logPath, "utf-8");
    const rows = raw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!["agent"], "crew:builder");
    assert.ok(
      typeof rows[0]!["wallMs"] === "number" && rows[0]!["wallMs"] >= 25,
      `Expected wallMs >= 25, got ${String(rows[0]!["wallMs"])}`
    );
    assert.deepEqual(rows[0]!["toolCalls"], { Read: 3, Edit: 1, Bash: 2 });
  } finally {
    delete process.env.CREW_DISPATCH_TIMING_LOG;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

```

## Files read

