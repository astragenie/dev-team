import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { validateContracts } from "../scripts/validate-contracts.ts";

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

test("regenerated TS includes operation paths and Thing schema", async () => {
  const result = await validateContracts({
    yamlPath: path.join(FIXTURE_DIR, "valid-feat.openapi.yaml"),
    tsOutPath: path.join(FIXTURE_DIR, "valid-feat-contracts.ts"),
    writeTs: false,
    runLint: false
  });
  assert.equal(result.ok, true);
  assert.match(result.regeneratedTs, /\/things/);
  assert.match(result.regeneratedTs, /Thing/);
  assert.match(result.regeneratedTs, /export\s+(interface|type)\s+paths/);
});

test("validateContracts reports drift when committed TS differs from regenerated", async (t) => {
  const yamlPath = path.join(FIXTURE_DIR, "valid-feat.openapi.yaml");
  const driftedTsPath = path.join(FIXTURE_DIR, `drifted-contracts-${process.pid}-${Date.now()}.ts`);
  await writeFile(driftedTsPath, "// out of date\nexport const stale = true;\n", "utf8");
  t.after(() =>
    unlink(driftedTsPath).catch(() => {
      /* ignore cleanup errors */
    })
  );
  const result = await validateContracts({
    yamlPath,
    tsOutPath: driftedTsPath,
    writeTs: false,
    runLint: false,
    checkDrift: true
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /drift/i.test(e)),
    "expected a drift error: " + JSON.stringify(result.errors)
  );
});

test("validateContracts fails redocly lint on broken YAML", async () => {
  const result = await validateContracts({
    yamlPath: path.join(FIXTURE_DIR, "broken-missing-examples.openapi.yaml"),
    tsOutPath: path.join(FIXTURE_DIR, "broken-missing-examples-contracts.ts"),
    writeTs: false,
    runLint: true,
    checkDrift: false
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /redocly|operationId|operation-operationId/i.test(e)),
    "expected a redocly error: " + JSON.stringify(result.errors)
  );
});

// Locks FEAT-138: the CI loop runs the negative fixture with checkDrift:true
// (checkDrift: !writeTs). A spec that fails redocly lint must NOT also produce
// a "drift: committed TS missing" error — that conflates "intentionally broken"
// with "needs regen". The fixture fails for lint reasons only.
test("validateContracts skips the drift check when redocly lint fails", async () => {
  const result = await validateContracts({
    yamlPath: path.join(FIXTURE_DIR, "broken-missing-examples.openapi.yaml"),
    tsOutPath: path.join(FIXTURE_DIR, "broken-missing-examples-contracts.ts"),
    writeTs: false,
    runLint: true,
    checkDrift: true
  });
  assert.equal(result.ok, false, "broken fixture must still fail");
  assert.ok(
    result.errors.some((e) => /redocly|operationId/i.test(e)),
    "expected the lint failure: " + JSON.stringify(result.errors)
  );
  assert.ok(
    !result.errors.some((e) => /drift/i.test(e)),
    "drift check must be skipped when lint already failed: " + JSON.stringify(result.errors)
  );
});
