/**
 * tests/gepa/candidate-generator-aiplugin-rewriter.test.ts — FEAT-192 SLICE-A
 *
 * Covers:
 *  - AC-1 flag routing: GEPA_LIVE_GENERATOR unset/"0" -> stub, "1" -> dispatchRewriter
 *  - AC-7 response-format extraction: fenced-block happy path
 *  - AC-7 response-format extraction: free-form prose (no fenced block) -> rejected, not written
 *  - Spawn failure -> reject the slot, never crash the cycle
 *
 * The live dispatch path is exercised through the public `generate()` API via
 * the `rewriteDeps` test seam (overrides the `runSubprocess` primitive) so no
 * real `claude -p` subprocess is spawned in tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BudgetMeter, Trial } from "@astragenie/gepa-core";
import {
  createAipluginCandidateGenerator,
  extractRewrittenContent
} from "../../scripts/lib/gepa/candidate-generator-aiplugin.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────

let repoPath: string;
const ORIGINAL_FLAG = process.env["GEPA_LIVE_GENERATOR"];

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), "gepa-rewriter-test-"));
  mkdirSync(join(repoPath, "agents"), { recursive: true });
  writeFileSync(
    join(repoPath, "agents", "fullstack-dev.md"),
    "# fullstack-dev\n\n## Identity anchor\n\nYou are fullstack-dev.\n",
    "utf8"
  );
});

afterEach(() => {
  rmSync(repoPath, { recursive: true, force: true });
  if (ORIGINAL_FLAG === undefined) {
    delete process.env["GEPA_LIVE_GENERATOR"];
  } else {
    process.env["GEPA_LIVE_GENERATOR"] = ORIGINAL_FLAG;
  }
});

function fakeMeter(): BudgetMeter {
  let n = 0;
  return {
    async reserve() {
      n += 1;
      return { reservationId: `res-${n}`, ok: true, remainingUsd: 100 };
    },
    async record() {
      /* no-op mock */
    },
    async release() {
      /* no-op mock */
    },
    async spentToday() {
      return 0;
    },
    dailyCap() {
      return 100;
    }
  };
}

function failingTrial(rationale: string): Trial {
  return {
    id: "trial-1",
    agent: "fullstack-dev",
    phase: "build",
    candidate_prompt_hash: "hash-1",
    candidate_prompt_path: null,
    score: {
      pass: false,
      score: 0.2,
      cost_usd: 0.01,
      latency_ms: 100,
      rationale
    },
    source: "eval",
    pareto_rank: null,
    created_at: new Date().toISOString()
  };
}

/** NDJSON stream-json payload with a single assistant text block. */
function streamJsonFor(text: string): string {
  return (
    JSON.stringify({
      type: "message",
      role: "assistant",
      content: [{ type: "text", text }]
    }) + "\n"
  );
}

function candidateDir(cycleId: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "candidates", cycleId);
}

// ── AC-7 extraction unit tests (pure function) ──────────────────────────────

describe("extractRewrittenContent — AC-7 response-format contract", () => {
  it("happy path: extracts content from a single fenced block", () => {
    const response = "```markdown\n# rewritten\n\nbody text\n```";
    const result = extractRewrittenContent(response);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe("# rewritten\n\nbody text");
    }
  });

  it("rejects free-form prose with no fenced block", () => {
    const result = extractRewrittenContent("Here is my analysis: I would change the intro.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_fenced_block");
    }
  });

  it("rejects an empty response", () => {
    const result = extractRewrittenContent("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_response");
  });

  it("rejects an empty fenced block", () => {
    const result = extractRewrittenContent("```\n\n```");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_fenced_block");
  });

  it("regression: does NOT truncate at a nested fenced block inside the rewritten body", () => {
    // agents/aiplugin-dev.md (the SLICE-D/AC-3 target) legitimately contains a
    // fenced example inside its own body. A non-greedy close-fence match
    // would stop at the FIRST ``` after the opening fence — i.e. at the
    // nested block's own closing fence — silently truncating everything
    // after it (including the trailing text below).
    const response = [
      "```markdown",
      "# aiplugin-dev",
      "",
      "## Identity anchor",
      "",
      "You are aiplugin-dev.",
      "",
      "Example usage:",
      "",
      "```bash",
      'echo "hello from a nested fence"',
      "```",
      "",
      "more text after the nested example -- must survive extraction",
      "```"
    ].join("\n");

    const result = extractRewrittenContent(response);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain("```bash");
      expect(result.content).toContain('echo "hello from a nested fence"');
      expect(result.content).toContain(
        "more text after the nested example -- must survive extraction"
      );
      // The full body must be present, not truncated at the nested fence.
      expect(result.content).toBe(
        [
          "# aiplugin-dev",
          "",
          "## Identity anchor",
          "",
          "You are aiplugin-dev.",
          "",
          "Example usage:",
          "",
          "```bash",
          'echo "hello from a nested fence"',
          "```",
          "",
          "more text after the nested example -- must survive extraction"
        ].join("\n")
      );
    }
  });
});

// ── AC-1 flag routing + end-to-end live path via generate() ─────────────────

