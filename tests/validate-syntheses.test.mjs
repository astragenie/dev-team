// tests/validate-syntheses.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function makeRunsDir(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "synth-val-"));
  const runsDir = path.join(dir, ".claude", "artifacts", "crew", "runs");
  await fs.mkdir(runsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(runsDir, name), content, "utf8");
  }
  return dir;
}

import { validateSyntheses } from "../scripts/validate-syntheses.mjs";

test("validateSyntheses passes when no synthesis files exist", async () => {
  const dir = await makeRunsDir({});
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses passes on clean synthesis file", async () => {
  const dir = await makeRunsDir({
    "foo-final-synthesis.md": "# Synthesis\n## Grade\ntest_confidence: 0.85\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on Grade missing placeholder", async () => {
  const dir = await makeRunsDir({
    "bad-final-synthesis.md": "# Synthesis\n- Grade missing — synthesis is incomplete\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Grade missing/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses errors on timestamp placeholder", async () => {
  const dir = await makeRunsDir({
    "bad2-final-synthesis.md":
      "# Synthesis\n- Handoff: `.claude/artifacts/crew/handoffs/<timestamp>-complete.md`\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /<timestamp>/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("validateSyntheses checks only final-synthesis files not other runs", async () => {
  const dir = await makeRunsDir({
    "2026-run-brief-foo.md": "Grade missing here but not a synthesis",
    "2026-final-synthesis-clean.md": "# OK synthesis\nAll good.\n"
  });
  const result = await validateSyntheses(dir);
  assert.equal(result.errors.length, 0);
  await fs.rm(dir, { recursive: true, force: true });
});
