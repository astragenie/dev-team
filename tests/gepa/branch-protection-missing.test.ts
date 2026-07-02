/**
 * tests/gepa/branch-protection-missing.test.ts — SLICE-105
 *
 * Covers AC-2 and AC-3:
 *   AC-2: enforced branch protection → checkBranchProtection returns
 *         { enforced: true, requiredChecks: [...] } and auto-pr.ts does NOT use --draft.
 *   AC-3: 404 (no protection) → checkBranchProtection returns { enforced: false }
 *         and the PR is opened with --draft + gepa_branch_protection_missing event.
 *
 * Tests use a mocked `gh` shim script (spawned as a child process) to avoid
 * needing a real GitHub token.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkBranchProtection,
  GhAbsentError,
  GhApiError
} from "../../scripts/lib/gepa/branch-protection-check.ts";

// ── Shim helpers ──────────────────────────────────────────────────────────────

/**
 * Write a `gh` shim backed by a Node.js .mjs script.
 * On Windows, adds a .cmd wrapper that calls `node gh-impl.mjs %*`.
 * On POSIX, writes a shell script that calls `node gh-impl.mjs "$@"`.
 *
 * The shim matches the joined argv string against `matchArgs` (substring)
 * and returns the first matching response.
 */
function writeGhShim(
  dir: string,
  responses: Array<{
    matchArgs?: string; // substring to match in the joined args
    exitCode: number;
    stdout: string;
    stderr?: string;
  }>
): string {
  mkdirSync(dir, { recursive: true });

  const responsesJson = JSON.stringify(responses);
  const mjsPath = join(dir, "gh-impl.mjs");
  const mjsScript = [
    `const args = process.argv.slice(2).join(" ");`,
    `const responses = ${responsesJson};`,
    `for (const r of responses) {`,
    `  if (!r.matchArgs || args.includes(r.matchArgs)) {`,
    `    if (r.stdout) process.stdout.write(r.stdout);`,
    `    if (r.stderr) process.stderr.write(r.stderr || "");`,
    `    process.exit(r.exitCode);`,
    `  }`,
    `}`,
    `process.exit(1);`
  ].join("\n");
  writeFileSync(mjsPath, mjsScript, "utf8");

  if (process.platform === "win32") {
    // .cmd wrapper — must use `node` (not bun) so spawnSync("gh.cmd") resolves.
    const cmdPath = join(dir, "gh.cmd");
    writeFileSync(cmdPath, `@node "${mjsPath}" %*\r\n`, "utf8");
    return cmdPath;
  }

  // POSIX shell wrapper.
  const shimPath = join(dir, "gh");
  writeFileSync(shimPath, `#!/bin/sh\nexec node "${mjsPath}" "$@"\n`, { mode: 0o755 });
  return shimPath;
}

// ── Test setup ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "bp-check-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── AC-2: enforced protection ─────────────────────────────────────────────────

describe("checkBranchProtection — AC-2 enforced protection", () => {
  it("returns enforced:true and requiredChecks from the protection response", () => {
    const shimDir = join(tmpDir, "bin");
    // The protection endpoint returns a response with required_status_checks.
    const protectionResponse = JSON.stringify({
      required_status_checks: {
        strict: true,
        contexts: ["ci/build", "ci/test"],
        checks: [
          { context: "ci/build", app_id: null },
          { context: "ci/test", app_id: 42 }
        ]
      },
      enforce_admins: { enabled: true, url: "" },
      required_pull_request_reviews: null,
      restrictions: null
    });

    writeGhShim(shimDir, [
      {
        matchArgs: "branches/main/protection",
        exitCode: 0,
        stdout: protectionResponse
      }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = checkBranchProtection({
      repo: "myorg/myrepo",
      ghPath
    });

    expect(result.enforced).toBe(true);
    expect(result.requiredChecks).toContain("ci/build");
    expect(result.requiredChecks).toContain("ci/test");
  });

  it("falls back to contexts[] when checks[] is absent", () => {
    const shimDir = join(tmpDir, "bin2");
    const protectionResponse = JSON.stringify({
      required_status_checks: {
        strict: false,
        contexts: ["lint", "unit-tests"],
        checks: [] // empty — fall back to contexts
      }
    });

    writeGhShim(shimDir, [
      {
        matchArgs: "branches/main/protection",
        exitCode: 0,
        stdout: protectionResponse
      }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = checkBranchProtection({ repo: "myorg/myrepo", ghPath });

    expect(result.enforced).toBe(true);
    expect(result.requiredChecks).toContain("lint");
    expect(result.requiredChecks).toContain("unit-tests");
  });
});

// ── AC-3: no protection (404) ─────────────────────────────────────────────────

describe("checkBranchProtection — AC-3 missing protection (404)", () => {
  it("gh api returns 404 (Not Found) → enforced:false, requiredChecks:[]", () => {
    const shimDir = join(tmpDir, "bin3");
    writeGhShim(shimDir, [
      {
        matchArgs: "branches/main/protection",
        exitCode: 1,
        stdout: '{"message":"Not Found"}',
        stderr: "Not Found\n"
      }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = checkBranchProtection({ repo: "myorg/myrepo", ghPath });

    expect(result.enforced).toBe(false);
    expect(result.requiredChecks).toHaveLength(0);
  });

  it("no required_status_checks in response → enforced:false", () => {
    const shimDir = join(tmpDir, "bin4");
    // Branch exists but has no required status checks configured.
    const protectionResponse = JSON.stringify({
      url: "https://api.github.com/repos/myorg/myrepo/branches/main/protection",
      required_pull_request_reviews: null,
      restrictions: null
      // required_status_checks intentionally absent
    });
    writeGhShim(shimDir, [
      {
        matchArgs: "branches/main/protection",
        exitCode: 0,
        stdout: protectionResponse
      }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    const result = checkBranchProtection({ repo: "myorg/myrepo", ghPath });

    expect(result.enforced).toBe(false);
    expect(result.requiredChecks).toHaveLength(0);
  });
});

// ── GhAbsentError ─────────────────────────────────────────────────────────────

describe("checkBranchProtection — gh absent", () => {
  it("throws GhAbsentError when gh binary does not exist", () => {
    let threw = false;
    let thrownErr: unknown;
    try {
      checkBranchProtection({
        repo: "myorg/myrepo",
        ghPath: join(tmpDir, "nonexistent-gh-binary")
      });
    } catch (err) {
      threw = true;
      thrownErr = err;
    }
    expect(threw).toBe(true);
    expect(thrownErr).toBeInstanceOf(GhAbsentError);
  });
});

// ── GhApiError (non-404 failure) ──────────────────────────────────────────────

describe("checkBranchProtection — unexpected gh error", () => {
  it("throws GhApiError on non-404 non-zero exit", () => {
    const shimDir = join(tmpDir, "bin5");
    writeGhShim(shimDir, [
      {
        matchArgs: "branches/main/protection",
        exitCode: 1,
        stdout: "",
        stderr: "API rate limit exceeded\n"
      }
    ]);

    const ghPath = join(shimDir, process.platform === "win32" ? "gh.cmd" : "gh");
    let threw = false;
    let thrownErr: unknown;
    try {
      checkBranchProtection({ repo: "myorg/myrepo", ghPath });
    } catch (err) {
      threw = true;
      thrownErr = err;
    }
    expect(threw).toBe(true);
    expect(thrownErr).toBeInstanceOf(GhApiError);
  });
});
