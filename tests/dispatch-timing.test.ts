import { test, expect } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordDispatchStart, recordDispatchEnd } from "../scripts/lib/dispatch-timing.ts";

// TODO(quarantine): wallMs parallel-contention flake — see scout manifest 20260716T230000Z
test.skip("records start + end as single JSONL row with wallMs", async () => {
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
    expect(rows.length).toBe(1);
    expect(rows[0]!["agent"]).toBe("crew:fullstack-dev");
    expect(
      typeof rows[0]!["wallMs"] === "number" && rows[0]!["wallMs"] >= 25,
      `Expected wallMs >= 25, got ${String(rows[0]!["wallMs"])}`
    ).toBeTruthy();
    expect(rows[0]!["toolCalls"]).toEqual({ Read: 3, Edit: 1, Bash: 2 });
  } finally {
    delete process.env.CREW_DISPATCH_TIMING_LOG;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
