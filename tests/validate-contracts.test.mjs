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

test("validateContracts reports drift when committed TS differs from regenerated", async () => {
  const yamlPath = path.join(FIXTURE_DIR, "valid-feat.openapi.yaml");
  const driftedTsPath = path.join(FIXTURE_DIR, "drifted-contracts.ts");
  await (
    await import("node:fs/promises")
  ).writeFile(driftedTsPath, "// out of date\nexport const stale = true;\n", "utf8");
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
  await (await import("node:fs/promises")).unlink(driftedTsPath);
});
