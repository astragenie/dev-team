/**
 * tests/gepa/candidate-generator-aiplugin-guardrails.test.ts — FEAT-192 SLICE-B
 *
 * Covers:
 *  - AC-5 structural identity-anchor guardrail (checkIdentityAnchor):
 *    missing heading, hollowed-out anchor, preserved/expanded anchor.
 *  - AC-2 non-trivial-diff guardrail (checkNonTrivialDiff): identical,
 *    whitespace-only, below-min-changed-lines, and a real edit.
 *  - Both guardrails wired through generate() (live mode): a gutted-identity
 *    or no-op candidate produces zero candidates and logs the matching
 *    rejection event; a real rewrite still succeeds.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BudgetMeter, Trial } from "@astragenie/gepa-core";
import {
  checkIdentityAnchor,
  checkNonTrivialDiff,
  createAipluginCandidateGenerator
} from "../../scripts/lib/gepa/candidate-generator-aiplugin.ts";

// ── Pure-function unit tests ────────────────────────────────────────────────

const CHAMPION = [
  "# fullstack-dev",
  "",
  "## Identity anchor",
  "",
  "You are fullstack-dev, a senior implementation specialist for the Astra plugin ecosystem.",
  "",
  "## Scope",
  "",
  "Ship working code, reuse existing patterns, add observability."
].join("\n");

describe("checkIdentityAnchor — AC-5 structural guardrail", () => {
  it("rejects a candidate missing the ## Identity anchor heading entirely", () => {
    const candidate = "# fullstack-dev\n\n## Scope\n\nShip working code.";
    const result = checkIdentityAnchor(CHAMPION, candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_heading");
  });

  it("rejects a candidate whose identity-anchor body is hollowed out", () => {
    const candidate = [
      "# fullstack-dev",
      "",
      "## Identity anchor",
      "",
      "ok.",
      "",
      "## Scope",
      "",
      "Ship working code, reuse existing patterns, add observability."
    ].join("\n");
    const result = checkIdentityAnchor(CHAMPION, candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("anchor_gutted");
      expect(result.similarity).toBeLessThan(0.4);
    }
  });

  it("accepts a candidate that preserves the anchor verbatim", () => {
    const result = checkIdentityAnchor(CHAMPION, CHAMPION);
    expect(result.ok).toBe(true);
  });

  it("accepts a candidate that EXPANDS the anchor with new supporting detail", () => {
    const candidate = [
      "# fullstack-dev",
      "",
      "## Identity anchor",
      "",
      "You are fullstack-dev, a senior implementation specialist for the Astra plugin ecosystem.",
      "Stay narrowly scoped to fullstack implementation work and never claim another role.",
      "",
      "## Scope",
      "",
      "Ship working code, reuse existing patterns, add observability."
    ].join("\n");
    const result = checkIdentityAnchor(CHAMPION, candidate);
    expect(result.ok).toBe(true);
  });

  it("accepts a candidate that trims filler but keeps the identity substance", () => {
    // A legitimate minimal-diff edit: rewords lightly but keeps the core
    // vocabulary (fullstack-dev, senior, implementation, specialist, Astra).
    const candidate = [
      "# fullstack-dev",
      "",
      "## Identity anchor",
      "",
      "You are fullstack-dev, senior implementation specialist for Astra.",
      "",
      "## Scope",
      "",
      "Ship working code, reuse existing patterns, add observability."
    ].join("\n");
    const result = checkIdentityAnchor(CHAMPION, candidate);
    expect(result.ok).toBe(true);
  });

  it("treats a champion with no identity anchor as nothing-to-guard", () => {
    const championNoAnchor = "# some-agent\n\n## Scope\n\nDo things.";
    const result = checkIdentityAnchor(championNoAnchor, "# some-agent\n\nrewritten.");
    expect(result.ok).toBe(true);
  });
});

// ── AC-2 non-trivial-diff guardrail ─────────────────────────────────────────

describe("checkNonTrivialDiff — AC-2 no-op rejection", () => {
  const champion = "# agent\n\nline one.\nline two.\nline three.\n";

  it("rejects a candidate identical to the champion", () => {
    const result = checkNonTrivialDiff(champion, champion.trim());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("identical_to_champion");
  });

  it("rejects a whitespace-only edit (same tokens, different spacing)", () => {
    const candidate = "# agent\n\n\n\nline one.\n\nline two.\n\n\nline three.";
    const result = checkNonTrivialDiff(champion, candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("whitespace_only_diff");
  });

  it("rejects a candidate with one line dropped and nothing added (net diff of 1)", () => {
    // "line two." is deleted with no replacement — the multiset diff for
    // that single key is 1 (no compensating "new line" to push the total to
    // 2), landing below MIN_CHANGED_LINES. A one-line edit that SWAPS
    // content (old line out, new line in) always nets to >= 2 and is not
    // affected by this floor — see the "real multi-line edit" case below.
    const candidate = "# agent\n\nline one.\nline three.\n";
    const result = checkNonTrivialDiff(champion, candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("below_min_changed_lines");
      expect(result.changedLines).toBe(1);
    }
  });

  it("accepts a real multi-line edit", () => {
    const candidate = "# agent\n\nline uno.\nline dos.\nline three.\nline four.\n";
    const result = checkNonTrivialDiff(champion, candidate);
    expect(result.ok).toBe(true);
  });
});

// ── Wired through generate() (live mode) ────────────────────────────────────

let repoPath: string;
const ORIGINAL_FLAG = process.env["GEPA_LIVE_GENERATOR"];

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), "gepa-guardrails-test-"));
  mkdirSync(join(repoPath, "agents"), { recursive: true });
  writeFileSync(join(repoPath, "agents", "fullstack-dev.md"), `${CHAMPION}\n`, "utf8");
  process.env["GEPA_LIVE_GENERATOR"] = "1";
});

afterEach(() => {
  rmSync(repoPath, { recursive: true, force: true });
  if (ORIGINAL_FLAG === undefined) {
    delete process.env["GEPA_LIVE_GENERATOR"];
  } else {
    process.env["GEPA_LIVE_GENERATOR"] = ORIGINAL_FLAG;
  }
});

function fakeMeter(): BudgetMeter & { releasedIds: string[] } {
  let n = 0;
  const releasedIds: string[] = [];
  return {
    releasedIds,
    async reserve() {
      n += 1;
      return { reservationId: `res-${n}`, ok: true, remainingUsd: 100 };
    },
    async record() {
      /* no-op mock */
    },
    async release(reservationId: string) {
      releasedIds.push(reservationId);
    },
    async spentToday() {
      return 0;
    },
    dailyCap() {
      return 100;
    }
  };
}

