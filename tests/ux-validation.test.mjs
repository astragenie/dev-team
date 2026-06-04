import test from "node:test";
import assert from "node:assert/strict";
import { extractACs } from "../scripts/lib/ux-validation/index.mjs";

test("extractACs returns empty array on empty input", () => {
  assert.deepEqual(extractACs(""), []);
});

test("extractACs returns empty array when no acceptance criteria header", () => {
  const content = "# Title\n\nNo ACs here.";
  assert.deepEqual(extractACs(content), []);
});

test("extractACs parses well-formed AC list", () => {
  const content = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: form validates email
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "user can click submit" },
    { id: "AC-2", text: "form validates email" }
  ]);
});

test("extractACs ignores nested checkboxes", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: parent criterion
  - [ ] sub-bullet should be ignored
- [ ] AC-2: another criterion
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "parent criterion" },
    { id: "AC-2", text: "another criterion" }
  ]);
});

test("extractACs stops at next ## header", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: first

## Out of scope

- [ ] not-an-ac: ignored
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "first" }
  ]);
});
