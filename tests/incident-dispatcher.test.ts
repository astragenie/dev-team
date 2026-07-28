// tests/incident-dispatcher.test.ts — FEAT-182 SLICE-A
// Routing-table assertions for /crew:incident dispatcher. Tests catch
// content drift where the triage table loses a branch or the workflow
// loses the dispatch-to-researcher / dispatch-to-release-engineer
// routing. Structural validators (manifest-validate) only check the
// file exists — these tests assert the file's routing logic is intact.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readDoc(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const incident = readDoc("commands/incident.md");
const skill = readDoc("skills/workflow/release-recovery/SKILL.md");
const incidentResponseSkill = readDoc("skills/workflow/incident-response/SKILL.md");
const workflowState = readDoc("scripts/lib/workflow-state.ts");
const gates = readDoc("scripts/lib/workflow-state-gates.ts");
const crewCli = readDoc("scripts/crew.ts");

// /crew:incident dispatcher ────────────────────────────────────────────────

test("FEAT-182 SLICE-A: incident.md has frontmatter description", () => {
  expect(incident).toMatch(/^---\s*\n(?:[\s\S]*?\n)?description:/m);
});

test("FEAT-182 SLICE-A: triage routes unknown root cause to crew:researcher (NOT investigator)", () => {
  // Smoke test from FEAT-182 spec: "Why is the dashboard returning 500s?"
  // is unknown-root-cause and must route to researcher per the AC.
  expect(
    /unknown root cause[\s\S]*?crew:researcher/i.test(incident),
    "unknown-root-cause branch must dispatch crew:researcher"
  ).toBeTruthy();
  // Reverse assertion: dispatcher must explicitly warn against using
  // investigator for RCA.
  expect(incident, "dispatcher must warn against using investigator for RCA").toMatch(
    /do NOT use `crew:investigator` for root cause analysis/i
  );
});

test("FEAT-182 SLICE-A: triage routes rollback need to crew:release-engineer", () => {
  // Smoke test from FEAT-182 spec: "rollback v0.46.0 due to regression"
  // must route to release-engineer with rollback procedure.
  expect(
    /rollback[\s\S]*?crew:release-engineer/i.test(incident),
    "rollback branch must dispatch crew:release-engineer"
  ).toBeTruthy();
});

test("FEAT-182 SLICE-A: triage routes code locations to crew:investigator", () => {
  expect(
    /code locations needed[\s\S]*?crew:investigator/i.test(incident),
    "code-locations-needed branch must dispatch crew:investigator"
  ).toBeTruthy();
});

test("FEAT-182 SLICE-A: triage routes known root cause to specialist builder", () => {
  expect(
    /root cause known[\s\S]*?specialist builder/i.test(incident),
    "known-cause-fix-needed branch must dispatch a specialist builder"
  ).toBeTruthy();
});

test("FEAT-182 SLICE-A: triage routes broken release ceremony to crew:release-engineer", () => {
  expect(
    /broken release ceremony[\s\S]*?crew:release-engineer/i.test(incident),
    "broken-release-ceremony branch must dispatch crew:release-engineer"
  ).toBeTruthy();
});

test("FEAT-182 SLICE-A: workflow loads release-recovery skill before release-ceremony dispatch", () => {
  expect(incident, "release-recovery skill must be referenced by the dispatcher").toMatch(
    /skills\/workflow\/release-recovery/
  );
});

test("FEAT-182 SLICE-A: dispatcher emits incident_resolved badge on full pass", () => {
  expect(incident, "must mark incident_resolved on fix-forward pass").toMatch(
    /mark-badge --repo "\$PWD" --badge incident_resolved/
  );
});

test("FEAT-182 SLICE-A: dispatcher emits rollback_executed badge on rollback path", () => {
  expect(incident, "must mark rollback_executed on rollback path").toMatch(
    /mark-badge --repo "\$PWD" --badge rollback_executed/
  );
});

test("FEAT-182 SLICE-A: production rollback requires explicit user approval", () => {
  expect(incident, "production rollback must explicitly require user approval").toMatch(
    /Production promotion is NEVER unlocked by this dispatcher/
  );
});

// skills/workflow/release-recovery ────────────────────────────────────────

test("FEAT-182 SLICE-A: release-recovery SKILL has tier=workflow frontmatter", () => {
  expect(skill).toMatch(/^---\s*\n[\s\S]*?\ntier: workflow\b/m);
});

test("FEAT-182 SLICE-A: release-recovery enforces NEVER delete tag", () => {
  expect(skill).toMatch(/NEVER delete a published tag/i);
});

test("FEAT-182 SLICE-A: release-recovery enforces NEVER force-push main", () => {
  expect(skill).toMatch(/NEVER force-push `main`/i);
});

test("FEAT-182 SLICE-A: release-recovery mandates pipefail in release scripts", () => {
  expect(skill).toMatch(/set -euo pipefail/);
  expect(skill).toMatch(/pipefail/);
});

