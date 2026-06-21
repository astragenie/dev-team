// tests/agent-prompt-content.test.mjs — FEAT-043
// Keyword assertions for agent prompts. Tests catch semantic drift that
// structural validators (line count, sections) miss — e.g. a prompt that
// drops a required gate keyword or names the wrong skill.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readAgent(name: string) {
  return readFileSync(resolve(ROOT, "agents", `${name}.md`), "utf8");
}

// ── builder ──────────────────────────────────────────────────────────────────

const builder = readAgent("fullstack-dev");

// FEAT-170 SLICE-D: hard line cap enforcement. SLICE-93 shrunk fullstack-dev
// from 397 → 313 lines; SLICE-D adds C# capability + durability discipline +
// plugin-aware framing, cap relaxed to 330. CI gate enforces no regression
// beyond that. Future shrinks may lower further; relax this test in tandem.
test("fullstack-dev.md stays under 330 line cap (FEAT-170 SLICE-D)", () => {
  const lines = builder.split(/\r?\n/).length;
  assert.ok(
    lines <= 330,
    `fullstack-dev.md is ${lines} lines, exceeds 330-line cap (FEAT-170 SLICE-D regression gate)`
  );
});

test("fullstack-dev.md declares durability-discipline skill (FEAT-170 SLICE-D)", () => {
  assert.ok(
    builder.includes("durability-discipline"),
    "fullstack-dev.md missing durability-discipline skill reference (FEAT-170 SLICE-D)"
  );
});

test("backend-dev.md declares durability-discipline skill (FEAT-170 SLICE-D)", () => {
  const be = readAgent("backend-dev");
  assert.ok(
    be.includes("durability-discipline"),
    "backend-dev.md missing durability-discipline skill reference (FEAT-170 SLICE-D)"
  );
});

test("frontend-dev.md declares durability-discipline skill (FEAT-170 SLICE-D)", () => {
  const fe = readAgent("frontend-dev");
  assert.ok(
    fe.includes("durability-discipline"),
    "frontend-dev.md missing durability-discipline skill reference (FEAT-170 SLICE-D)"
  );
});

