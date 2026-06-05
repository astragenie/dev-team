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
