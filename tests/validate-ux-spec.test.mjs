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
