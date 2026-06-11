// tests/agent-prompt-content.test.mjs — FEAT-043
// Keyword assertions for agent prompts. Tests catch semantic drift that
// structural validators (line count, sections) miss — e.g. a prompt that
// drops a required gate keyword or names the wrong skill.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readAgent(name: string) {
  return readFileSync(resolve(ROOT, "agents", `${name}.md`), "utf8");
}

// ── builder ──────────────────────────────────────────────────────────────────

const builder = readAgent("builder");

test("builder.md contains TDD policy reference", () => {
  assert.ok(builder.includes("TDD"), "builder.md missing TDD");
});

test("builder.md references crew:reviewer dispatch", () => {
  assert.ok(builder.includes("crew:reviewer"), "builder.md missing crew:reviewer");
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

test("builder.md references the shared self-verify-gate skill", () => {
  assert.ok(
    builder.includes("skills/workflow/self-verify-gate"),
    "builder.md must reference the shared self-verify procedure skill"
  );
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

const reviewer = readAgent("reviewer");

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

const validator = readAgent("validator");

test("validator.md contains validation_skipped badge", () => {
  assert.ok(validator.includes("validation_skipped"), "validator.md missing validation_skipped");
});

test("validator.md routes UI/UX scope to crew:qa-expert", () => {
  assert.ok(
    validator.includes("crew:qa-expert"),
    "validator.md missing crew:qa-expert routing for UI/UX scope"
  );
  assert.ok(
    validator.includes("UI/UX/a11y is NOT validator's scope"),
    "validator.md missing explicit UI/UX-out-of-scope guard"
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

const deployer = readAgent("deployer");

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

test("lead.md references crew:builder dispatch", () => {
  assert.ok(lead.includes("crew:builder"), "lead.md missing crew:builder");
});