// FEAT-170 SLICE-D drift prevention: "lead" mentions in builder prompts are
// allowed ONLY for protective + structural reasons. New "lead" mentions outside
// the whitelist are likely orchestrator-vs-lead conflation creep.
//
// Whitelist patterns (substring match):
//   - "you are the lead", "as the lead" — identity-anchor leak phrases (PROTECT)
//   - "crew:lead" — explicit agent name (dispatch blacklist + cross-reference)
//   - "escalated_to_lead" — CLI badge name (backward compat)
//   - "--to lead" — CLI flag default
//   - "(interactive Claude session, `/crew:build`, autonomous loop, or `crew:lead` dispatch" — orchestrator glossary
//
// Any other occurrence of "lead" is treated as drift.
const LEAD_WHITELIST_PATTERNS = [
  /["']you are the lead["']/, // identity-anchor leak phrase (double or single quoted)
  /["']as the lead["']/, // identity-anchor leak phrase
  /`crew:lead`/, // explicit agent name reference
  /escalated_to_lead/, // CLI badge name (backward compat)
  /--to lead/, // CLI flag default value
  /\(interactive Claude session/, // orchestrator glossary clause
  /^- `lead`/m // peer dispatch blacklist entry
];

function leadDriftScan(content: string, file: string): string[] {
  const drifts: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!/\blead\b/i.test(line)) continue;
    const allowed = LEAD_WHITELIST_PATTERNS.some((p) => p.test(line));
    if (!allowed) {
      drifts.push(`${file}:${i + 1}: ${line.slice(0, 100)}`);
    }
  }
  return drifts;
}

test("fullstack-dev.md has no 'lead' drift outside whitelist (FEAT-170 SLICE-D)", () => {
  const drifts = leadDriftScan(builder, "agents/fullstack-dev.md");
  assert.equal(
    drifts.length,
    0,
    `fullstack-dev.md has ${drifts.length} 'lead' mention(s) outside whitelist (use 'orchestrator' instead):\n${drifts.join("\n")}`
  );
});

test("backend-dev.md has no 'lead' drift outside whitelist (FEAT-170 SLICE-D)", () => {
  const drifts = leadDriftScan(readAgent("backend-dev"), "agents/backend-dev.md");
  assert.equal(
    drifts.length,
    0,
    `backend-dev.md has ${drifts.length} 'lead' mention(s) outside whitelist:\n${drifts.join("\n")}`
  );
});

test("frontend-dev.md has no 'lead' drift outside whitelist (FEAT-170 SLICE-D)", () => {
  const drifts = leadDriftScan(readAgent("frontend-dev"), "agents/frontend-dev.md");
  assert.equal(
    drifts.length,
    0,
    `frontend-dev.md has ${drifts.length} 'lead' mention(s) outside whitelist:\n${drifts.join("\n")}`
  );
});

test("fullstack-dev.md declares Cross-layer split detection section (FEAT-170 SLICE-B)", () => {
  assert.ok(
    builder.includes("## Cross-layer split detection") || builder.includes("SPLIT_BUILD"),
    "fullstack-dev.md missing SPLIT_BUILD signal guidance (FEAT-170 SLICE-B)"
  );
});

test("fullstack-dev.md declares Forbidden block (FEAT-170 SLICE-B)", () => {
  assert.ok(
    builder.includes("## Forbidden"),
    "fullstack-dev.md missing ## Forbidden block (FEAT-170 SLICE-B)"
  );
});

test("fullstack-dev.md identity-anchor lists expanded leak phrases (FEAT-170 SLICE-B)", () => {
  for (const phrase of [
    "you are Claude Code",
    "you are the orchestrator",
    "you are the lead",
    "I am Claude Code",
    "Let me re-read",
    "As the orchestrator"
  ]) {
    assert.ok(
      builder.includes(phrase),
      `fullstack-dev.md identity-anchor missing leak phrase "${phrase}"`
    );
  }
});

test("builder.md contains TDD policy reference", () => {
  assert.ok(builder.includes("TDD"), "builder.md missing TDD");
});

test("builder.md references crew:inspector dispatch", () => {
  assert.ok(builder.includes("crew:inspector"), "builder.md missing crew:inspector");
});

test("builder.md contains write-handoff instruction", () => {
  assert.ok(builder.includes("write-handoff"), "builder.md missing write-handoff");
});

test("builder.md contains validation_skipped badge reference", () => {
  assert.ok(builder.includes("validation_skipped"), "builder.md missing validation_skipped");
});

test("builder.md references mark-badge", () => {
  assert.ok(builder.includes("mark-badge"), "builder.md missing mark-badge");
});

// FEAT-170 SLICE-D follow-up: fullstack-dev's ceremony moved to
// skills/workflow/builder-ceremony/SKILL.md (which itself references the
// self-verify-gate skill). The builder prompt now points at builder-ceremony
// instead of carrying the self-verify reference inline.
test("builder.md points at builder-ceremony skill (which carries self-verify reference)", () => {
  assert.ok(
    builder.includes("skills/workflow/builder-ceremony"),
    "builder.md must point at builder-ceremony skill"
  );
});

// FEAT-170 SLICE-D follow-up: builders MUST NOT invoke write-handoff. The
// follow-up IS the badge + 2-5 line structured response. Prohibitive
// "Builders do NOT write handoff artifacts" + "NEVER invoke write-handoff"
// language stays as the protective guardrail; any constructive "write the
// handoff" pattern would regress the new contract.
test("builder.md prohibits write-handoff CLI invocation (FEAT-170 SLICE-D)", () => {
  assert.ok(
    builder.includes("do NOT write handoff") || builder.includes("DO NOT write handoff"),
    "fullstack-dev.md must contain the prohibitive 'Builders do NOT write handoff artifacts' guardrail"
  );
  assert.ok(
    builder.includes("NEVER invoke `write-handoff`") ||
      builder.includes("NEVER invoke write-handoff"),
    "fullstack-dev.md must contain the 'NEVER invoke write-handoff' guardrail"
  );
});

test("builder.md declares the STATUS-token follow-up format (FEAT-170 SLICE-D)", () => {
  for (const token of ["DONE", "BLOCKED", "HELP", "IN-PROGRESS"]) {
    assert.ok(
      builder.includes(token),
      `fullstack-dev.md missing STATUS token "${token}" — see Report contract section`
    );
  }
});

const selfVerifySkill = readFileSync(
  resolve(ROOT, "skills", "workflow", "self-verify-gate", "SKILL.md"),
  "utf8"
);

test("self-verify-gate skill is scoped to affected-class tests", () => {
  assert.ok(
    selfVerifySkill.includes("Affected-class tests only"),
    "self-verify-gate skill missing scoped affected-class test gate"
  );
});

test("self-verify-gate skill defers the full suite to the validator", () => {
  assert.ok(
    selfVerifySkill.includes("Deferred to validator"),
    "self-verify-gate skill missing Deferred to validator handoff line"
  );
});

// ── reviewer ─────────────────────────────────────────────────────────────────

const reviewer = readAgent("inspector");

test("reviewer.md references write-review-result", () => {
  assert.ok(reviewer.includes("write-review-result"), "reviewer.md missing write-review-result");
});

test("reviewer.md contains Test Adequacy section", () => {
  assert.ok(reviewer.includes("Test Adequacy"), "reviewer.md missing Test Adequacy");
});

test("reviewer.md dropped --validation-evidence bundling (validator now mandatory)", () => {
  assert.ok(
    !reviewer.includes("--validation-evidence"),
    "reviewer.md should no longer emit --validation-evidence — the validator owns the mandatory full gate"
  );
});

test("reviewer.md re-runs the builder's affected-class test set", () => {
  assert.ok(
    reviewer.includes("Affected-test re-run"),
    "reviewer.md missing affected-test re-run gate"
  );
});

test("reviewer.md contains rejected decision option", () => {
  assert.ok(reviewer.includes("rejected"), "reviewer.md missing rejected decision");
});

test("reviewer.md addresses regression concerns", () => {
  assert.ok(reviewer.includes("regression"), "reviewer.md missing regression");
});

// ── validator ────────────────────────────────────────────────────────────────

const validator = readAgent("verifier");

test("validator.md contains validation_skipped badge", () => {
  assert.ok(validator.includes("validation_skipped"), "validator.md missing validation_skipped");
});

test("validator.md routes UI/UX scope to crew:qa-expert", () => {
  assert.ok(
    validator.includes("crew:qa-expert"),
    "validator.md missing crew:qa-expert routing for UI/UX scope"
  );
  assert.ok(
    validator.includes("UI/UX/a11y is NOT verifier's scope"),
    "verifier.md missing explicit UI/UX-out-of-scope guard"
  );
});

test("validator.md requires evidence gathering", () => {
  assert.ok(validator.includes("evidence"), "validator.md missing evidence");
});

test("validator.md addresses scenario execution", () => {
  assert.ok(validator.includes("scenario"), "validator.md missing scenario");
});

test("validator.md contains mark-badge reference", () => {
  assert.ok(validator.includes("mark-badge"), "validator.md missing mark-badge");
});

test("validator.md owns the mandatory full gate (lint + format:check)", () => {
  assert.ok(
    validator.includes("Mandatory final gate") && validator.includes("format:check"),
    "validator.md missing mandatory full gate with format:check"
  );
});

// ── deployer ─────────────────────────────────────────────────────────────────

const deployer = readAgent("release-engineer");

test("deployer.md references write-deployment-check", () => {
  assert.ok(
    deployer.includes("write-deployment-check"),
    "deployer.md missing write-deployment-check"
  );
});

test("deployer.md addresses environment transitions", () => {
  assert.ok(deployer.includes("environment"), "deployer.md missing environment");
});

test("deployer.md requires evidence gathering", () => {
  assert.ok(deployer.includes("evidence"), "deployer.md missing evidence");
});

test("deployer.md contains mark-badge reference", () => {
  assert.ok(deployer.includes("mark-badge"), "deployer.md missing mark-badge");
});

test("deployer.md contains write-handoff reference", () => {
  assert.ok(deployer.includes("write-handoff"), "deployer.md missing write-handoff");
});

// ── lead ─────────────────────────────────────────────────────────────────────

const lead = readAgent("lead");

test("lead.md contains mark-badge instruction", () => {
  assert.ok(lead.includes("mark-badge"), "lead.md missing mark-badge");
});

test("lead.md references the handoff artifact in the workflow", () => {
  // Lead is orchestrator-only and does not call write-handoff directly anymore
  // (see commit f3aadb5 — Golden Path makes lead a dispatcher). The handoff
  // remains a first-class artifact lead reads and routes from.
  assert.ok(lead.includes("handoff"), "lead.md missing handoff reference");
});

test("lead.md contains final-synthesis instruction", () => {
  assert.ok(lead.includes("final-synthesis"), "lead.md missing final-synthesis");
});

test("lead.md gates on review_required", () => {
  assert.ok(lead.includes("review_required"), "lead.md missing review_required");
});

test("lead.md references crew:fullstack-dev dispatch", () => {
  assert.ok(lead.includes("crew:fullstack-dev"), "lead.md missing crew:fullstack-dev");
});

// ── ## HARD OUTPUT CONTRACT — Prong A coverage ───────────────────────────────
//
// Asserts that all 12 targeted agents carry the HARD OUTPUT CONTRACT block
// with required preamble, role-specific last-tool-call substring, and
// cite-back to FEAT-161. Covers the 6 already-compliant agents (regression
// guard, AC-3) plus the 6 newly added agents (AC-1, AC-2, AC-4).

const HARD_CONTRACT_HEADING = "## HARD OUTPUT CONTRACT (read first, every dispatch)";
// Existing 6 agents use "LAST action before returning"; new 6 use "LAST tool call before returning".
// Test accepts either form (the common substring "LAST" + "before returning" appears in both).
const REQUIRED_PREAMBLE_A = "LAST action before returning";
const REQUIRED_PREAMBLE_B = "LAST tool call before returning";
const REQUIRED_NARRATION_PHRASE = "Returning narration";
const REQUIRED_VIOLATION_PHRASE = "contract violation";
const FEAT_161_CITE = "FEAT-161";

/** Returns true if the content contains either accepted preamble form. */
function hasPreamble(content: string): boolean {
  return content.includes(REQUIRED_PREAMBLE_A) || content.includes(REQUIRED_PREAMBLE_B);
}

/** Tactical headings that MUST NOT appear before the HARD CONTRACT block (AC-1.2 / AC-2). */
const TACTICAL_HEADINGS = [
  "## Workflow",
  "## Job",
  "## Procedure",
  "## Golden Path",
  "## Inputs",
  "## Operating principles"
];

/**
 * Returns the index of the first tactical heading found in the content,
 * or Number.MAX_SAFE_INTEGER if none are present.
 */
function firstTacticalIdx(content: string): number {
  const indices = TACTICAL_HEADINGS.map((h) => content.indexOf(h)).filter((i) => i !== -1);
  return indices.length > 0 ? Math.min(...indices) : Number.MAX_SAFE_INTEGER;
}

describe("## HARD OUTPUT CONTRACT — Prong A coverage", () => {
  // ── 6 already-compliant agents (regression guard) ──────────────────────────

  describe("lead (already compliant)", () => {
    const content = readAgent("lead");
    test("heading present", () => {
      assert.ok(content.includes(HARD_CONTRACT_HEADING), "lead.md missing HARD CONTRACT heading");
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "lead.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "lead.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: Agent dispatch keyword", () => {
      assert.ok(content.includes("Agent"), "lead.md HARD CONTRACT missing Agent dispatch keyword");
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "lead.md missing FEAT-161 cite-back");
    });
    test("placement before first tactical heading", () => {
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "lead.md HARD CONTRACT heading not found");
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "lead.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  describe("fullstack-dev (already compliant)", () => {
    const content = readAgent("fullstack-dev");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "fullstack-dev.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "fullstack-dev.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "fullstack-dev.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "fullstack-dev.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "fullstack-dev.md missing FEAT-161 cite-back");
    });
    test("placement: after Identity anchor, before first tactical heading", () => {
      const identityIdx = content.indexOf("## Identity anchor");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "fullstack-dev.md HARD CONTRACT heading not found");
      assert.ok(identityIdx !== -1, "fullstack-dev.md missing Identity anchor");
      assert.ok(
        contractIdx > identityIdx,
        "fullstack-dev.md HARD CONTRACT must appear after Identity anchor"
      );
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "fullstack-dev.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  describe("frontend-dev (already compliant)", () => {
    const content = readAgent("frontend-dev");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "frontend-dev.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "frontend-dev.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "frontend-dev.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "frontend-dev.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "frontend-dev.md missing FEAT-161 cite-back");
    });
    test("placement: after Identity anchor, before first tactical heading", () => {
      const identityIdx = content.indexOf("## Identity anchor");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "frontend-dev.md HARD CONTRACT heading not found");
      assert.ok(identityIdx !== -1, "frontend-dev.md missing Identity anchor");
      assert.ok(
        contractIdx > identityIdx,
        "frontend-dev.md HARD CONTRACT must appear after Identity anchor"
      );
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "frontend-dev.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  describe("backend-dev (already compliant)", () => {
    const content = readAgent("backend-dev");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "backend-dev.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "backend-dev.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "backend-dev.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "backend-dev.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "backend-dev.md missing FEAT-161 cite-back");
    });
    test("placement: after Identity anchor, before first tactical heading", () => {
      const identityIdx = content.indexOf("## Identity anchor");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "backend-dev.md HARD CONTRACT heading not found");
      assert.ok(identityIdx !== -1, "backend-dev.md missing Identity anchor");
      assert.ok(
        contractIdx > identityIdx,
        "backend-dev.md HARD CONTRACT must appear after Identity anchor"
      );
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "backend-dev.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  describe("inspector (already compliant)", () => {
    const content = readAgent("inspector");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "inspector.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "inspector.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "inspector.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-review-result keyword", () => {
      assert.ok(
        content.includes("write-review-result"),
        "inspector.md HARD CONTRACT missing write-review-result keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "inspector.md missing FEAT-161 cite-back");
    });
    test("placement before first tactical heading", () => {
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "inspector.md HARD CONTRACT heading not found");
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "inspector.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  describe("verifier (already compliant)", () => {
    const content = readAgent("verifier");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "verifier.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "verifier.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "verifier.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-validation-result keyword", () => {
      assert.ok(
        content.includes("write-validation-result"),
        "verifier.md HARD CONTRACT missing write-validation-result keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "verifier.md missing FEAT-161 cite-back");
    });
    test("placement before first tactical heading (Golden Path)", () => {
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "verifier.md HARD CONTRACT heading not found");
      assert.ok(
        contractIdx < firstTacticalIdx(content),
        "verifier.md HARD CONTRACT must appear before first tactical heading"
      );
    });
  });

  // ── 6 newly added agents (AC-1, AC-2, AC-4) ────────────────────────────────

  describe("architect (newly added)", () => {
    const content = readAgent("architect");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "architect.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "architect.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "architect.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "architect.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("role-specific: Agent dispatch keyword", () => {
      assert.ok(
        content.includes("Agent"),
        "architect.md HARD CONTRACT missing Agent dispatch keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "architect.md missing FEAT-161 cite-back");
    });
    test("placement: after Custom instructions, before Golden Path (tactical heading)", () => {
      const customIdx = content.indexOf("## Custom instructions");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      const goldenPathIdx = content.indexOf("## Golden Path");
      assert.ok(contractIdx !== -1, "architect.md HARD CONTRACT heading not found");
      assert.ok(customIdx !== -1, "architect.md missing Custom instructions section");
      assert.ok(goldenPathIdx !== -1, "architect.md missing Golden Path heading");
      assert.ok(
        contractIdx > customIdx,
        "architect.md HARD CONTRACT must appear after Custom instructions"
      );
      assert.ok(
        contractIdx < goldenPathIdx,
        "architect.md HARD CONTRACT must appear before Golden Path"
      );
    });
  });

  describe("inspector-verifier (newly added)", () => {
    const content = readAgent("inspector-verifier");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "inspector-verifier.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "inspector-verifier.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "inspector-verifier.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-review-result keyword", () => {
      assert.ok(
        content.includes("write-review-result"),
        "inspector-verifier.md HARD CONTRACT missing write-review-result keyword"
      );
    });
    test("role-specific: write-validation-result keyword", () => {
      assert.ok(
        content.includes("write-validation-result"),
        "inspector-verifier.md HARD CONTRACT missing write-validation-result keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(
        content.includes(FEAT_161_CITE),
        "inspector-verifier.md missing FEAT-161 cite-back"
      );
    });
    test("placement: after Custom instructions, before Workflow (tactical heading)", () => {
      const customIdx = content.indexOf("## Custom instructions");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      const workflowIdx = content.indexOf("## Workflow");
      assert.ok(contractIdx !== -1, "inspector-verifier.md HARD CONTRACT heading not found");
      assert.ok(customIdx !== -1, "inspector-verifier.md missing Custom instructions section");
      assert.ok(workflowIdx !== -1, "inspector-verifier.md missing Workflow heading");
      assert.ok(
        contractIdx > customIdx,
        "inspector-verifier.md HARD CONTRACT must appear after Custom instructions"
      );
      assert.ok(
        contractIdx < workflowIdx,
        "inspector-verifier.md HARD CONTRACT must appear before Workflow"
      );
    });
  });

  describe("integrator (newly added)", () => {
    const content = readAgent("integrator");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "integrator.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "integrator.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "integrator.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "integrator.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "integrator.md missing FEAT-161 cite-back");
    });
    test("placement: after Custom instructions, before Procedure of record (tactical heading)", () => {
      const customIdx = content.indexOf("## Custom instructions");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      const procedureIdx = content.indexOf("## Procedure of record");
      assert.ok(contractIdx !== -1, "integrator.md HARD CONTRACT heading not found");
      assert.ok(customIdx !== -1, "integrator.md missing Custom instructions section");
      assert.ok(procedureIdx !== -1, "integrator.md missing Procedure of record heading");
      assert.ok(
        contractIdx > customIdx,
        "integrator.md HARD CONTRACT must appear after Custom instructions"
      );
      assert.ok(
        contractIdx < procedureIdx,
        "integrator.md HARD CONTRACT must appear before Procedure of record"
      );
    });
  });

  describe("release-engineer (newly added)", () => {
    const content = readAgent("release-engineer");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "release-engineer.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "release-engineer.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "release-engineer.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-deployment-check keyword", () => {
      assert.ok(
        content.includes("write-deployment-check"),
        "release-engineer.md HARD CONTRACT missing write-deployment-check keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "release-engineer.md missing FEAT-161 cite-back");
    });
    test("placement: after Custom instructions, before deployment-specific content", () => {
      const customIdx = content.indexOf("## Custom instructions");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      assert.ok(contractIdx !== -1, "release-engineer.md HARD CONTRACT heading not found");
      assert.ok(customIdx !== -1, "release-engineer.md missing Custom instructions section");
      assert.ok(
        contractIdx > customIdx,
        "release-engineer.md HARD CONTRACT must appear after Custom instructions"
      );
    });
  });

  describe("document-writer (newly added)", () => {
    const content = readAgent("document-writer");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "document-writer.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "document-writer.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "document-writer.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "document-writer.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "document-writer.md missing FEAT-161 cite-back");
    });
    test("placement: before Your output contract section", () => {
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      const outputContractIdx = content.indexOf("## Your output contract");
      assert.ok(contractIdx !== -1, "document-writer.md HARD CONTRACT heading not found");
      assert.ok(
        outputContractIdx !== -1,
        "document-writer.md missing Your output contract heading"
      );
      assert.ok(
        contractIdx < outputContractIdx,
        "document-writer.md HARD CONTRACT must appear before Your output contract section"
      );
    });
  });

  describe("refactor (newly added)", () => {
    const content = readAgent("refactor");
    test("heading present", () => {
      assert.ok(
        content.includes(HARD_CONTRACT_HEADING),
        "refactor.md missing HARD CONTRACT heading"
      );
    });
    test("required preamble phrase", () => {
      assert.ok(
        hasPreamble(content),
        "refactor.md missing LAST action/tool call before returning preamble"
      );
    });
    test("narration + violation phrases", () => {
      assert.ok(
        content.includes(REQUIRED_NARRATION_PHRASE) && content.includes(REQUIRED_VIOLATION_PHRASE),
        "refactor.md missing narration/contract-violation phrases"
      );
    });
    test("role-specific: write-handoff keyword", () => {
      assert.ok(
        content.includes("write-handoff"),
        "refactor.md HARD CONTRACT missing write-handoff keyword"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "refactor.md missing FEAT-161 cite-back");
    });
    test("placement: after Custom instructions, before Concern areas content", () => {
      const customIdx = content.indexOf("## Custom instructions");
      const contractIdx = content.indexOf(HARD_CONTRACT_HEADING);
      const concernIdx = content.indexOf("## Concern areas");
      assert.ok(contractIdx !== -1, "refactor.md HARD CONTRACT heading not found");
      assert.ok(customIdx !== -1, "refactor.md missing Custom instructions section");
      assert.ok(concernIdx !== -1, "refactor.md missing Concern areas heading");
      assert.ok(
        contractIdx > customIdx,
        "refactor.md HARD CONTRACT must appear after Custom instructions"
      );
      assert.ok(
        contractIdx < concernIdx,
        "refactor.md HARD CONTRACT must appear before Concern areas"
      );
    });
  });
});

