/**
 * Dry-run replay fixture — SLICE-A.
 *
 * Loads the captured trace JSON and runs assertions through the helpers.
 * Does NOT invoke runClaude. Safe to run without quota or CLI auth.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CapturedTrace, Fixture } from "../lib/types.ts";
import { artifactContains, dispatchedAgent, hasToolCall } from "../lib/assert-trace.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACE_PATH = path.join(__dirname, "captured-traces", "00-builder-handoff.trace.json");

const fixture: Fixture = {
  name: "00-dry-run-replay",
  prompt: "(dry-run — no live claude -p invocation)",

  async expect(_ignoredTrace: CapturedTrace): Promise<void> {
    // Load the canonical captured trace from the well-known path.
    const raw = await fs.readFile(TRACE_PATH, "utf8");
    const trace = JSON.parse(raw) as CapturedTrace;

    // (a) Exit code must be 0.
    if (trace.exitCode !== 0) {
      throw new Error(`Expected exitCode 0, got ${trace.exitCode}`);
    }

    // (b) Lead must have dispatched crew:builder.
    if (dispatchedAgent(trace, /^crew:builder/) === null) {
      throw new Error("Expected Agent dispatch to crew:builder, found none");
    }

    // (c) A Bash tool call matching bun test must exist.
    if (!hasToolCall(trace, "Bash", (inp) => /bun (run )?test/.test(String(inp.command ?? "")))) {
      throw new Error("Expected Bash tool call matching /bun (run )?test/");
    }

    // (d) Handoff artifact must contain verdict: PASS.
    if (!artifactContains(trace, /SLICE-.*-builder\.md$/, /verdict:\s*PASS/i)) {
      throw new Error("Expected handoff artifact with verdict: PASS");
    }
  }
};

export default fixture;
