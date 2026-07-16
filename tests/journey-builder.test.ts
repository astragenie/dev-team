import { test, expect } from "bun:test";
import { buildJourney } from "../scripts/lib/ux-validation/journey-builder.ts";

test("explicit ## User Journey parsed: 3 steps", () => {
  const slice = `# Slice\n## User Journey\n\n1. navigate to /dashboard\n2. click "New Project"\n3. fill form: name=Test → expect: form fills\n## Acceptance criteria\n`;
  const result = buildJourney([], slice);
  expect(result.length).toBe(3);
  expect(result[0]).toEqual({
    step: 1,
    verb: "navigate",
    target: "to /dashboard",
    expect: "no error / visible",
    ac_id: null
  });
  expect(result[2]!.expect).toBe("form fills");
});

test("override takes precedence over ACs", () => {
  const acs = [{ id: "AC-1", text: "user can click submit" }];
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n`;
  const result = buildJourney(acs, slice);
  expect(result.length).toBe(2);
  expect(result[0]!.verb).toBe("navigate");
  expect(result[0]!.ac_id).toBe(null); // from override, not from AC
});

test("optional expect defaults to 'no error / visible'", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click button\n`;
  const result = buildJourney([], slice);
  expect(result[0]!.expect).toBe("no error / visible");
  expect(result[1]!.expect).toBe("no error / visible");
});

test("unparseable journey line skipped, valid lines parsed", () => {
  const slice = `## User Journey\n\n1. navigate to /app\nthis line is not a step\n2. click submit\n`;
  const result = buildJourney([], slice);
  expect(result.length).toBe(2);
  expect(result[0]!.verb).toBe("navigate");
  expect(result[1]!.verb).toBe("click");
});

test("journey section stops at next ## header", () => {
  const slice = `## User Journey\n\n1. navigate to /app\n2. click submit\n## Notes\n3. this line ignored\n`;
  const result = buildJourney([], slice);
  expect(result.length).toBe(2);
});

test("navigation AC sorts before interaction AC", () => {
  const acs = [
    { id: "AC-1", text: "user can click the submit button" },
    { id: "AC-2", text: "user should navigate to /dashboard" }
  ];
  const result = buildJourney(acs, "");
  expect(result[0]!.ac_id).toBe("AC-2"); // navigation first
  expect(result[1]!.ac_id).toBe("AC-1"); // interaction second
});

test("tie-breaking by document order within same category", () => {
  const acs = [
    { id: "AC-1", text: "user can click submit" },
    { id: "AC-2", text: "user can click cancel" }
  ];
  const result = buildJourney(acs, "");
  expect(result[0]!.ac_id).toBe("AC-1");
  expect(result[1]!.ac_id).toBe("AC-2");
});

test("empty AC list returns []", () => {
  expect(buildJourney([], "")).toEqual([]);
});

test("all non_ui_ac returns []", () => {
  const acs = [
    { id: "AC-1", text: "server returns 200" },
    { id: "AC-2", text: "database record created" }
  ];
  expect(buildJourney(acs, "")).toEqual([]);
});

test("single UI AC returns [] (< 2 steps)", () => {
  const acs = [{ id: "AC-1", text: "user clicks submit" }];
  expect(buildJourney(acs, "")).toEqual([]);
});

import { buildQaInvocation } from "../scripts/lib/ux-validation/qa-adapter.ts";

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
  expect(cmd.includes('"verb":"navigate"'), `expected chain in cmd, got: ${cmd}`).toBeTruthy();
});

test("buildQaInvocation without scenario_chain uses scenarios (backward compat)", () => {
  const scenarios = [{ id: "AC-1", verb: "click", target: "button" }];
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios,
    baselineDir: "tests/baselines",
    outputPath: "/tmp/out.json"
  });
  expect(cmd.includes('"id":"AC-1"'), `expected scenarios in cmd, got: ${cmd}`).toBeTruthy();
  expect(!cmd.includes('"verb":"navigate"')).toBeTruthy();
});
