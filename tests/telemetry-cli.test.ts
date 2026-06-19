/**
 * Tests for scripts/cost-report-to-spans.ts (CLI end-to-end).
 * AC-5, AC-6, AC-7.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { SpanRecordSchema } from "../scripts/lib/telemetry/span.ts";

const REAL_FIXTURE = path.resolve(
  ".claude/artifacts/crew/cost/20260607T122544Z-cost-report-slice-feat113-slice37.md"
);

const AGGREGATE_FIXTURE = path.resolve(
  ".claude/artifacts/crew/cost/20260602T133012Z-cost-report-aggregate-feat034-slice13.md"
);

const CLI = path.resolve("./scripts/cost-report-to-spans.ts");

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): CliResult {
  const r = spawnSync("node", [CLI, ...args], { encoding: "utf8" });
  return {
    status: r.status,
    stdout: String(r.stdout ?? ""),
    stderr: String(r.stderr ?? "")
  };
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function makeTempDirs(): Promise<{ costDir: string; outDir: string; tmpRoot: string }> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "telemetry-cli-test-"));
  const costDir = path.join(tmpRoot, "cost");
  const outDir = path.join(tmpRoot, "spans");
  await fs.mkdir(costDir, { recursive: true });
  return { costDir, outDir, tmpRoot };
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 1: CLI writes valid JSONL from real fixture
// ---------------------------------------------------------------------------

test("telemetry-cli: writes valid JSONL for real FEAT113/SLICE37 fixture", async () => {
  const { costDir, outDir, tmpRoot } = await makeTempDirs();
  try {
    // Seed temp dir with real fixture
    const fixtureContent = await fs.readFile(REAL_FIXTURE, "utf8");
    await fs.writeFile(
      path.join(costDir, "20260607T122544Z-cost-report-slice-feat113-slice37.md"),
      fixtureContent,
      "utf8"
    );

    const result = runCli(["--cost-dir", costDir, "--out-dir", outDir, "--only", "*feat113*"]);

    assert.equal(
      result.status,
      0,
      `CLI must exit 0, got ${result.status}. stderr: ${result.stderr}`
    );

    const outFile = path.join(outDir, "20260607T122544Z.jsonl");
    const content = await fs.readFile(outFile, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    assert.equal(lines.length, 3, "Output file must have exactly 3 lines (3 spans)");

    for (const line of lines) {
      const parsed = JSON.parse(line);
      const span = SpanRecordSchema.parse(parsed);
      assert.ok(span.traceId, "each span must have a traceId");
    }
  } finally {
    await cleanup(tmpRoot);
  }
});

// ---------------------------------------------------------------------------
// Case 2: Running CLI twice produces byte-identical output (idempotency)
// ---------------------------------------------------------------------------

test("telemetry-cli: two runs produce byte-identical output", async () => {
  const { costDir, outDir, tmpRoot } = await makeTempDirs();
  try {
    const fixtureContent = await fs.readFile(REAL_FIXTURE, "utf8");
    await fs.writeFile(
      path.join(costDir, "20260607T122544Z-cost-report-slice-feat113-slice37.md"),
      fixtureContent,
      "utf8"
    );

    const cliArgs = ["--cost-dir", costDir, "--out-dir", outDir, "--only", "*feat113*"];

    const r1 = runCli(cliArgs);
    assert.equal(r1.status, 0, `First run must exit 0. stderr: ${r1.stderr}`);

    const outFile = path.join(outDir, "20260607T122544Z.jsonl");
    const content1 = await fs.readFile(outFile, "utf8");

    const r2 = runCli(cliArgs);
    assert.equal(r2.status, 0, `Second run must exit 0. stderr: ${r2.stderr}`);

    const content2 = await fs.readFile(outFile, "utf8");
    assert.equal(content1, content2, "Output must be byte-identical across two runs");
  } finally {
    await cleanup(tmpRoot);
  }
});

// ---------------------------------------------------------------------------
// Case 3: --emit-observability flag behaviour
// ---------------------------------------------------------------------------

test("telemetry-cli: --emit-observability emits exactly one grep-able stderr line", async () => {
  const { costDir, outDir, tmpRoot } = await makeTempDirs();
  try {
    const fixtureContent = await fs.readFile(REAL_FIXTURE, "utf8");
    await fs.writeFile(
      path.join(costDir, "20260607T122544Z-cost-report-slice-feat113-slice37.md"),
      fixtureContent,
      "utf8"
    );

    // With --emit-observability: stderr must have exactly one matching line.
    const withFlag = runCli(["--cost-dir", costDir, "--out-dir", outDir, "--emit-observability"]);
    assert.equal(withFlag.status, 0, `Exit 0 expected. stderr: ${withFlag.stderr}`);
    const stderrLines = withFlag.stderr.trim().split("\n").filter(Boolean);
    assert.equal(
      stderrLines.length,
      1,
      `Expected exactly 1 stderr line, got: ${JSON.stringify(stderrLines)}`
    );
    assert.match(
      stderrLines[0]!,
      /^OTEL-BACKFILL wrote \d+ spans across \d+ runs$/,
      "stderr line must match pattern"
    );

    // Without flag: stderr must be empty for a clean run.
    const withoutFlag = runCli(["--cost-dir", costDir, "--out-dir", outDir]);
    assert.equal(
      withoutFlag.status,
      0,
      `Exit 0 expected without flag. stderr: ${withoutFlag.stderr}`
    );
    assert.equal(
      withoutFlag.stderr.trim(),
      "",
      "stderr must be empty when --emit-observability is not passed"
    );
  } finally {
    await cleanup(tmpRoot);
  }
});

// ---------------------------------------------------------------------------
// AC-6: Aggregate files are skipped (no double-counting)
// ---------------------------------------------------------------------------

test("telemetry-cli: aggregate files are skipped and produce no output", async () => {
  const { costDir, outDir, tmpRoot } = await makeTempDirs();
  try {
    // Write one slice file and one aggregate file
    const sliceContent = await fs.readFile(REAL_FIXTURE, "utf8");
    await fs.writeFile(
      path.join(costDir, "20260607T122544Z-cost-report-slice-feat113-slice37.md"),
      sliceContent,
      "utf8"
    );

    const aggregateContent = await fs.readFile(AGGREGATE_FIXTURE, "utf8");
    await fs.writeFile(
      path.join(costDir, "20260602T133012Z-cost-report-aggregate-feat034-slice13.md"),
      aggregateContent,
      "utf8"
    );

    const result = runCli(["--cost-dir", costDir, "--out-dir", outDir]);
    assert.equal(result.status, 0, `Exit 0 expected. stderr: ${result.stderr}`);

    const outEntries = await fs.readdir(outDir).catch(() => [] as string[]);
    // Only one JSONL file for the slice; aggregate should be skipped.
    assert.equal(outEntries.length, 1, "Only one JSONL file should be produced");
    assert.equal(
      outEntries[0],
      "20260607T122544Z.jsonl",
      "JSONL file must match slice run id, not aggregate"
    );
  } finally {
    await cleanup(tmpRoot);
  }
});