function failingTrial(): Trial {
  return {
    id: "trial-1",
    agent: "fullstack-dev",
    phase: "build",
    candidate_prompt_hash: "hash-1",
    candidate_prompt_path: null,
    score: { pass: false, score: 0.2, cost_usd: 0.01, latency_ms: 100, rationale: "gap" },
    source: "eval",
    pareto_rank: null,
    created_at: new Date().toISOString()
  };
}

function streamJsonFor(text: string): string {
  return `${JSON.stringify({ type: "message", role: "assistant", content: [{ type: "text", text }] })}\n`;
}

describe("generate() — AC-5 identity-anchor guardrail rejects a gutted rewrite", () => {
  it("hollowed-out anchor -> zero candidates + gepa_identity_anchor_broken event, budget released", async () => {
    const meter = fakeMeter();
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-gutted",
      rewriteDeps: {
        async runSubprocess() {
          return streamJsonFor("```markdown\n# fullstack-dev\n\n## Identity anchor\n\nok.\n```");
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial()],
      1,
      { meter }
    );

    expect(candidates).toHaveLength(0);
    expect(meter.releasedIds).toHaveLength(1);

    const events = readFileSync(join(repoPath, ".claude", "logs", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const broken = events.filter((e) => e.event === "gepa_identity_anchor_broken");
    expect(broken).toHaveLength(1);
    expect(broken[0].reason).toBe("anchor_gutted");
    expect(typeof broken[0].similarity).toBe("number");
  });

  it("missing heading entirely -> rejected with reason missing_heading", async () => {
    const meter = fakeMeter();
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-no-heading",
      rewriteDeps: {
        async runSubprocess() {
          return streamJsonFor("```markdown\n# fullstack-dev\n\n## Scope\n\nDo the thing.\n```");
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial()],
      1,
      { meter }
    );

    expect(candidates).toHaveLength(0);
    const events = readFileSync(join(repoPath, ".claude", "logs", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const broken = events.filter((e) => e.event === "gepa_identity_anchor_broken");
    expect(broken).toHaveLength(1);
    expect(broken[0].reason).toBe("missing_heading");
  });
});

describe("generate() — AC-2 no-op guardrail rejects a disguised non-win", () => {
  it("byte-identical rewrite -> zero candidates + gepa_noop_candidate event, budget released", async () => {
    const meter = fakeMeter();
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-noop",
      rewriteDeps: {
        async runSubprocess() {
          return streamJsonFor(`\`\`\`markdown\n${CHAMPION}\n\`\`\``);
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial()],
      1,
      { meter }
    );

    expect(candidates).toHaveLength(0);
    expect(meter.releasedIds).toHaveLength(1);

    const events = readFileSync(join(repoPath, ".claude", "logs", "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const noop = events.filter((e) => e.event === "gepa_noop_candidate");
    expect(noop).toHaveLength(1);
    expect(noop[0].reason).toBe("identical_to_champion");
  });

  it("a real rewrite that changes substance passes both guardrails", async () => {
    const meter = fakeMeter();
    const generator = createAipluginCandidateGenerator({
      repoPath,
      cycleId: "cycle-real-rewrite",
      rewriteDeps: {
        async runSubprocess() {
          return streamJsonFor(
            [
              "```markdown",
              "# fullstack-dev",
              "",
              "## Identity anchor",
              "",
              "You are fullstack-dev, a senior implementation specialist for the Astra plugin ecosystem.",
              "Stay narrowly scoped to fullstack implementation work.",
              "",
              "## Scope",
              "",
              "Ship working code, reuse existing patterns, add observability, think multi-tenant by default.",
              "```"
            ].join("\n")
          );
        }
      }
    });

    const candidates = await generator.generate(
      join(repoPath, "agents", "fullstack-dev.md"),
      [failingTrial()],
      1,
      { meter }
    );

    expect(candidates).toHaveLength(1);
    expect(meter.releasedIds).toHaveLength(0);
  });
});