// ── ## First action — Prong B coverage ───────────────────────────────────────
//
// Asserts that all 9 artifact-owning agents carry the stub-artifact-on-entry
// section (FEAT-161 Prong B / SLICE-72). For each agent, verifies:
//   (a) ## First action (stub artifact on entry) heading present
//   (b) --scaffold literal substring
//   (c) --status in-progress literal substring
//   (d) --update literal substring
//   (e) role-specific crew write-* command name
//   (f) FEAT-161 cite-back
//   (g) DEC-019 idempotency reference
// For inspector-verifier: BOTH write-review-result AND write-validation-result present.

const STUB_HEADING = "## First action (stub artifact on entry)";
const SCAFFOLD_FLAG = "--scaffold";
const STATUS_IN_PROGRESS = "--status in-progress";
const UPDATE_FLAG = "--update";
const DEC_019 = "DEC-019";

describe("## First action — Prong B coverage", () => {
  describe("fullstack-dev (no-handoff contract — FEAT-170 SLICE-D)", () => {
    const content = readAgent("fullstack-dev");
    // Builders no longer call write-handoff. The only acceptable mentions are
    // PROHIBITIVE guardrails ("Builders do NOT write handoff", "NEVER invoke
    // write-handoff"). The "write-handoff" substring still appears in those
    // negative-pattern lines; assert FEAT-161 cite still present (pause-detection
    // semantics now carried by badge state).
    test("FEAT-161 cite-back (pause-detection now via badge state)", () => {
      assert.ok(content.includes(FEAT_161_CITE), "fullstack-dev.md missing FEAT-161 cite-back");
    });
  });

  // FEAT-170 SLICE-D — frontend-dev + backend-dev ceremony extracted to
  // skills/workflow/builder-ceremony/SKILL.md. The redundant "## First action"
  // section + DEC-019/scaffold details now live in the skill. Each builder
  // keeps write-handoff + FEAT-161 cite inline as the core protective markers.
  // FEAT-170 SLICE-D follow-up: no-handoff contract now applies to all three
  // builders. They MUST contain the prohibitive "do NOT write handoff" +
  // "NEVER invoke write-handoff" guardrails. FEAT-161 cite remains (pause
  // semantics now via badge state, not artifact).
  for (const agentName of ["frontend-dev", "backend-dev"] as const) {
    describe(`${agentName} (no-handoff contract — FEAT-170 SLICE-D)`, () => {
      const content = readAgent(agentName);
      test("FEAT-161 cite-back (pause-detection via badge state)", () => {
        assert.ok(content.includes(FEAT_161_CITE), `${agentName}.md missing FEAT-161 cite-back`);
      });
      test("prohibits write-handoff CLI invocation", () => {
        assert.ok(
          content.includes("do NOT write handoff") || content.includes("DO NOT write handoff"),
          `${agentName}.md must contain "do NOT write handoff" guardrail`
        );
        assert.ok(
          content.includes("NEVER invoke `write-handoff`") ||
            content.includes("NEVER invoke write-handoff"),
          `${agentName}.md must contain "NEVER invoke write-handoff" guardrail`
        );
      });
      test("declares STATUS-token follow-up format", () => {
        for (const token of ["DONE", "BLOCKED", "HELP", "IN-PROGRESS"]) {
          assert.ok(content.includes(token), `${agentName}.md missing STATUS token "${token}"`);
        }
      });
    });
  }

  describe("inspector", () => {
    const content = readAgent("inspector");
    test("stub heading present", () => {
      assert.ok(content.includes(STUB_HEADING), "inspector.md missing stub artifact heading");
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "inspector.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(content.includes(STATUS_IN_PROGRESS), "inspector.md missing --status in-progress");
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "inspector.md missing --update flag");
    });
    test("role-specific: write-review-result command", () => {
      assert.ok(
        content.includes("write-review-result"),
        "inspector.md missing write-review-result"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "inspector.md missing FEAT-161 cite-back");
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "inspector.md missing DEC-019 reference");
    });
  });

  describe("inspector-verifier (dual-stub)", () => {
    const content = readAgent("inspector-verifier");
    test("stub heading present", () => {
      assert.ok(
        content.includes(STUB_HEADING),
        "inspector-verifier.md missing stub artifact heading"
      );
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "inspector-verifier.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(
        content.includes(STATUS_IN_PROGRESS),
        "inspector-verifier.md missing --status in-progress"
      );
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "inspector-verifier.md missing --update flag");
    });
    test("role-specific: write-review-result command (dual)", () => {
      assert.ok(
        content.includes("write-review-result"),
        "inspector-verifier.md missing write-review-result"
      );
    });
    test("role-specific: write-validation-result command (dual)", () => {
      assert.ok(
        content.includes("write-validation-result"),
        "inspector-verifier.md missing write-validation-result"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(
        content.includes(FEAT_161_CITE),
        "inspector-verifier.md missing FEAT-161 cite-back"
      );
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "inspector-verifier.md missing DEC-019 reference");
    });
  });

  describe("verifier", () => {
    const content = readAgent("verifier");
    test("stub heading present", () => {
      assert.ok(content.includes(STUB_HEADING), "verifier.md missing stub artifact heading");
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "verifier.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(content.includes(STATUS_IN_PROGRESS), "verifier.md missing --status in-progress");
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "verifier.md missing --update flag");
    });
    test("role-specific: write-validation-result command", () => {
      assert.ok(
        content.includes("write-validation-result"),
        "verifier.md missing write-validation-result"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "verifier.md missing FEAT-161 cite-back");
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "verifier.md missing DEC-019 reference");
    });
  });

  describe("integrator", () => {
    const content = readAgent("integrator");
    test("stub heading present", () => {
      assert.ok(content.includes(STUB_HEADING), "integrator.md missing stub artifact heading");
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "integrator.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(content.includes(STATUS_IN_PROGRESS), "integrator.md missing --status in-progress");
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "integrator.md missing --update flag");
    });
    test("role-specific: write-handoff command", () => {
      assert.ok(content.includes("write-handoff"), "integrator.md missing write-handoff");
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "integrator.md missing FEAT-161 cite-back");
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "integrator.md missing DEC-019 reference");
    });
  });

  describe("release-engineer", () => {
    const content = readAgent("release-engineer");
    test("stub heading present", () => {
      assert.ok(
        content.includes(STUB_HEADING),
        "release-engineer.md missing stub artifact heading"
      );
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "release-engineer.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(
        content.includes(STATUS_IN_PROGRESS),
        "release-engineer.md missing --status in-progress"
      );
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "release-engineer.md missing --update flag");
    });
    test("role-specific: write-deployment-check command", () => {
      assert.ok(
        content.includes("write-deployment-check"),
        "release-engineer.md missing write-deployment-check"
      );
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "release-engineer.md missing FEAT-161 cite-back");
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "release-engineer.md missing DEC-019 reference");
    });
  });

  describe("refactor", () => {
    const content = readAgent("refactor");
    test("stub heading present", () => {
      assert.ok(content.includes(STUB_HEADING), "refactor.md missing stub artifact heading");
    });
    test("--scaffold flag present", () => {
      assert.ok(content.includes(SCAFFOLD_FLAG), "refactor.md missing --scaffold flag");
    });
    test("--status in-progress present", () => {
      assert.ok(content.includes(STATUS_IN_PROGRESS), "refactor.md missing --status in-progress");
    });
    test("--update flag present", () => {
      assert.ok(content.includes(UPDATE_FLAG), "refactor.md missing --update flag");
    });
    test("role-specific: write-handoff command", () => {
      assert.ok(content.includes("write-handoff"), "refactor.md missing write-handoff");
    });
    test("FEAT-161 cite-back", () => {
      assert.ok(content.includes(FEAT_161_CITE), "refactor.md missing FEAT-161 cite-back");
    });
    test("DEC-019 reference", () => {
      assert.ok(content.includes(DEC_019), "refactor.md missing DEC-019 reference");
    });
  });
});