describe("generate() — AC-1 flag routing", () => {
  it("GEPA_LIVE_GENERATOR unset routes to the stub (no dispatch, deterministic marker)", async () => {
    delete process.env["GEPA_LIVE_GENERATOR"];
    let dispatched = false;
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-unset",
      rewriteDeps: {
        async runSubprocess() {
          dispatched = true;
          return streamJsonFor("```md\nshould not be used\n```");
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400")],
      1,
      { meter: fakeMeter() }
    );

    expect(dispatched).toBe(false);
    expect(candidates).toHaveLength(1);
    const content = readFileSync(candidates[0]!.prompt_path, "utf8");
    expect(content).toContain("<!-- GEPA candidate mutation -->");
  });

  it('GEPA_LIVE_GENERATOR="0" routes to the stub', async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "0";
    let dispatched = false;
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-zero",
      rewriteDeps: {
        async runSubprocess() {
          dispatched = true;
          return streamJsonFor("```md\nshould not be used\n```");
        }
      }
    });

    await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400")],
      1,
      { meter: fakeMeter() }
    );

    expect(dispatched).toBe(false);
  });

  it('GEPA_LIVE_GENERATOR="1" routes to dispatchRewriter and writes the extracted content', async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "1";
    let capturedPrompt = "";
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-live",
      rewriteDeps: {
        async runSubprocess(prompt: string) {
          capturedPrompt = prompt;
          // A genuine minimal-diff rewrite: identity anchor content is fully
          // preserved (plus an added clause) and a new section is appended —
          // non-trivial vs the champion so it clears the SLICE-B AC-2 no-op
          // guardrail, while the AC-5 identity-anchor guardrail passes
          // because every champion anchor word survives in the candidate.
          return streamJsonFor(
            [
              "```markdown",
              "# fullstack-dev",
              "",
              "## Identity anchor",
              "",
              "You are fullstack-dev. Stay narrowly scoped to fullstack implementation work.",
              "",
              "## Scope note",
              "",
              "Do not claim other agents' roles.",
              "```"
            ].join("\n")
          );
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400, inlined detail instead of a skill")],
      1,
      { meter: fakeMeter() }
    );

    expect(candidates).toHaveLength(1);
    const content = readFileSync(candidates[0]!.prompt_path, "utf8");
    expect(content).not.toContain("<!-- GEPA candidate mutation -->");
    expect(content).toContain("## Identity anchor");
    // Full rationale (not truncated) must reach the rewrite prompt.
    expect(capturedPrompt).toContain("set maxLines to 400, inlined detail instead of a skill");
    expect(capturedPrompt).toContain("single fenced code block");
  });
});

// ── AC-7 rejection paths wired through generate() ───────────────────────────

describe("generate() — AC-7 rejection paths (live mode)", () => {
  it("free-form prose response is rejected: no candidate produced, nothing written", async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "1";
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-prose",
      rewriteDeps: {
        async runSubprocess() {
          return streamJsonFor(
            "I reviewed the prompt and think the maxLines cap should be raised."
          );
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400")],
      1,
      { meter: fakeMeter() }
    );

    expect(candidates).toHaveLength(0);
    // No candidate file should exist under the cycle dir — nothing written.
    const dir = candidateDir("cycle-prose");
    const files = (() => {
      try {
        return readdirSync(dir);
      } catch {
        return [];
      }
    })();
    expect(files).toHaveLength(0);
  });

  it("spawn failure rejects the slot and does not crash the cycle", async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "1";
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-spawn-fail",
      rewriteDeps: {
        async runSubprocess() {
          throw new Error("candidate-dispatch: failed to spawn claude: ENOENT");
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400")],
      2,
      { meter: fakeMeter() }
    );

    // Both slots reject; generate() resolves normally with an empty array
    // rather than throwing.
    expect(candidates).toHaveLength(0);
  });

  it("logs a gepa_rewriter_dispatch event for both accepted and rejected slots", async () => {
    process.env["GEPA_LIVE_GENERATOR"] = "1";
    let call = 0;
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-events",
      rewriteDeps: {
        async runSubprocess() {
          call += 1;
          if (call === 1) {
            return streamJsonFor("no fenced block here");
          }
          return streamJsonFor("```md\n# ok\n\n## Identity anchor\nbody\n```");
        }
      }
    });

    await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial("set maxLines to 400")],
      2,
      { meter: fakeMeter() }
    );

    const eventsPath = join(repoPath, ".claude", "logs", "events.jsonl");
    const raw = readFileSync(eventsPath, "utf8");
    const events = raw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const dispatchEvents = events.filter(
      (e: Record<string, unknown>) => e.event === "gepa_rewriter_dispatch"
    );
    expect(dispatchEvents).toHaveLength(2);
    expect(dispatchEvents[0].accepted).toBe(false);
    expect(dispatchEvents[0].reason).toBe("no_fenced_block");
    expect(dispatchEvents[1].accepted).toBe(true);
    expect(typeof dispatchEvents[0].dispatch_duration_ms).toBe("number");
  });
});
