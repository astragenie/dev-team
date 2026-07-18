import { test, expect } from "bun:test";
// tests/hooks/pre-tool-use-artifact-lock.test.ts
// dev-team#257 piece 2 — PreToolUse Write|Edit artifact-lock enforcement.
// Contract: runner-plugin's
// docs/upstream-requests/2026-07-18-crew-artifact-lock-hook-contract.md.
// mkdtemp-repo shape mirrors tests/check-builder-terminal-state.test.ts.
// Uses bun:test (not node:test) to avoid
// https://github.com/oven-sh/bun/issues/5090 (node:test's "test() inside
// another test()" false positive when multiple node:test files execute
// concurrently in the same Bun worker — reproduced locally running the full
// `tests/` suite with these files under node:test).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  runArtifactLockHook,
  readActiveLocks,
  findMatchingLock,
  isLockExpired,
  normalizeLockPath,
  toRepoRelative
} from "../../hooks/lib/pre-tool-use-artifact-lock.ts";

async function makeRepo(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "artifact-lock-test-"));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

async function writeLock(
  repo: string,
  sliceId: string,
  lock: Record<string, unknown>
): Promise<void> {
  const dir = path.join(repo, ".claude", "state", "loop", "artifact-locks");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${sliceId}.json`), JSON.stringify(lock), "utf8");
}

function payload(opts: {
  session_id?: string;
  cwd: string;
  tool_name: string;
  file_path?: string;
}): string {
  const obj: Record<string, unknown> = {
    session_id: opts.session_id ?? "sess-1",
    cwd: opts.cwd,
    tool_name: opts.tool_name,
    tool_input: opts.file_path === undefined ? {} : { file_path: opts.file_path }
  };
  return JSON.stringify(obj);
}

const LOCKED_REL_PATH = ".claude/artifacts/crew/validations/plan-slice-4.md";

// (a) lock present, path matches → warn (default warn-only mode)
test("locked path matched → warn (default warn-only mode)", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-4", {
      sliceId: "SLICE-4",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: new Date().toISOString()
    });
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out as string);
    expect(parsed.decision).toBeUndefined();
    expect(parsed.systemMessage).toMatch(/qa-gate/);
    expect(parsed.systemMessage).toMatch(/SLICE-4/);
  } finally {
    await cleanup(repo);
  }
});

// (b) lock present + artifact-lock feature enabled → deny
test("locked path matched + artifact-lock feature enabled → deny", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-4", {
      sliceId: "SLICE-4",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: new Date().toISOString()
    });
    const crewDir = path.join(repo, ".claude");
    await fs.mkdir(crewDir, { recursive: true });
    await fs.writeFile(
      path.join(crewDir, "crew.json"),
      JSON.stringify({ features: { "artifact-lock": { enabled: true } } }),
      "utf8"
    );
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Edit", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out as string);
    expect(parsed.decision).toBe("block");
    expect(parsed.reason).toMatch(/qa-gate/);
    expect(parsed.reason).toMatch(/SLICE-4/);
  } finally {
    await cleanup(repo);
  }
});

// (c) lock expired via explicit expiresAt → allow
test("lock past explicit expiresAt → allow", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-5", {
      sliceId: "SLICE-5",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString()
    });
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (d) lock older than the 48h default TTL, no expiresAt → orphan, allow
test("lock older than 48h default TTL with no expiresAt → orphan, allow", async () => {
  const repo = await makeRepo();
  try {
    const staleCreatedAt = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    await writeLock(repo, "SLICE-6", {
      sliceId: "SLICE-6",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: staleCreatedAt
    });
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (e) malformed lock file (missing required field) → allow
test("malformed lock file → allow (fail-open)", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-7", {
      sliceId: "SLICE-7",
      // lockedPaths missing
      lockedBy: "qa-gate",
      createdAt: new Date().toISOString()
    });
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (f) unparseable lock file JSON → allow, doesn't throw or skip the whole scan
test("unreadable/unparseable lock file JSON → allow, no throw", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "loop", "artifact-locks");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "SLICE-8.json"), "{ not json", "utf8");
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (g) no lock dir at all → allow
test("no lock dir → allow", async () => {
  const repo = await makeRepo();
  try {
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (h) lock present but the edited path does NOT match any lockedPaths entry → allow
test("lock present, edited path not in lockedPaths → allow", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-4", {
      sliceId: "SLICE-4",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: new Date().toISOString()
    });
    const filePath = path.join(repo, "src", "unrelated.ts");
    const raw = payload({ cwd: repo, tool_name: "Write", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (i) non-Write/Edit tool (e.g. Read) → pass through untouched
test("non-Write/Edit tool_name → pass through, untouched", async () => {
  const repo = await makeRepo();
  try {
    await writeLock(repo, "SLICE-4", {
      sliceId: "SLICE-4",
      lockedPaths: [LOCKED_REL_PATH],
      lockedBy: "qa-gate",
      createdAt: new Date().toISOString()
    });
    const filePath = path.join(repo, LOCKED_REL_PATH);
    const raw = payload({ cwd: repo, tool_name: "Read", file_path: filePath });
    const out = await runArtifactLockHook(raw);
    expect(out).toBeNull();
  } finally {
    await cleanup(repo);
  }
});

// (j) malformed JSON input → pass, no throw
test("malformed JSON input → pass, no throw", async () => {
  const out = await runArtifactLockHook("not json");
  expect(out).toBeNull();
});

// Pure-function unit coverage
test("normalizeLockPath collapses backslashes and a leading ./", () => {
  expect(normalizeLockPath(".\\.claude\\artifacts\\crew\\validations\\plan.md")).toBe(
    ".claude/artifacts/crew/validations/plan.md"
  );
  expect(normalizeLockPath("./foo/bar.md")).toBe("foo/bar.md");
});

test("toRepoRelative resolves an absolute path under cwd to a normalized repo-relative path", () => {
  const cwd = path.join(os.tmpdir(), "repo-root");
  const abs = path.join(cwd, "a", "b.md");
  expect(toRepoRelative(cwd, abs)).toBe("a/b.md");
});

test("isLockExpired: no expiresAt, fresh createdAt → not expired", () => {
  const lock = {
    sliceId: "S",
    lockedPaths: [],
    lockedBy: "x",
    createdAt: new Date().toISOString()
  };
  expect(isLockExpired(lock, Date.now())).toBe(false);
});

test("findMatchingLock matches on normalized path across multiple locks", () => {
  const locks = [
    {
      sliceId: "SLICE-1",
      lockedPaths: ["a/one.md"],
      lockedBy: "x",
      createdAt: new Date().toISOString()
    },
    {
      sliceId: "SLICE-2",
      lockedPaths: [".\\a\\two.md"],
      lockedBy: "y",
      createdAt: new Date().toISOString()
    }
  ];
  const match = findMatchingLock(locks, "a/two.md");
  expect(match).not.toBeNull();
  expect(match?.lock.sliceId).toBe("SLICE-2");
});

test("readActiveLocks returns [] for a repo with no lock dir", async () => {
  const repo = await makeRepo();
  try {
    const locks = await readActiveLocks(repo);
    expect(locks).toEqual([]);
  } finally {
    await cleanup(repo);
  }
});