// ── ## Structural deviation rule — implementer coverage ───────────────────────
//
// SLICE-77: Every implementer agent must contain the structural-deviation rule
// so builders surface spec↔repo contradictions (DAG cycles, disallowedTools
// mismatches, missing files) as needs_fix instead of silently working around them.
//
// Assertions per agent:
//   (a) ## Structural deviation rule heading present
//   (b) "decision needs_fix" literal (the return instruction)
//   (c) "structural-deviation:" literal (the risks-field prefix convention)
//   (d) anti-silent-workaround warning ("silently drop" OR "silent workaround")
// ─────────────────────────────────────────────────────────────────────────────

const STRUCTURAL_DEVIATION_HEADING = "## Structural deviation rule";
const DECISION_NEEDS_FIX = "decision needs_fix";
const STRUCTURAL_DEVIATION_PREFIX = "structural-deviation:";
const ANTI_SILENT_WORKAROUND_A = "silently drop";
const ANTI_SILENT_WORKAROUND_B = "silent workaround";

describe("## Structural deviation rule — implementer coverage", () => {
  for (const agentName of ["backend-dev", "frontend-dev", "fullstack-dev"] as const) {
    describe(agentName, () => {
      const content = readAgent(agentName);

      test("structural deviation heading present", () => {
        assert.ok(
          content.includes(STRUCTURAL_DEVIATION_HEADING),
          `${agentName}.md missing "${STRUCTURAL_DEVIATION_HEADING}" heading`
        );
      });

      test("structural-deviation return instruction present (decision needs_fix OR BLOCKED + structural-deviation)", () => {
        // FEAT-170 SLICE-D: fullstack-dev uses BLOCKED follow-up form instead
        // of `--decision needs_fix` CLI flag. Either pattern satisfies the
        // semantic intent (surface the contradiction; don't silently work around).
        const usesLegacyDecision = content.includes(DECISION_NEEDS_FIX);
        const usesBlockedFollowUp =
          content.includes("BLOCKED: structural-deviation") ||
          content.includes("BLOCKED: structural deviation");
        assert.ok(
          usesLegacyDecision || usesBlockedFollowUp,
          `${agentName}.md missing structural-deviation return instruction (either "${DECISION_NEEDS_FIX}" CLI flag OR BLOCKED follow-up form)`
        );
      });

      test("structural-deviation: risks-field prefix present", () => {
        assert.ok(
          content.includes(STRUCTURAL_DEVIATION_PREFIX),
          `${agentName}.md missing "${STRUCTURAL_DEVIATION_PREFIX}" risks-field prefix convention`
        );
      });

      test("anti-silent-workaround warning present", () => {
        const hasWarning =
          content.includes(ANTI_SILENT_WORKAROUND_A) || content.includes(ANTI_SILENT_WORKAROUND_B);
        assert.ok(
          hasWarning,
          `${agentName}.md missing anti-silent-workaround warning ("silently drop" or "silent workaround")`
        );
      });
    });
  }
});