test("FEAT-182 SLICE-A: release-recovery describes broken-tag fix-forward sequence", () => {
  expect(skill).toMatch(/Recovery sequence \(broken-tag, fix-forward\)/i);
  expect(skill).toMatch(/version bump direction\. ALWAYS forward/i);
});

test("FEAT-182 SLICE-A: release-recovery describes marketplace-drift recovery", () => {
  expect(skill).toMatch(/marketplace drift/i);
});

test("FEAT-182 SLICE-A: release-recovery stays under 200-line tier cap", () => {
  const lines = skill.split(/\r?\n/).length;
  expect(
    lines <= 200,
    `release-recovery SKILL.md is ${lines} lines, exceeds 200-line workflow tier cap`
  ).toBeTruthy();
});

// workflow-state incident gate + badges ────────────────────────────────────

test("FEAT-182 SLICE-A: BADGE_TABLE registers incident_resolved", () => {
  expect(workflowState).toMatch(/incident_resolved:\s*\{/);
});

test("FEAT-182 SLICE-A: BADGE_TABLE registers rollback_executed", () => {
  expect(workflowState).toMatch(/rollback_executed:\s*\{/);
});

test("FEAT-182 SLICE-A: incident gate slot added to RunGates", () => {
  expect(gates).toMatch(/incident:\s*GateEntry\s*\|\s*null/);
});

// FEAT-182 SLICE-B: incident_blocked badge + incident-response skill ───────

test("FEAT-182 SLICE-B: BADGE_TABLE registers incident_blocked", () => {
  expect(workflowState).toMatch(/incident_blocked:\s*\{/);
});

test("FEAT-182 SLICE-B: mark-badge usage string lists incident_blocked", () => {
  expect(crewCli, "mark-badge usage string must advertise incident_blocked").toMatch(
    /--badge[\s\S]*?incident_resolved\|rollback_executed\|incident_blocked/
  );
});

test("FEAT-182 SLICE-B: dispatcher marks incident_blocked on auto-fix retry exhaustion", () => {
  expect(
    incident,
    "retry-exhaustion path must mark incident_blocked, not the generic blocked badge"
  ).toMatch(/On N exhausted:[\s\S]*?mark-badge --repo "\$PWD" --badge incident_blocked/);
});

test("FEAT-182 SLICE-B: dispatcher documents incident_blocked for a rollback decision needing the user", () => {
  expect(
    incident,
    "prod-rollback-needs-approval path must be documented as an incident_blocked case"
  ).toMatch(/mark `incident_blocked` and hand the decision to the user/i);
});

test("FEAT-182 SLICE-B: dispatcher loads the incident-response skill before prod-incident dispatch", () => {
  expect(incident, "prod-incident branch must load the incident-response skill").toMatch(
    /load `skills\/workflow\/incident-response\/` before dispatch/
  );
});

test("FEAT-182 SLICE-B: incident-response SKILL has tier=workflow frontmatter", () => {
  expect(incidentResponseSkill).toMatch(/^---\s*\n[\s\S]*?\ntier: workflow\b/m);
});

test("FEAT-182 SLICE-B: incident-response describes the rollback decision tree (code vs config vs traffic)", () => {
  expect(incidentResponseSkill).toMatch(/Rollback decision tree \(code vs config vs traffic\)/i);
});

test("FEAT-182 SLICE-B: incident-response names the Azure MCP tools for log/metric/trace reading", () => {
  expect(incidentResponseSkill).toMatch(/mcp__plugin_azure_azure__monitor/);
  expect(incidentResponseSkill).toMatch(/mcp__plugin_azure_azure__applicationinsights/);
  expect(incidentResponseSkill).toMatch(/mcp__plugin_azure_azure__grafana/);
});

test("FEAT-182 SLICE-B: incident-response includes a post-mortem template", () => {
  expect(incidentResponseSkill).toMatch(/## Post-mortem template/);
  expect(incidentResponseSkill).toMatch(/### Contributing factors/);
  expect(incidentResponseSkill).toMatch(/### Action items/);
});

test("FEAT-182 SLICE-B: incident-response stays under 200-line tier cap", () => {
  const lines = incidentResponseSkill.split(/\r?\n/).length;
  expect(
    lines <= 200,
    `incident-response SKILL.md is ${lines} lines, exceeds 200-line workflow tier cap`
  ).toBeTruthy();
});

test("FEAT-182 SLICE-B: release-engineer documents the incident-triggered rollback procedure", () => {
  const releaseEngineer = readDoc("agents/release-engineer.md");
  expect(releaseEngineer).toMatch(/## Rollback procedure \(incident-triggered\)/);
  expect(releaseEngineer).toMatch(/prod → stage → dev/);
  expect(releaseEngineer).toMatch(/v<X\.Y\.Z>-rollback-<timestamp>/);
});
