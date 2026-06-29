// tests/incident-dispatcher.test.ts — FEAT-182 SLICE-A
// Routing-table assertions for /crew:incident dispatcher. Tests catch
// content drift where the triage table loses a branch or the workflow
// loses the dispatch-to-researcher / dispatch-to-release-engineer
// routing. Structural validators (manifest-validate) only check the
// file exists — these tests assert the file's routing logic is intact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readDoc(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const incident = readDoc("commands/incident.md");
const skill = readDoc("skills/workflow/release-recovery/SKILL.md");
const workflowState = readDoc("scripts/lib/workflow-state.ts");
const gates = readDoc("scripts/lib/workflow-state-gates.ts");

// /crew:incident dispatcher ────────────────────────────────────────────────

test("FEAT-182 SLICE-A: incident.md has frontmatter description", () => {
  assert.match(incident, /^---\s*\n(?:[\s\S]*?\n)?description:/m);
});

test("FEAT-182 SLICE-A: triage routes unknown root cause to crew:researcher (NOT investigator)", () => {
  // Smoke test from FEAT-182 spec: "Why is the dashboard returning 500s?"
  // is unknown-root-cause and must route to researcher per the AC.
  assert.ok(
    /unknown root cause[\s\S]*?crew:researcher/i.test(incident),
    "unknown-root-cause branch must dispatch crew:researcher"
  );
  // Reverse assertion: dispatcher must explicitly warn against using
  // investigator for RCA.
  assert.match(
    incident,
    /do NOT use `crew:investigator` for root cause analysis/i,
    "dispatcher must warn against using investigator for RCA"
  );
});

test("FEAT-182 SLICE-A: triage routes rollback need to crew:release-engineer", () => {
  // Smoke test from FEAT-182 spec: "rollback v0.46.0 due to regression"
  // must route to release-engineer with rollback procedure.
  assert.ok(
    /rollback[\s\S]*?crew:release-engineer/i.test(incident),
    "rollback branch must dispatch crew:release-engineer"
  );
});

test("FEAT-182 SLICE-A: triage routes code locations to crew:investigator", () => {
  assert.ok(
    /code locations needed[\s\S]*?crew:investigator/i.test(incident),
    "code-locations-needed branch must dispatch crew:investigator"
  );
});

test("FEAT-182 SLICE-A: triage routes known root cause to specialist builder", () => {
  assert.ok(
    /root cause known[\s\S]*?specialist builder/i.test(incident),
    "known-cause-fix-needed branch must dispatch a specialist builder"
  );
});

test("FEAT-182 SLICE-A: triage routes broken release ceremony to crew:release-engineer", () => {
  assert.ok(
    /broken release ceremony[\s\S]*?crew:release-engineer/i.test(incident),
    "broken-release-ceremony branch must dispatch crew:release-engineer"
  );
});

test("FEAT-182 SLICE-A: workflow loads release-recovery skill before release-ceremony dispatch", () => {
  assert.match(
    incident,
    /skills\/workflow\/release-recovery/,
    "release-recovery skill must be referenced by the dispatcher"
  );
});

test("FEAT-182 SLICE-A: dispatcher emits incident_resolved badge on full pass", () => {
  assert.match(
    incident,
    /mark-badge --repo "\$PWD" --badge incident_resolved/,
    "must mark incident_resolved on fix-forward pass"
  );
});

test("FEAT-182 SLICE-A: dispatcher emits rollback_executed badge on rollback path", () => {
  assert.match(
    incident,
    /mark-badge --repo "\$PWD" --badge rollback_executed/,
    "must mark rollback_executed on rollback path"
  );
});

test("FEAT-182 SLICE-A: production rollback requires explicit user approval", () => {
  assert.match(
    incident,
    /Production promotion is NEVER unlocked by this dispatcher/,
    "production rollback must explicitly require user approval"
  );
});

// skills/workflow/release-recovery ────────────────────────────────────────

test("FEAT-182 SLICE-A: release-recovery SKILL has tier=workflow frontmatter", () => {
  assert.match(skill, /^---\s*\n[\s\S]*?\ntier: workflow\b/m);
});

test("FEAT-182 SLICE-A: release-recovery enforces NEVER delete tag", () => {
  assert.match(skill, /NEVER delete a published tag/i);
});

test("FEAT-182 SLICE-A: release-recovery enforces NEVER force-push main", () => {
  assert.match(skill, /NEVER force-push `main`/i);
});

test("FEAT-182 SLICE-A: release-recovery mandates pipefail in release scripts", () => {
  assert.match(skill, /set -euo pipefail/);
  assert.match(skill, /pipefail/);
});

test("FEAT-182 SLICE-A: release-recovery describes broken-tag fix-forward sequence", () => {
  assert.match(skill, /Recovery sequence \(broken-tag, fix-forward\)/i);
  assert.match(skill, /version bump direction\. ALWAYS forward/i);
});

test("FEAT-182 SLICE-A: release-recovery describes marketplace-drift recovery", () => {
  assert.match(skill, /marketplace drift/i);
});

test("FEAT-182 SLICE-A: release-recovery stays under 200-line tier cap", () => {
  const lines = skill.split(/\r?\n/).length;
  assert.ok(
    lines <= 200,
    `release-recovery SKILL.md is ${lines} lines, exceeds 200-line workflow tier cap`
  );
});

// workflow-state incident gate + badges ────────────────────────────────────

test("FEAT-182 SLICE-A: BADGE_TABLE registers incident_resolved", () => {
  assert.match(workflowState, /incident_resolved:\s*\{/);
});

test("FEAT-182 SLICE-A: BADGE_TABLE registers rollback_executed", () => {
  assert.match(workflowState, /rollback_executed:\s*\{/);
});

test("FEAT-182 SLICE-A: incident gate slot added to RunGates", () => {
  assert.match(gates, /incident:\s*GateEntry\s*\|\s*null/);
});
