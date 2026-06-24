/**
 * tests/render-universal-skills.test.ts — FEAT-153 SLICE-76
 *
 * Tests for scripts/render-universal-skills.ts:
 *   - Determinism: same fixtures → same body + hash
 *   - Compression: each source section ≤ 12 lines
 *   - Body cap: body > 35 lines throws RenderedBodyTooLargeError
 *   - Idempotency: --inject twice → zero file change
 *   - Drift detection: mutated block → drift: true
 *   - No-marker case: agent with no marker → drift: true, found: null
 *   - Source missing: bad --sources-root → SourceSkillNotFoundError
 */
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  renderUniversals,
  checkUniversalsHash,
  RenderedBodyTooLargeError
} from "../scripts/render-universal-skills.ts";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "fixtures", "universals");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "render-universal-skills.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadFixtureContents(): Promise<{
  usingSuperpowers: string;
  verificationBeforeCompletion: string;
  loopDiscipline: string;
}> {
  const [usingSuperpowers, verificationBeforeCompletion, loopDiscipline] = await Promise.all([
    fs.readFile(path.join(FIXTURES_DIR, "using-superpowers.SKILL.md"), "utf8"),
    fs.readFile(path.join(FIXTURES_DIR, "verification-before-completion.SKILL.md"), "utf8"),
    fs.readFile(path.join(FIXTURES_DIR, "loop-discipline.SKILL.md"), "utf8")
  ]);
  if (!usingSuperpowers || !verificationBeforeCompletion || !loopDiscipline) {
    throw new Error("Missing fixture files");
  }
  return { usingSuperpowers, verificationBeforeCompletion, loopDiscipline };
}

function makeFixtureSources() {
  return {
    usingSuperpowers: path.join(FIXTURES_DIR, "using-superpowers.SKILL.md"),
    verificationBeforeCompletion: path.join(
      FIXTURES_DIR,
      "verification-before-completion.SKILL.md"
    ),
    loopDiscipline: path.join(FIXTURES_DIR, "loop-discipline.SKILL.md")
  };
}

function runScript(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", SCRIPT_PATH, ...args], {
    encoding: "utf8",
    cwd: REPO_ROOT
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 0
  };
}

async function makeTempAgentFile(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "render-universals-"));
  const filePath = path.join(dir, "test-agent.md");
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

const MINIMAL_AGENT = `---
name: test-agent
description: Test agent for render-universal-skills tests.
model: sonnet
---
## Custom instructions

You are the test-agent on a Claude Code engineering team.

## Report contract

Write your handoff via write-handoff.
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

test("AC-2a: renderUniversals returns deterministic body across two calls", async () => {
  const contents = await loadFixtureContents();
  const sources = makeFixtureSources();

  const result1 = renderUniversals({ sources, contents });
  const result2 = renderUniversals({ sources, contents });

  expect(result1.body).toBe(result2.body);
  expect(result1.hash).toBe(result2.hash);
});

test("AC-2b: hash is 64-char lowercase hex", async () => {
  const contents = await loadFixtureContents();
  const sources = makeFixtureSources();

  const { hash } = renderUniversals({ sources, contents });

  expect(hash).toMatch(/^[0-9a-f]{64}$/);
});

test("AC-2c: rendered body is ≤ 35 lines", async () => {
  const contents = await loadFixtureContents();
  const sources = makeFixtureSources();

  const { body } = renderUniversals({ sources, contents });
  const lines = body.split("\n").length;

  expect(lines).toBeLessThanOrEqual(35);
});

test("AC-2d: compression rule — each source section ≤ 12 lines (excluding ### header)", async () => {
  const contents = await loadFixtureContents();
  const sources = makeFixtureSources();

  const { body } = renderUniversals({ sources, contents });
  const lines = body.split("\n");

  // Find sections by ### headers
  const sectionStarts = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.startsWith("### "));

  // Each section's content (between its start and next ### or end) ≤ 12 non-blank lines
  for (let si = 0; si < sectionStarts.length; si++) {
    const start = (sectionStarts[si]?.i ?? 0) + 1;
    const end = sectionStarts[si + 1]?.i ?? lines.length;
    const sectionLines = lines.slice(start, end).filter((l) => l.trim() !== "");
    expect(sectionLines.length).toBeLessThanOrEqual(12);
  }
});

test("body cap: RenderedBodyTooLargeError thrown when rendered body > 35 lines", () => {
  // Craft content that produces > 35 MUST-bearing lines
  const manyMusts = Array.from({ length: 20 }, (_, i) => `You MUST do step ${i + 1}.\n`).join("");
  const bigContent = `---\nname: big\n---\n## Section A\n${manyMusts}\n## Section B\n${manyMusts}`;

  const sources = makeFixtureSources();
  const contents = {
    usingSuperpowers: bigContent,
    verificationBeforeCompletion: bigContent,
    loopDiscipline: bigContent
  };

  expect(() => renderUniversals({ sources, contents })).toThrow(RenderedBodyTooLargeError);
});

