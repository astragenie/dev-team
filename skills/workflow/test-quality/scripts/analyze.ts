#!/usr/bin/env bun
/**
 * Test-quality lens — Lens 1 (flaky-test) + Lens 2 (anti-pattern).
 * Lens 3 (mutation-testing) is procedural prose in SKILL.md only.
 * Usage: bun analyze.ts --target <path> [--changed-only] [--diff-base <ref>] [--emit-observability]
 * Exit:  0 = zero HIGH, 1 = ≥1 HIGH, 2 = scan failure
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

type Sev = "HIGH" | "MEDIUM" | "ADVISORY";
interface Finding { severity: Sev; file: string; line: number; description: string; }

const TEST_FILE_RE = /\.(test|spec|fixture)\.[jt]sx?$|_test\.py$|^test_.*\.py$/;

// Lens 1 — hard flaky patterns → HIGH
const FLAKY_HARD: Array<{ label: string; re: RegExp }> = [
  { label: "Zero-delay timer",             re: /setTimeout\s*\(.*,\s*0\s*\)/ },
  { label: "Hard-coded sleep",             re: /await\s+new\s+Promise\s*\(.*setTimeout|sleep\s*\(\s*\d+\s*\)/ },
  { label: "Micro-task hop",              re: /await\s+Promise\.resolve\s*\(\s*\)/ },
  { label: "Wall-clock dependence",        re: /\bDate\.now\s*\(\s*\)|(?<!\w)new Date\s*\(\s*\)/ },
  { label: "Non-deterministic random",    re: /\bMath\.random\s*\(\s*\)/ },
  // MF-2: env-leak allowlists CI / NODE_ENV / TEST_* / BUN_* / DEBUG (legitimate test config).
  { label: "Env leak (process.env read)", re: /process\.env\.(?!(?:CI|NODE_ENV|TEST_[A-Z_]*|BUN_[A-Z_]*|DEBUG)\b)[A-Z][A-Z_]*/ },
];
// Lens 1 — shared module-scope let/var at column 0 → HIGH
const SHARED_STATE_RE = /^(?:let|var)\s+\w+/;
// Lens 1 — soft flaky name → MEDIUM
const FLAKY_NAME_RE = /\b(eventually|sometimes|flak|timing)\b/i;
// Lens 2 — assertion-free (no expect/assert in body)
// Matches: `expect(`, `expect.`, `assert(`, `assert.ok(`, `assert.equal(`, `should(`,
// `should.be`, `t.equal(`, `t.ok(`, jest/vitest matcher tokens (`toBe`, `toEqual`, etc.).
const ASSERTION_RE = /\b(?:expect|assert|should|t)\s*[.(]|\b(?:toBe|toEqual|toHave|toBeTruthy|toBeFalsy|toThrow|toBeGreaterThan|toBeLessThan|toContain|toMatch|toThrowError|resolves|rejects)\s*\(/;
// Lens 2 — tautological asserts
const TAUTOLOGY_RES: RegExp[] = [
  /expect\s*\(\s*true\s*\)\.toBe\s*\(\s*true\s*\)/,
  /expect\s*\(\s*false\s*\)\.toBe\s*\(\s*false\s*\)/,
  /expect\s*\(\s*(\d+)\s*\)\.toBe\s*\(\s*\1\s*\)/,
  /expect\s*\(\s*"([^"]+)"\s*\)\.toBe\s*\(\s*"\1"\s*\)/,
  /expect\s*\(\s*'([^']+)'\s*\)\.toBe\s*\(\s*'\1'\s*\)/,
];
// Lens 2 — over-mocking ≥5 per test body: jest/vi/mock framework calls OR bun mock() direct calls
const MOCK_RE = /\b(?:jest|vi)\s*\.\s*(?:mock|fn|spyOn)\s*\(|\bmock\s*\(/g;

function shell(cmd: string, cwd: string): string {
  try { return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe","pipe","pipe"] }); }
  catch (err) {
    if (err !== null && typeof err === "object" && "stdout" in err && typeof (err as Record<string,unknown>).stdout === "string")
      return (err as { stdout: string }).stdout;
    return "";
  }
}

function parseArgs(argv: string[]): { target: string; changedOnly: boolean; diffBase: string; obs: boolean } {
  // MF-1: default to --changed-only (PR-review mode). Use --bulk to opt into full-tree scan.
  let target = process.cwd(), changedOnly = true, diffBase = "HEAD~1", obs = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target")            { const v = argv[++i]; if (v) target = v; }
    else if (argv[i] === "--changed-only") changedOnly = true;
    else if (argv[i] === "--bulk")         changedOnly = false;
    else if (argv[i] === "--diff-base")    { const v = argv[++i]; if (v) diffBase = v; }
    else if (argv[i] === "--emit-observability") obs = true;
  }
  return { target, changedOnly, diffBase, obs };
}

function allTestFiles(dir: string): string[] {
  const out: string[] = [];
  function walk(d: string): void {
    let ents: fs.Dirent[];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && TEST_FILE_RE.test(e.name)) out.push(full);
    }
  }
  walk(dir);
  return out;
}

