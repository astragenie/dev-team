import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateUxSpec } from "../scripts/validate-ux-spec.mjs";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "ux-specs"
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("validateUxSpec accepts a well-formed spec with valid operationIds", async () => {
  const result = await validateUxSpec({
    specPath: path.join(FIXTURE_DIR, "valid-ux-spec.md"),
    repoRoot: REPO_ROOT
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(
    result.touchpoints.map((t) => t.operationId),
    ["createThing"]
  );
});

test("validateUxSpec fails when operationId is not in the YAML", async () => {
  const result = await validateUxSpec({
    specPath: path.join(FIXTURE_DIR, "missing-operationid.md"),
    repoRoot: REPO_ROOT
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /nonExistentOp/.test(e)),
    "expected error mentioning missing operationId"
  );
});

test("validateUxSpec fails when `## API touchpoints` section is absent", async (t) => {
  const tmpPath = path.join(FIXTURE_DIR, `no-touchpoints-${process.pid}-${Date.now()}.md`);
  const { writeFile, unlink } = await import("node:fs/promises");
  await writeFile(
    tmpPath,
    "---\ncontracts: tests/fixtures/openapi/valid-feat.openapi.yaml\n---\n\n# UX Spec\n\nno touchpoints section here.\n",
    "utf8"
  );
  t.after(() => unlink(tmpPath).catch(() => {}));
  const result = await validateUxSpec({
    specPath: tmpPath,
    repoRoot: REPO_ROOT
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /API touchpoints/.test(e)),
    "expected error mentioning missing section"
  );
});