test("AC-3: --inject is idempotent (byte-equal on second run)", async () => {
  const agentPath = await makeTempAgentFile(MINIMAL_AGENT);

  // First inject
  const run1 = runScript(["--inject", agentPath, "--sources-root", FIXTURES_DIR]);
  expect(run1.exitCode).toBe(0);

  const bytes1 = await fs.readFile(agentPath);

  // Second inject
  const run2 = runScript(["--inject", agentPath, "--sources-root", FIXTURES_DIR]);
  expect(run2.exitCode).toBe(0);

  const bytes2 = await fs.readFile(agentPath);
  expect(Buffer.compare(bytes1, bytes2)).toBe(0);
});

test("AC-3b: injected file has exactly one BEGIN marker", async () => {
  const agentPath = await makeTempAgentFile(MINIMAL_AGENT);

  runScript(["--inject", agentPath, "--sources-root", FIXTURES_DIR]);

  const content = await fs.readFile(agentPath, "utf8");
  const matches = content.match(/<!-- pre-loaded-universals:BEGIN/g);
  expect(matches?.length).toBe(1);
});

test(
  "AC-4: --check exits 1 and reports drift when stored hash is mutated",
  async () => {
    const agentPath = await makeTempAgentFile(MINIMAL_AGENT);

    // Inject first
    runScript(["--inject", agentPath, "--sources-root", FIXTURES_DIR]);

    // Mutate the hash stored in the BEGIN marker (simulates someone bumping sources without re-injecting)
    const content = await fs.readFile(agentPath, "utf8");
    // Replace hash in BEGIN comment with all-zeros (clearly wrong)
    const mutated = content.replace(
      /<!-- pre-loaded-universals:BEGIN hash=[0-9a-f]{64} -->/,
      `<!-- pre-loaded-universals:BEGIN hash=${"0".repeat(64)} -->`
    );
    await fs.writeFile(agentPath, mutated, "utf8");

    const result = runScript(["--check", agentPath, "--sources-root", FIXTURES_DIR]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`RENDER-UNIVERSALS drift: ${agentPath}`);
    expect(result.stderr).toContain("expected=");
    expect(result.stderr).toContain("found=");
  },
  // Spawns `bun run` twice (inject + check) inside an already-spawned bun:test
  // worker. Under parallel CI load the cold-start cost stacks; the suite-level
  // 30s timeout was flaking on GH ubuntu-latest (FEAT — flake-render-universal-skills).
  60000
);

test("drift detection: checkUniversalsHash returns drift:true for mutated hash", async () => {
  const contents = await loadFixtureContents();
  const sources = makeFixtureSources();
  const { hash } = renderUniversals({ sources, contents });

  // Build a fake agent with a wrong hash in the marker
  const fakeHash = "a".repeat(64);
  const agentWithWrongHash = `---
name: test
description: t
model: sonnet
---
<!-- pre-loaded-universals:BEGIN hash=${fakeHash} -->
## Pre-loaded universals

some content
<!-- pre-loaded-universals:END -->
## Body
`;

  const result = checkUniversalsHash(agentWithWrongHash, hash);
  expect(result.drift).toBe(true);
  expect(result.expected).toBe(hash);
  expect(result.found).toBe(fakeHash);
});

test("no-marker case: checkUniversalsHash returns drift:true, found:null", () => {
  const agentWithNoMarker = `---
name: test
description: t
model: sonnet
---
## Body

Some content with no marker.
`;
  const result = checkUniversalsHash(agentWithNoMarker, "a".repeat(64));
  expect(result.drift).toBe(true);
  expect(result.found).toBeNull();
});

test("source missing: SourceSkillNotFoundError thrown for bad sources-root", () => {
  // renderUniversals itself requires contents — test the CLI path via spawnSync
  const result = runScript(["--render-only", "--sources-root", "/nonexistent/path"]);
  // Exit code 3 = source missing
  expect(result.exitCode).toBe(3);
  expect(result.stderr).toContain("RENDER-UNIVERSALS source missing:");
});

test("--render-only prints body to stdout and hash to stderr", async () => {
  const result = runScript(["--render-only", "--sources-root", FIXTURES_DIR]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim().length).toBeGreaterThan(0);
  expect(result.stderr).toContain("RENDER-UNIVERSALS rendered:");
  expect(result.stderr).toContain("hash=");
  expect(result.stderr).toContain("lines=");
});
