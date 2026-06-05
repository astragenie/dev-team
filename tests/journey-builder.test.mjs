import test from "node:test";
import assert from "node:assert/strict";
import { buildJourney } from "../scripts/lib/ux-validation/journey-builder.mjs";

test("explicit ## User Journey parsed: 3 steps", () => {
  const slice = `# Slice\n## User Journey\n\n1. navigate to /dashboard\n2. click "New Project"\n3. fill form: name=Test → expect: form fills\n## Acceptance criteria\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], { step: 1, verb: "navigate", target: "to /dashboard", expect: "no error / visible", ac_id: null });
  assert.equal(result[2].expect, "form fills");
});

test("override takes precedence over ACs", () => {
  const acs = [{ id: "AC-1", text: "user can click submit" }];
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n`;
  const result = buildJourney(acs, slice);
  assert.equal(result.length, 2);
  assert.equal(result[0].verb, "navigate");
  assert.equal(result[0].ac_id, null); // from override, not from AC
});

test("optional expect defaults to 'no error / visible'", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click button\n`;
  const result = buildJourney([], slice);
  assert.equal(result[0].expect, "no error / visible");
  assert.equal(result[1].expect, "no error / visible");
});

test("unparseable journey line skipped, valid lines parsed", () => {
  const slice = `## User Journey\n\n1. navigate to /app\nthis line is not a step\n2. click submit\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 2);
  assert.equal(result[0].verb, "navigate");
  assert.equal(result[1].verb, "click");
});

test("journey section stops at next ## header", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n## Notes\n3. this line ignored\n`;
  const result = buildJourney([], slice);
  assert.equal(result.length, 2);
});

test("navigation AC sorts before interaction AC", () => {
  const acs = [
    { id: "AC-1", text: "user can click the submit button" },
    { id: "AC-2", text: "user should navigate to /dashboard" }
  ];
  const result = buildJourney(acs, "");
  assert.equal(result[0].ac_id, "AC-2"); // navigation first
  assert.equal(result[1].ac_id, "AC-1"); // interaction second
});

test("tie-breaking by document order within same category", () => {
  const acs = [
    { id: "AC-1", text: "user can click submit" },
    { id: "AC-2", text: "user can click cancel" }
  ];
  const result = buildJourney(acs, "");
  assert.equal(result[0].ac_id, "AC-1");
  assert.equal(result[1].ac_id, "AC-2");
});

test("empty AC list returns []", () => {
  assert.deepEqual(buildJourney([], ""), []);
});

test("all non_ui_ac returns []", () => {
  const acs = [
    { id: "AC-1", text: "server returns 200" },
    { id: "AC-2", text: "database record created" }
  ];
  assert.deepEqual(buildJourney(acs, ""), []);
});

test("single UI AC returns [] (< 2 steps)", () => {
  const acs = [{ id: "AC-1", text: "user clicks submit" }];
  assert.deepEqual(buildJourney(acs, ""), []);
});

import { buildQaInvocation } from "../scripts/lib/ux-validation/qa-adapter.mjs";

test("buildQaInvocation with scenario_chain uses chain as scenarios", () => {
  const chain = [
    { step: 1, verb: "navigate", target: "/app", expect: "page loads", ac_id: "AC-1" }
  ];
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [],
    baselineDir: "tests/baselines",
    outputPath: "/tmp/out.json",
    scenario_chain: chain
  });
  assert.ok(cmd.includes('"verb":"navigate"'), `expected chain in cmd, got: ${cmd}`);
});

test("buildQaInvocation without scenario_chain uses scenarios (backward compat)", () => {
  const scenarios = [{ id: "AC-1", verb: "click", target: "button" }];
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios,
    baselineDir: "tests/baselines",
    outputPath: "/tmp/out.json"
  });
  assert.ok(cmd.includes('"id":"AC-1"'), `expected scenarios in cmd, got: ${cmd}`);
  assert.ok(!cmd.includes('"verb":"navigate"'));
});
