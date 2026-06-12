import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordDispatchStart, recordDispatchEnd } from "../scripts/lib/dispatch-timing.ts";

test("records start + end as single JSONL row with wallMs", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-timing-"));
  const logPath = path.join(tmp, "dispatch-timing.jsonl");
  process.env.CREW_DISPATCH_TIMING_LOG = logPath;
  try {
    const handle = recordDispatchStart({
      runId: "run-1",
      sliceId: "SLICE-99",
      agent: "crew:fullstack-dev",
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
    assert.equal(rows[0]!["agent"], "crew:fullstack-dev");
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
