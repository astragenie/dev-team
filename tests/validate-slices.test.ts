import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptPath = path.join(repoRoot, "scripts", "validate-slices.ts");

async function makeFixture(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(dir, "docs", "ai-loop", "slices", "pending"), { recursive: true });
  return dir;
}

function runValidator(repoPath: string) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", scriptPath], {
    encoding: "utf8",
    timeout: 30_000,
    cwd: repoPath,
    env: { ...process.env, CREW_SLICE_LINT_REPO: repoPath }
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("validate-slices: empty pending dir exits 0", async () => {
  const dir = await makeFixture("vs-empty-");
  try {
    const { status } = runValidator(dir);
    assert.equal(status, 0, "expected exit 0 for empty pending dir");
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: slice with concrete ACs exits 0", async () => {
  const dir = await makeFixture("vs-concrete-");
  try {
    const body = [
      "# SLICE-99: Test slice",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] AC-1: Validator script exits non-zero when placeholder ACs are present",
      "- [ ] AC-2: Validator script exits zero when all ACs are concrete and verifiable",
      ""
    ].join("\n");
    await fs.writeFile(
      path.join(dir, "docs", "ai-loop", "slices", "pending", "SLICE_99_TEST.md"),
      body
    );
    const { status, stderr } = runValidator(dir);
    assert.equal(status, 0, `expected exit 0, got ${status}, stderr: ${stderr}`);
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: literal AC-N: ... placeholder exits 1", async () => {
  const dir = await makeFixture("vs-dot-placeholder-");
  try {
    const body = [
      "# SLICE-99: Placeholder slice",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] AC-1: ...",
      "- [ ] AC-2: ...",
      ""
    ].join("\n");
    await fs.writeFile(
      path.join(dir, "docs", "ai-loop", "slices", "pending", "SLICE_99_PH.md"),
      body
    );
    const { status, stderr } = runValidator(dir);
    assert.equal(status, 1, "expected exit 1 for literal dot placeholder");
    assert.match(stderr, /SLICE_99_PH\.md/, "stderr must name offending file");
    assert.match(stderr, /AC-1/, "stderr must name the placeholder AC bullet");
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: angle-bracket template placeholder exits 1", async () => {
  const dir = await makeFixture("vs-angle-placeholder-");
  try {
    const body = [
      "# SLICE-99: Angle slice",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] AC-1: <concrete, verifiable outcome>",
      ""
    ].join("\n");
    await fs.writeFile(
      path.join(dir, "docs", "ai-loop", "slices", "pending", "SLICE_99_ANGLE.md"),
      body
    );
    const { status, stderr } = runValidator(dir);
    assert.equal(status, 1, "expected exit 1 for angle-bracket placeholder");
    assert.match(stderr, /AC-1/, "stderr must name the placeholder AC bullet");
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: empty AC bullet exits 1", async () => {
  const dir = await makeFixture("vs-empty-bullet-");
  try {
    const body = [
      "# SLICE-99: Empty AC",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] AC-1: ",
      ""
    ].join("\n");
    await fs.writeFile(
      path.join(dir, "docs", "ai-loop", "slices", "pending", "SLICE_99_EMPTY.md"),
      body
    );
    const { status, stderr } = runValidator(dir);
    assert.equal(status, 1, "expected exit 1 for empty AC bullet");
    assert.match(stderr, /AC-1/, "stderr must name the empty AC bullet");
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: completed/ slices are NOT scanned", async () => {
  const dir = await makeFixture("vs-completed-skip-");
  try {
    await fs.mkdir(path.join(dir, "docs", "ai-loop", "slices", "completed"), { recursive: true });
    const body = ["## Acceptance criteria", "", "- [ ] AC-1: ...", ""].join("\n");
    await fs.writeFile(
      path.join(dir, "docs", "ai-loop", "slices", "completed", "SLICE_88_OLD.md"),
      body
    );
    const { status } = runValidator(dir);
    assert.equal(status, 0, "expected exit 0 — completed slices are immutable history");
  } finally {
    await cleanup(dir);
  }
});

test("validate-slices: missing slices dir exits 0", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vs-missing-"));
  try {
    const { status } = runValidator(dir);
    assert.equal(status, 0, "expected exit 0 when docs/ai-loop/slices/pending is absent");
  } finally {
    await cleanup(dir);
  }
});
