// tests/validate-badges.test.ts — FEAT-181 / SLICE-194
// Covers: the real repo passes (AC-1/AC-2 aligned today) + an injected
// drift (a badge in BADGE_TABLE absent from the catalog doc) is flagged.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateBadges } from "../scripts/validate-badges.ts";

async function makeFixture(files: { workflowState: string; crewCli: string; catalog: string }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-badges-"));
  const workflowStatePath = path.join(root, "workflow-state.ts");
  const crewCliPath = path.join(root, "crew.ts");
  const catalogPath = path.join(root, "badge-catalog.md");
  await fs.writeFile(workflowStatePath, files.workflowState, "utf8");
  await fs.writeFile(crewCliPath, files.crewCli, "utf8");
  await fs.writeFile(catalogPath, files.catalog, "utf8");
  return { workflowStatePath, crewCliPath, catalogPath };
}

const ALIGNED_WORKFLOW_STATE = `
const BADGE_TABLE: Record<string, BadgeSpec> = {
  foo_a: { selector: (run) => [run.gates, "a"], status: "expected" },
  foo_b: {
    selector: (run) => [run.gates, "b"],
    status: "resolved",
    custom: true
  }
};
`;

const ALIGNED_CREW_CLI = `
const HELP: Record<string, string> = {
  "mark-badge":
    "  node scripts/crew.mjs mark-badge --repo <path> --badge foo_a|foo_b [--note <text>] [--blocked-by <artifact-id>]"
};
`;

const ALIGNED_CATALOG = `# Workflow Badge Catalog

| Badge | Meaning |
|---|---|
| \`foo_a\` | does a thing |
| \`foo_b\` | does another thing |
`;

test("passes when BADGE_TABLE, CLI help text, and catalog doc all agree", async () => {
  const paths = await makeFixture({
    workflowState: ALIGNED_WORKFLOW_STATE,
    crewCli: ALIGNED_CREW_CLI,
    catalog: ALIGNED_CATALOG
  });
  const result = await validateBadges(paths);
  assert.equal(result.ok, true, `unexpected errors: ${result.errors.join("; ")}`);
  assert.equal(result.badgeCount, 2);
});

test("flags a badge present in BADGE_TABLE but missing from the catalog doc", async () => {
  const driftedCatalog = `# Workflow Badge Catalog

| Badge | Meaning |
|---|---|
| \`foo_a\` | does a thing |
`;
  const paths = await makeFixture({
    workflowState: ALIGNED_WORKFLOW_STATE,
    crewCli: ALIGNED_CREW_CLI,
    catalog: driftedCatalog
  });
  const result = await validateBadges(paths);
  assert.equal(result.ok, false, "missing catalog row should fail validation");
  const flagged = result.errors.some((e) => e.includes("foo_b") && e.includes("badge-catalog.md"));
  assert.ok(flagged, `expected a foo_b/catalog drift error, got: ${result.errors.join("; ")}`);
});

test("flags a badge in the CLI accept-list with no BADGE_TABLE handler", async () => {
  const driftedCli = `
const HELP: Record<string, string> = {
  "mark-badge":
    "  node scripts/crew.mjs mark-badge --repo <path> --badge foo_a|foo_b|foo_ghost [--note <text>]"
};
`;
  const paths = await makeFixture({
    workflowState: ALIGNED_WORKFLOW_STATE,
    crewCli: driftedCli,
    catalog: ALIGNED_CATALOG
  });
  const result = await validateBadges(paths);
  assert.equal(result.ok, false, "a CLI-only badge with no handler should fail validation");
  const flagged = result.errors.some((e) => e.includes("foo_ghost"));
  assert.ok(flagged, `expected a foo_ghost drift error, got: ${result.errors.join("; ")}`);
});

test("passes against the real repo (BADGE_TABLE, mark-badge help, and badge-catalog.md aligned today)", async () => {
  const result = await validateBadges();
  assert.equal(result.ok, true, `unexpected drift in the real repo: ${result.errors.join("; ")}`);
  assert.ok(result.badgeCount > 0);
});