/** Extract test(...) / it(...) bodies with nesting via brace-counting */
function extractTests(src: string): Array<{ name: string; body: string; startLine: number }> {
  const out: Array<{ name: string; body: string; startLine: number }> = [];
  const re = /\b(?:test|it)\s*\(\s*(['"`])([\s\S]*?)\1\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
    out.push({ name: m[2] ?? "", body: src.slice(start, i - 1), startLine: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

function scanFile(abs: string, rel: string): Finding[] {
  let src: string;
  try { src = fs.readFileSync(abs, "utf8"); } catch { return []; }
  const findings: Finding[] = [];
  const lines = src.split("\n");

  // Line-by-line: hard flaky patterns
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] ?? "";
    for (const { label, re } of FLAKY_HARD) {
      if (re.test(ln)) { findings.push({ severity: "HIGH", file: rel, line: i+1, description: `Flaky heuristic: ${label}` }); break; }
    }
    // Shared module-scope mutable variable
    if (SHARED_STATE_RE.test(ln)) findings.push({ severity: "HIGH", file: rel, line: i+1, description: "Flaky heuristic: shared module-scope mutable variable (let/var at top level)" });
  }

  // Per-test-body checks
  for (const { name, body, startLine } of extractTests(src)) {
    if (FLAKY_NAME_RE.test(name))
      findings.push({ severity: "MEDIUM", file: rel, line: startLine, description: `Soft flaky signal: test name matches flakiness keyword ("${name}")` });
    if (!ASSERTION_RE.test(body))
      findings.push({ severity: "HIGH", file: rel, line: startLine, description: `Assertion-free test: "${name}"` });
    if (TAUTOLOGY_RES.some((r) => r.test(body)))
      findings.push({ severity: "HIGH", file: rel, line: startLine, description: `Tautological assert in test: "${name}"` });
    const mocks = body.match(MOCK_RE);
    if (mocks && mocks.length >= 5)
      findings.push({ severity: "MEDIUM", file: rel, line: startLine, description: `Over-mocking: ${mocks.length} mock calls in test "${name}"` });
  }
  return findings;
}

async function main(): Promise<void> {
  const { target, changedOnly, diffBase, obs } = parseArgs(process.argv.slice(2));

  let files: string[];
  if (changedOnly) {
    const changed = shell(`git diff --name-only ${diffBase}`, target).split("\n").map((l) => l.trim()).filter(Boolean);
    files = changed.filter((f) => TEST_FILE_RE.test(path.basename(f))).map((f) => path.isAbsolute(f) ? f : path.join(target, f));
  } else {
    files = allTestFiles(target);
  }

  const all: Finding[] = [];
  for (const abs of files) all.push(...scanFile(abs, path.relative(target, abs)));

  for (const f of all) process.stdout.write(`[${f.severity}] ${f.file}:${f.line} — ${f.description}\n`);

  if (obs) {
    const h = all.filter((f) => f.severity === "HIGH").length;
    const m = all.filter((f) => f.severity === "MEDIUM").length;
    const a = all.filter((f) => f.severity === "ADVISORY").length;
    process.stderr.write(`TEST-QUALITY analyze complete: ${all.length} findings (H=${h} M=${m} L=0 A=${a})\n`);
  }

  process.exitCode = all.some((f) => f.severity === "HIGH") ? 1 : 0;
}

await main().catch((err) => {
  process.stderr.write(`TEST-QUALITY scan failed: ${String(err)}\n`);
  process.exitCode = 2;
});
