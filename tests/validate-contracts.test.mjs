import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateContracts } from "../scripts/validate-contracts.mjs";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "openapi"
);

test("validateContracts accepts a well-formed FEAT contract YAML", async () => {
  const result = await validateContracts({
    yamlPath: path.join(FIXTURE_DIR, "valid-feat.openapi.yaml"),
    tsOutPath: path.join(FIXTURE_DIR, "valid-feat-contracts.ts"),
    writeTs: false,
    runLint: false // lint covered separately
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.regeneratedTs.includes("export"), "TS output empty");
});
