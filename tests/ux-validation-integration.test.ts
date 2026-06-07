import test from "node:test";
import assert from "node:assert/strict";

import {
  extractACs,
  classifyScenario,
  computeVerdict,
  buildQaInvocation
} from "../scripts/lib/ux-validation/index.mjs";

test("integration: full pipeline passes on clean evidence", async () => {
  const sliceContent = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: see welcome banner
`;
  const acs = extractACs(sliceContent);
  assert.equal(acs.length, 2);

  const scenarios = acs.map((ac) => ({
    id: ac.id,
    category: classifyScenario(ac.text),
    text: ac.text
  }));
  assert.equal(scenarios[0]!.category, "interaction");
  assert.equal(scenarios[1]!.category, "visibility");

  // Mock /qa output (all pass)
  const evidence = {
    ac_results: scenarios.map((s) => ({ id: s.id, status: "pass", evidence: {} })),
    a11y: { violations: [], passes_count: 30 },
    console: { errors: [], warnings: [] },
    network: { failures: [] },
    visual: { diffs: [] }
  };

  assert.equal(computeVerdict(evidence), "passed");
});

test("integration: full pipeline fails on AC fail + serious a11y", async () => {
  const sliceContent = `## Acceptance criteria

- [ ] AC-1: click submit
- [ ] AC-2: see image
`;
  const acs = extractACs(sliceContent);
  assert.equal(acs.length, 2);

  const evidence = {
    ac_results: [
      { id: "AC-1", status: "pass", evidence: {} },
      { id: "AC-2", status: "fail", evidence: { error: "image not found" } }
    ],
    a11y: { violations: [{ severity: "serious", rule: "image-alt" }], passes_count: 20 },
    console: { errors: [], warnings: [] },
    network: { failures: [{ url: "/logo.png", status: 404 }] },
    visual: { diffs: [] }
  };

  assert.equal(computeVerdict(evidence), "failed");
});

test("integration: qa invocation contains all required flags", () => {
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [{ id: "AC-1", category: "interaction" }],
    baselineDir: "tests/playwright/baselines/",
    outputPath: ".claude/artifacts/crew/validations/x.json"
  });
  // The integration assertion: every flag the skill body documents
  // must be present in the built invocation.
  for (const flag of [
    "--accessibility-scan",
    "--capture-console",
    "--capture-network",
    "--visual-baseline",
    "--output"
  ]) {
    assert.match(cmd, new RegExp(flag));
  }
});
