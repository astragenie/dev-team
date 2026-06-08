import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "scripts", "validate-all.ts");

function runValidateAll(cwd = repoRoot) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", scriptPath], {
    encoding: "utf8",
    timeout: 60_000,
    cwd
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

test("validate-all: exits 0 on clean repo and reports all validators passed", () => {
  const { status, stdout } = runValidateAll();
  assert.equal(status, 0, `expected exit 0 but got ${status}`);
  assert.match(stdout, /All 4 validators passed\./);
});

test("validate-all: stdout contains a check mark for each validator on success", () => {
  const { status, stdout } = runValidateAll();
  assert.equal(status, 0);
  assert.match(stdout, /✓ validate-manifests\.ts/);
  assert.match(stdout, /✓ validate-skills\.ts/);
  assert.match(stdout, /✓ validate-agents\.ts/);
  assert.match(stdout, /✓ validate-slices\.ts/);
});