// ── ## Stub recovery routine — lead coverage ─────────────────────────────────
//
// SLICE-77: lead.md must contain the stub recovery routine so the orchestrator
// knows to check for in-progress stubs before re-dispatching a specialist that
// returned without a decision (mid-narration pause, DEC-021).
//
// Assertions:
//   (a) ## Stub recovery routine heading present (section marker)
//   (b) "--update <stub-path>" substring (the recovery CLI pattern)
//   (c) "DEC-021" cite-back
//   (d) "re-dispatch costs" OR "re-dispatch" substring (cost-of-re-dispatch rationale)
// ─────────────────────────────────────────────────────────────────────────────

const STUB_RECOVERY_HEADING = "## Stub recovery routine";
const STUB_RECOVERY_UPDATE = "--update <stub-path>";
const STUB_RECOVERY_DEC = "DEC-021";
const STUB_RECOVERY_REDISPATCH = "re-dispatch";

describe("## Stub recovery routine — lead coverage", () => {
  const content = readAgent("lead");

  test("stub recovery heading present", () => {
    assert.ok(
      content.includes(STUB_RECOVERY_HEADING),
      `lead.md missing "${STUB_RECOVERY_HEADING}" heading`
    );
  });

  test("--update <stub-path> recovery pattern present", () => {
    assert.ok(
      content.includes(STUB_RECOVERY_UPDATE),
      `lead.md missing "${STUB_RECOVERY_UPDATE}" recovery CLI pattern`
    );
  });

  test("DEC-021 cite-back present", () => {
    assert.ok(
      content.includes(STUB_RECOVERY_DEC),
      `lead.md missing "${STUB_RECOVERY_DEC}" cite-back`
    );
  });

  test("re-dispatch cost rationale present", () => {
    assert.ok(
      content.includes(STUB_RECOVERY_REDISPATCH),
      `lead.md missing re-dispatch cost rationale substring`
    );
  });
});
