# Cost-Hygiene Reread Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PreToolUse + PostToolUse hook pair on the `Read` tool that injects a `<system-reminder>` block (with prior content quoted) into the assistant's context whenever the same file is re-read in the same session and its mtime hasn't changed. The hook never blocks the Read; it only surfaces the prior content so the model uses it instead of issuing a redundant Read.

**Architecture:** Three boundaries: (1) `hooks/check-redundant-read.mjs` PreToolUse entry — stdin → load state → stat file → pure `decide()` → emit `{decision, systemMessage}` or empty → save state → exit 0; (2) `hooks/record-read-content.mjs` PostToolUse entry — captures Read content for next time; (3) two focused lib modules — `state.mjs` for fs IO + LRU eviction, `decide.mjs` for pure decision + warning formatting. State lives at `.claude/state/cost-hygiene/<session_id>.json` with per-file 50KB and per-session 2MB caps.

**Tech Stack:** Node.js ESM (`.mjs`), `node:fs/promises`, `node:path`, `node:os`, `node:test`. Zero third-party deps. ESLint flat config + Prettier on all new files. TypeScript checked via `tsc --noEmit` with `noImplicitAny: true` (per existing repo config).

**Spec:** `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md`

**File Structure:**

| File | Responsibility | Tests |
|---|---|---|
| `scripts/lib/cost-hygiene/decide.mjs` | Pure: `decide({path, storedEntry, currentMtime, currentSize, now})` → `{action, message}` + warning text formatter | `tests/cost-hygiene-decide.test.mjs` |
| `scripts/lib/cost-hygiene/state.mjs` | fs IO: `loadSession`, `saveSession`, `recordRead`, `recordReadContent`, LRU eviction, atomic write, stale temp cleanup | `tests/cost-hygiene-state.test.mjs` |
| `hooks/check-redundant-read.mjs` | PreToolUse entry. Env-var gated. Always exits 0 | `tests/cost-hygiene-hook.test.mjs` |
| `hooks/record-read-content.mjs` | PostToolUse entry. Env-var gated. Always exits 0 | (covered by state tests + spawn smoke) |
| `hooks/hooks.json` | Add PreToolUse + PostToolUse Read matchers | (covered by `validate-manifests.mjs`) |

**Dependency order**: Task 1 (decide.mjs) → Task 2 (state.mjs) — both independent; either can go first → Task 3 (PreToolUse hook depends on both) → Task 4 (PostToolUse hook depends on state) → Task 5 (hooks.json wires both) → Task 6 (integration test) → Task 7 (gates) → Task 8 (dogfood enable).

---

## Task 1: `decide.mjs` — pure decision module

**Files:**
- Create: `scripts/lib/cost-hygiene/decide.mjs`
- Test: `tests/cost-hygiene-decide.test.mjs`

- [ ] **Step 1: Write the failing test file**

```js
// tests/cost-hygiene-decide.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../scripts/lib/cost-hygiene/decide.mjs";

const T0 = "2026-05-28T18:00:00.000Z";
const T1 = "2026-05-28T18:05:00.000Z";
const NOW = "2026-05-28T18:10:00.000Z";

test("first read of path (no stored entry) → pass", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: null,
    currentMtime: T0,
    currentSize: 1000,
    now: NOW
  });
  assert.equal(result.action, "pass");
  assert.equal(result.message, null);
});

test("reread, mtime unchanged, content stored → warn with quoted content", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "hello world"
    },
    currentMtime: T0,
    currentSize: 100,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /<system-reminder>/);
  assert.match(result.message, /already loaded/);
  assert.match(result.message, /1 time/);
  assert.match(result.message, /Prior content:/);
  assert.match(result.message, /hello world/);
  assert.match(result.message, /Do not re-issue the Read/);
  assert.match(result.message, /<\/system-reminder>/);
});

test("reread, mtime newer than stored → pass (Q7 edit exception)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "old content"
    },
    currentMtime: T1,
    currentSize: 200,
    now: NOW
  });
  assert.equal(result.action, "pass");
  assert.equal(result.message, null);
});

test("5th reread, content stored → warn with read_count 4 in message", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 4,
      first_read_at: T0,
      last_read_at: T1,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "x"
    },
    currentMtime: T0,
    currentSize: 100,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /4 times/);
});

test("reread with content omitted (>50KB) → warn says content omitted with KB", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 87234,
      content_bytes: 0,
      content: null
    },
    currentMtime: T0,
    currentSize: 87234,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /content omitted, file size 87 KB/);
});

test("reread, mtime unchanged + size changed → warn (mtime is the gate)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "abc"
    },
    currentMtime: T0,
    currentSize: 150,
    now: NOW
  });
  assert.equal(result.action, "warn");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/cost-hygiene-decide.test.mjs`
Expected: 6 tests FAIL with `Cannot find module ... decide.mjs` (module does not exist yet).

- [ ] **Step 3: Create the `decide.mjs` module**

```js
// scripts/lib/cost-hygiene/decide.mjs

/**
 * @typedef {Object} StoredEntry
 * @property {number} read_count
 * @property {string} first_read_at
 * @property {string} last_read_at
 * @property {string} mtime_at_last_read
 * @property {number} size_at_last_read
 * @property {number} content_bytes
 * @property {string | null} content
 */

/**
 * @typedef {Object} DecideInput
 * @property {string} path
 * @property {StoredEntry | null} storedEntry
 * @property {string} currentMtime
 * @property {number} currentSize
 * @property {string} now
 */

/**
 * @typedef {Object} DecideResult
 * @property {"pass" | "warn"} action
 * @property {string | null} message
 */

/**
 * @param {StoredEntry} entry
 * @param {string} path
 * @returns {string}
 */
function formatWarning(entry, path) {
  const count = entry.read_count;
  const countLabel = count === 1 ? "1 time" : `${count} times`;
  const mtime = entry.mtime_at_last_read;
  const contentBlock =
    entry.content !== null
      ? `Prior content:\n\n${entry.content}\n\n`
      : `Prior content: (content omitted, file size ${Math.round(entry.size_at_last_read / 1024)} KB)\n\n`;
  return (
    `<system-reminder>You already loaded ${path} ${countLabel} this session. ` +
    `Content unchanged (mtime ${mtime}). ${contentBlock}` +
    `Do not re-issue the Read.</system-reminder>`
  );
}

/**
 * @param {DecideInput} input
 * @returns {DecideResult}
 */
export function decide(input) {
  const { path, storedEntry, currentMtime } = input;
  if (storedEntry === null) {
    return { action: "pass", message: null };
  }
  if (Date.parse(currentMtime) > Date.parse(storedEntry.mtime_at_last_read)) {
    return { action: "pass", message: null };
  }
  return { action: "warn", message: formatWarning(storedEntry, path) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cost-hygiene-decide.test.mjs`
Expected: 6/6 PASS.

- [ ] **Step 5: Run repo gates**

```bash
npm run typecheck
npm run lint
npm run format:check
```

Expected: all EXIT 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/cost-hygiene/decide.mjs tests/cost-hygiene-decide.test.mjs
git commit -m "feat(cost-hygiene): pure decide() for redundant-read detection

Adds scripts/lib/cost-hygiene/decide.mjs and 6 table-driven tests
covering Q1-Q7 brainstorming matrix: first read passes, reread with
unchanged mtime warns with content quoted, mtime-newer suppresses
warning, oversized-content path falls back to size-only message,
size-changed-but-mtime-unchanged still warns (mtime is the gate)."
```

---

## Task 2a: `state.mjs` — empty `loadSession`

**Files:**
- Create: `scripts/lib/cost-hygiene/state.mjs`
- Test: `tests/cost-hygiene-state.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/cost-hygiene-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSession } from "../scripts/lib/cost-hygiene/state.mjs";

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-"));
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

test("loadSession returns empty shape when file absent", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-abc");
    assert.equal(state.session_id, "sess-abc");
    assert.equal(state.total_bytes, 0);
    assert.deepEqual(state.entries, {});
    assert.ok(state.first_seen);
    assert.ok(state.last_seen);
  } finally {
    await cleanup(repo);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/cost-hygiene-state.test.mjs`
Expected: FAIL — `Cannot find module ... state.mjs`.

- [ ] **Step 3: Create `state.mjs` with `loadSession` only**

```js
// scripts/lib/cost-hygiene/state.mjs
import fs from "node:fs/promises";
import path from "node:path";

const STATE_DIR_REL = path.join(".claude", "state", "cost-hygiene");

/**
 * @typedef {Object} StoredEntry
 * @property {number} read_count
 * @property {string} first_read_at
 * @property {string} last_read_at
 * @property {string} mtime_at_last_read
 * @property {number} size_at_last_read
 * @property {number} content_bytes
 * @property {string | null} content
 */

/**
 * @typedef {Object} SessionState
 * @property {string} session_id
 * @property {string} first_seen
 * @property {string} last_seen
 * @property {number} total_bytes
 * @property {Record<string, StoredEntry>} entries
 */

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @returns {string}
 */
function statePath(repoPath, sessionId) {
  return path.join(repoPath, STATE_DIR_REL, `${sessionId}.json`);
}

/**
 * @param {string} sessionId
 * @returns {SessionState}
 */
function emptyState(sessionId) {
  const nowIso = new Date().toISOString();
  return {
    session_id: sessionId,
    first_seen: nowIso,
    last_seen: nowIso,
    total_bytes: 0,
    entries: {}
  };
}

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @returns {Promise<SessionState>}
 */
export async function loadSession(repoPath, sessionId) {
  const file = statePath(repoPath, sessionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = /** @type {SessionState} */ (JSON.parse(raw));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.session_id === "string" &&
      typeof parsed.entries === "object" &&
      parsed.entries !== null
    ) {
      return parsed;
    }
    return emptyState(sessionId);
  } catch {
    return emptyState(sessionId);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test tests/cost-hygiene-state.test.mjs`
Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cost-hygiene/state.mjs tests/cost-hygiene-state.test.mjs
git commit -m "feat(cost-hygiene): loadSession returns empty shape when file absent

Adds scripts/lib/cost-hygiene/state.mjs with loadSession() that
returns a fresh SessionState when no state file exists for the
session id. State path: .claude/state/cost-hygiene/<sid>.json."
```

---

## Task 2b: `saveSession` atomic write

- [ ] **Step 1: Add the failing test (append to `tests/cost-hygiene-state.test.mjs`)**

```js
import { saveSession } from "../scripts/lib/cost-hygiene/state.mjs";

test("saveSession then loadSession round-trip preserves entries", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-xyz");
    state.entries["/abs/foo"] = {
      read_count: 2,
      first_read_at: "2026-05-28T18:00:00.000Z",
      last_read_at: "2026-05-28T18:05:00.000Z",
      mtime_at_last_read: "2026-05-28T17:00:00.000Z",
      size_at_last_read: 100,
      content_bytes: 5,
      content: "hello"
    };
    state.total_bytes = 5;
    await saveSession(repo, "sess-xyz", state);
    const reloaded = await loadSession(repo, "sess-xyz");
    assert.equal(reloaded.entries["/abs/foo"].read_count, 2);
    assert.equal(reloaded.entries["/abs/foo"].content, "hello");
    assert.equal(reloaded.total_bytes, 5);
  } finally {
    await cleanup(repo);
  }
});

test("saveSession atomic — no .tmp.<pid> left on success", async () => {
  const repo = await makeRepo();
  try {
    const state = await loadSession(repo, "sess-tmp");
    await saveSession(repo, "sess-tmp", state);
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    const files = await fs.readdir(dir);
    const tempFiles = files.filter((f) => f.includes(".tmp."));
    assert.deepEqual(tempFiles, []);
  } finally {
    await cleanup(repo);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/cost-hygiene-state.test.mjs`
Expected: 2 new tests FAIL — `saveSession is not exported` (or not defined).

- [ ] **Step 3: Implement `saveSession` in `state.mjs`**

Append to `scripts/lib/cost-hygiene/state.mjs`:

```js
/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @param {SessionState} state
 * @returns {Promise<void>}
 */
export async function saveSession(repoPath, sessionId, state) {
  const file = statePath(repoPath, sessionId);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tempFile = `${file}.tmp.${process.pid}`;
  state.last_seen = new Date().toISOString();
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempFile, file);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/cost-hygiene-state.test.mjs`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cost-hygiene/state.mjs tests/cost-hygiene-state.test.mjs
git commit -m "feat(cost-hygiene): saveSession atomic write via .tmp.<pid> rename

Adds saveSession() that writes JSON to <path>.tmp.<pid> then renames
into place. Updates last_seen on every save. mkdir -p the parent dir
on first write."
```

---

## Task 2c: `recordRead` + `recordReadContent` + content cap

- [ ] **Step 1: Add failing tests**

Append to `tests/cost-hygiene-state.test.mjs`:

```js
import { recordRead, recordReadContent } from "../scripts/lib/cost-hygiene/state.mjs";

test("recordRead increments read_count, updates last_read_at, preserves first_read_at", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-rec");
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 100, "2026-05-28T18:00:00.000Z");
    assert.equal(state.entries["/abs/p"].read_count, 1);
    assert.equal(state.entries["/abs/p"].first_read_at, "2026-05-28T18:00:00.000Z");

    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 100, "2026-05-28T18:05:00.000Z");
    assert.equal(state.entries["/abs/p"].read_count, 2);
    assert.equal(state.entries["/abs/p"].first_read_at, "2026-05-28T18:00:00.000Z");
    assert.equal(state.entries["/abs/p"].last_read_at, "2026-05-28T18:05:00.000Z");
  } finally {
    await cleanup(repo);
  }
});

test("recordReadContent stores content when <=50KB, updates total_bytes", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-cnt");
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 5, "2026-05-28T18:00:00.000Z");
    state = recordReadContent(state, "/abs/p", "hello");
    assert.equal(state.entries["/abs/p"].content, "hello");
    assert.equal(state.entries["/abs/p"].content_bytes, 5);
    assert.equal(state.total_bytes, 5);
  } finally {
    await cleanup(repo);
  }
});

test("recordReadContent caps content at 50KB, sets content:null when oversized", async () => {
  const repo = await makeRepo();
  try {
    let state = await loadSession(repo, "sess-big");
    const big = "x".repeat(60_000);
    state = recordRead(state, "/abs/p", "2026-05-28T17:00:00.000Z", 60_000, "2026-05-28T18:00:00.000Z");
    state = recordReadContent(state, "/abs/p", big);
    assert.equal(state.entries["/abs/p"].content, null);
    assert.equal(state.entries["/abs/p"].content_bytes, 0);
    assert.equal(state.total_bytes, 0);
  } finally {
    await cleanup(repo);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Expected: 3 new tests FAIL — `recordRead is not exported`.

- [ ] **Step 3: Implement `recordRead` and `recordReadContent`**

Append to `scripts/lib/cost-hygiene/state.mjs`:

```js
const PER_FILE_CAP_BYTES = 50 * 1024;

/**
 * @param {SessionState} state
 * @param {string} filePath
 * @param {string} mtime
 * @param {number} size
 * @param {string} now
 * @returns {SessionState}
 */
export function recordRead(state, filePath, mtime, size, now) {
  const existing = state.entries[filePath];
  if (existing) {
    existing.read_count += 1;
    existing.last_read_at = now;
    existing.mtime_at_last_read = mtime;
    existing.size_at_last_read = size;
  } else {
    state.entries[filePath] = {
      read_count: 1,
      first_read_at: now,
      last_read_at: now,
      mtime_at_last_read: mtime,
      size_at_last_read: size,
      content_bytes: 0,
      content: null
    };
  }
  return state;
}

/**
 * @param {SessionState} state
 * @param {string} filePath
 * @param {string} content
 * @returns {SessionState}
 */
export function recordReadContent(state, filePath, content) {
  const entry = state.entries[filePath];
  if (!entry) return state;
  const previousBytes = entry.content_bytes;
  const candidateBytes = Buffer.byteLength(content, "utf8");
  if (candidateBytes > PER_FILE_CAP_BYTES) {
    entry.content = null;
    entry.content_bytes = 0;
    state.total_bytes = state.total_bytes - previousBytes;
  } else {
    entry.content = content;
    entry.content_bytes = candidateBytes;
    state.total_bytes = state.total_bytes - previousBytes + candidateBytes;
  }
  return state;
}
```

- [ ] **Step 4: Run tests**

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cost-hygiene/state.mjs tests/cost-hygiene-state.test.mjs
git commit -m "feat(cost-hygiene): recordRead + recordReadContent with 50KB cap

Adds recordRead() (increments count, updates last_read_at, preserves
first_read_at) and recordReadContent() (caps content at 50KB; sets
content:null when oversized; maintains total_bytes accumulator)."
```

---

## Task 2d: `evictLRU` for session-cap overflow

- [ ] **Step 1: Add failing tests**

Append to `tests/cost-hygiene-state.test.mjs`:

```js
import { evictLRU } from "../scripts/lib/cost-hygiene/state.mjs";

test("evictLRU drops least-recently-read on session-cap overflow", () => {
  const state = {
    session_id: "s",
    first_seen: "2026-05-28T18:00:00.000Z",
    last_seen: "2026-05-28T18:00:00.000Z",
    total_bytes: 2_100_000,
    entries: {
      "/a": { read_count: 1, first_read_at: "2026-05-28T18:00:00.000Z", last_read_at: "2026-05-28T18:00:00.000Z", mtime_at_last_read: "x", size_at_last_read: 0, content_bytes: 1_000_000, content: "a" },
      "/b": { read_count: 1, first_read_at: "2026-05-28T18:01:00.000Z", last_read_at: "2026-05-28T18:01:00.000Z", mtime_at_last_read: "x", size_at_last_read: 0, content_bytes: 600_000, content: "b" },
      "/c": { read_count: 1, first_read_at: "2026-05-28T18:02:00.000Z", last_read_at: "2026-05-28T18:02:00.000Z", mtime_at_last_read: "x", size_at_last_read: 0, content_bytes: 500_000, content: "c" }
    }
  };
  const protectedPath = "/c";
  const result = evictLRU(state, protectedPath);
  assert.ok(!("/a" in result.entries), "least-recently-read /a should be evicted");
  assert.ok("/c" in result.entries, "currently-being-recorded /c must not be evicted");
  assert.ok(result.total_bytes <= 2_000_000);
});

test("evictLRU never drops the entry being recorded even if it is the LRU", () => {
  const state = {
    session_id: "s",
    first_seen: "2026-05-28T18:00:00.000Z",
    last_seen: "2026-05-28T18:00:00.000Z",
    total_bytes: 2_100_000,
    entries: {
      "/oldest": { read_count: 1, first_read_at: "2026-05-28T18:00:00.000Z", last_read_at: "2026-05-28T18:00:00.000Z", mtime_at_last_read: "x", size_at_last_read: 0, content_bytes: 1_500_000, content: "x" },
      "/newer": { read_count: 1, first_read_at: "2026-05-28T18:05:00.000Z", last_read_at: "2026-05-28T18:05:00.000Z", mtime_at_last_read: "x", size_at_last_read: 0, content_bytes: 600_000, content: "y" }
    }
  };
  const result = evictLRU(state, "/oldest");
  assert.ok("/oldest" in result.entries, "protected /oldest must survive eviction");
});
```

- [ ] **Step 2: Run to verify failure**

Expected: 2 new tests FAIL — `evictLRU is not exported`.

- [ ] **Step 3: Implement `evictLRU`**

Append to `scripts/lib/cost-hygiene/state.mjs`:

```js
const SESSION_CAP_BYTES = 2_000_000;

/**
 * @param {SessionState} state
 * @param {string | null} protectedPath
 * @returns {SessionState}
 */
export function evictLRU(state, protectedPath = null) {
  if (state.total_bytes <= SESSION_CAP_BYTES) return state;
  const entries = Object.entries(state.entries)
    .filter(([p]) => p !== protectedPath)
    .sort(([, a], [, b]) => Date.parse(a.last_read_at) - Date.parse(b.last_read_at));
  for (const [evictPath, entry] of entries) {
    if (state.total_bytes <= SESSION_CAP_BYTES) break;
    state.total_bytes -= entry.content_bytes;
    delete state.entries[evictPath];
  }
  return state;
}
```

- [ ] **Step 4: Run tests**

Expected: 8/8 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/cost-hygiene/state.mjs tests/cost-hygiene-state.test.mjs
git commit -m "feat(cost-hygiene): evictLRU under 2MB session-cap, never drops protected entry

Adds evictLRU(state, protectedPath) that drops the least-recently-read
entries (sorted by last_read_at) until total_bytes is under the 2MB
cap. The protected path (the entry currently being recorded) is
excluded from the eviction candidate set."
```

---

## Task 2e: Corrupt JSON handling + stale temp cleanup

- [ ] **Step 1: Add failing tests**

Append to `tests/cost-hygiene-state.test.mjs`:

```js
test("loadSession on corrupt JSON returns empty + does not throw", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "sess-corrupt.json"), "{not valid json}", "utf8");
    const state = await loadSession(repo, "sess-corrupt");
    assert.equal(state.session_id, "sess-corrupt");
    assert.deepEqual(state.entries, {});
  } finally {
    await cleanup(repo);
  }
});

test("loadSession cleans up stale .tmp.<pid> files older than 60s", async () => {
  const repo = await makeRepo();
  try {
    const dir = path.join(repo, ".claude", "state", "cost-hygiene");
    await fs.mkdir(dir, { recursive: true });
    const stale = path.join(dir, "sess-x.json.tmp.99999");
    await fs.writeFile(stale, "{}", "utf8");
    const oldTime = new Date(Date.now() - 120_000);
    await fs.utimes(stale, oldTime, oldTime);
    const fresh = path.join(dir, "sess-x.json.tmp.88888");
    await fs.writeFile(fresh, "{}", "utf8");
    await loadSession(repo, "sess-x");
    const after = await fs.readdir(dir);
    assert.ok(!after.includes("sess-x.json.tmp.99999"), "stale tmp should be deleted");
    assert.ok(after.includes("sess-x.json.tmp.88888"), "fresh tmp should remain");
  } finally {
    await cleanup(repo);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Expected: the corrupt-JSON test will PASS already (existing `try/catch` in `loadSession` handles it), the stale-tmp test will FAIL — cleanup not implemented.

- [ ] **Step 3: Implement `cleanupStaleTempFiles` and call from `loadSession`**

Append helper to `scripts/lib/cost-hygiene/state.mjs`:

```js
const TEMP_FILE_MAX_AGE_MS = 60_000;

/**
 * @param {string} repoPath
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function cleanupStaleTempFiles(repoPath, sessionId) {
  const dir = path.join(repoPath, STATE_DIR_REL);
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }
  const prefix = `${sessionId}.json.tmp.`;
  const cutoff = Date.now() - TEMP_FILE_MAX_AGE_MS;
  for (const name of files) {
    if (!name.startsWith(prefix)) continue;
    const fullPath = path.join(dir, name);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
      }
    } catch {
      // best-effort
    }
  }
}
```

Modify `loadSession` to call cleanup first:

```js
export async function loadSession(repoPath, sessionId) {
  await cleanupStaleTempFiles(repoPath, sessionId);
  const file = statePath(repoPath, sessionId);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = /** @type {SessionState} */ (JSON.parse(raw));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.session_id === "string" &&
      typeof parsed.entries === "object" &&
      parsed.entries !== null
    ) {
      return parsed;
    }
    return emptyState(sessionId);
  } catch {
    return emptyState(sessionId);
  }
}
```

- [ ] **Step 4: Run tests**

Expected: 10/10 PASS.

- [ ] **Step 5: Run repo gates**

```bash
npm run typecheck
npm run lint
npm run format:check
```

Expected: all EXIT 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/cost-hygiene/state.mjs tests/cost-hygiene-state.test.mjs
git commit -m "feat(cost-hygiene): corrupt JSON tolerance + stale .tmp.<pid> cleanup

loadSession tolerates corrupt JSON (returns empty state, no throw).
loadSession invokes cleanupStaleTempFiles first to delete orphan
<sid>.json.tmp.<pid> files older than 60s — covers the crash-between-
write-and-rename failure mode in saveSession."
```

---

## Task 3: `check-redundant-read.mjs` — PreToolUse hook entry

**Files:**
- Create: `hooks/check-redundant-read.mjs`
- Test: `tests/cost-hygiene-hook.test.mjs`

- [ ] **Step 1: Write the failing integration test file**

```js
// tests/cost-hygiene-hook.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "check-redundant-read.mjs");

async function makeRepo() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-hook-"));
}
async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * @param {string} stdin
 * @param {Record<string, string>} env
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runHook(stdin, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn("node", [HOOK_PATH], { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

test("hook with no env-var exits 0 silently (gate off)", async () => {
  const repo = await makeRepo();
  try {
    const result = await runHook(JSON.stringify({
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: path.join(repo, "x.txt") },
      cwd: repo
    }));
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await cleanup(repo);
  }
});

test("hook with env-var on + first-read stdin emits empty stdout, writes state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "hello.txt");
    await fs.writeFile(file, "hi", "utf8");
    const result = await runHook(JSON.stringify({
      session_id: "s2",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    }), { CREW_COST_HYGIENE: "1" });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s2.json");
    const raw = await fs.readFile(stateFile, "utf8");
    const state = JSON.parse(raw);
    assert.equal(state.entries[file].read_count, 1);
  } finally {
    await cleanup(repo);
  }
});

test("hook with env-var on + reread stdin emits decision + systemMessage with content", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "ack.txt");
    await fs.writeFile(file, "snowflake", "utf8");
    const stdin = JSON.stringify({
      session_id: "s3",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    });
    await runHook(stdin, { CREW_COST_HYGIENE: "1" });

    // Simulate PostToolUse capturing the content — write it directly to the state file.
    const stateFile = path.join(repo, ".claude", "state", "cost-hygiene", "s3.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    state.entries[file].content = "snowflake";
    state.entries[file].content_bytes = 9;
    state.total_bytes = 9;
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");

    // Second read attempt → should warn
    const result = await runHook(stdin, { CREW_COST_HYGIENE: "1" });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /<system-reminder>/);
    assert.match(parsed.systemMessage, /snowflake/);
  } finally {
    await cleanup(repo);
  }
});

test("hook with malformed stdin exits 0 silently", async () => {
  const result = await runHook("not json at all", { CREW_COST_HYGIENE: "1" });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/cost-hygiene-hook.test.mjs`
Expected: 4 tests FAIL — `Cannot find module ... hooks/check-redundant-read.mjs`.

- [ ] **Step 3: Create `hooks/check-redundant-read.mjs`**

```js
#!/usr/bin/env node
// PreToolUse hook on Read. Env-var gated. Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { loadSession, saveSession, recordRead, evictLRU } from "../scripts/lib/cost-hygiene/state.mjs";
import { decide } from "../scripts/lib/cost-hygiene/decide.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @param {string} repoPath
 * @param {string} code
 * @param {string} sessionId
 * @param {string} detail
 */
async function logEvent(repoPath, code, sessionId, detail) {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `cost-hygiene:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

/**
 * @param {string} raw
 * @returns {{session_id: string, file_path: string, cwd: string} | null}
 */
function parseInput(raw) {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_input === "object" &&
      obj.tool_input !== null &&
      typeof obj.tool_input.file_path === "string"
    ) {
      return {
        session_id: obj.session_id,
        file_path: obj.tool_input.file_path,
        cwd: obj.cwd
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_COST_HYGIENE !== "1") {
    process.exit(0);
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }
  const { session_id, file_path, cwd } = input;
  const absPath = path.resolve(cwd, file_path);

  let mtimeIso;
  let size;
  try {
    const stat = await fs.stat(absPath);
    mtimeIso = stat.mtime.toISOString();
    size = stat.size;
  } catch {
    process.exit(0);
  }

  let state;
  try {
    state = await loadSession(cwd, session_id);
  } catch (err) {
    await logEvent(cwd, "state-load-fail", session_id, String(err));
    process.exit(0);
  }

  const stored = state.entries[absPath] ?? null;
  const result = decide({
    path: absPath,
    storedEntry: stored,
    currentMtime: mtimeIso,
    currentSize: size,
    now: new Date().toISOString()
  });

  if (result.action === "warn" && result.message !== null) {
    process.stdout.write(
      JSON.stringify({ decision: "approve", systemMessage: result.message })
    );
  }

  state = recordRead(state, absPath, mtimeIso, size, new Date().toISOString());
  state = evictLRU(state, absPath);

  try {
    await saveSession(cwd, session_id, state);
  } catch (err) {
    await logEvent(cwd, "state-write-fail", session_id, String(err));
  }
}

main().catch(async (err) => {
  try {
    await logEvent(process.cwd(), "uncaught", "unknown", String(err));
  } catch {
    // give up
  }
  process.exit(0);
});
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/cost-hygiene-hook.test.mjs`
Expected: 4/4 PASS.

- [ ] **Step 5: Run all gates**

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

Expected: all EXIT 0. Test total = 112 (existing) + 6 (decide) + 10 (state) + 4 (hook) = 132.

- [ ] **Step 6: Commit**

```bash
git add hooks/check-redundant-read.mjs tests/cost-hygiene-hook.test.mjs
git commit -m "feat(cost-hygiene): PreToolUse hook entry — env-var gated, never blocks

Adds hooks/check-redundant-read.mjs. CREW_COST_HYGIENE=1 gates
activation; default-off. On reread of a path with unchanged mtime,
emits {decision: 'approve', systemMessage: '<system-reminder>...</system-reminder>'}
with the prior content quoted. Always exits 0; logs internal errors
to .claude/logs/events.jsonl. Test count now 132."
```

---

## Task 4: `record-read-content.mjs` — PostToolUse hook entry

**Files:**
- Create: `hooks/record-read-content.mjs`
- Test: append to `tests/cost-hygiene-hook.test.mjs`

- [ ] **Step 1: Add failing test**

Append to `tests/cost-hygiene-hook.test.mjs`:

```js
const POST_HOOK_PATH = path.join(__dirname, "..", "hooks", "record-read-content.mjs");

function runPostHook(stdin, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn("node", [POST_HOOK_PATH], { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

test("post-hook captures Read tool result content into state", async () => {
  const repo = await makeRepo();
  try {
    const file = path.join(repo, "post.txt");
    await fs.writeFile(file, "wisp", "utf8");
    // Seed state with a first-read record (no content yet).
    const preStdin = JSON.stringify({
      session_id: "s4",
      tool_name: "Read",
      tool_input: { file_path: file },
      cwd: repo
    });
    await runHook(preStdin, { CREW_COST_HYGIENE: "1" });

    const postStdin = JSON.stringify({
      session_id: "s4",
      tool_name: "Read",
      tool_input: { file_path: file },
      tool_response: { content: "wisp" },
      cwd: repo
    });
    const result = await runPostHook(postStdin, { CREW_COST_HYGIENE: "1" });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    const state = JSON.parse(
      await fs.readFile(path.join(repo, ".claude", "state", "cost-hygiene", "s4.json"), "utf8")
    );
    assert.equal(state.entries[file].content, "wisp");
  } finally {
    await cleanup(repo);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Expected: 1 new test FAILS — `Cannot find module ... hooks/record-read-content.mjs`.

- [ ] **Step 3: Create `hooks/record-read-content.mjs`**

```js
#!/usr/bin/env node
// PostToolUse hook on Read. Env-var gated. Always exits 0.
import fs from "node:fs/promises";
import path from "node:path";
import { loadSession, saveSession, recordReadContent, evictLRU } from "../scripts/lib/cost-hygiene/state.mjs";

/**
 * @param {string} repoPath
 * @param {string} code
 * @param {string} sessionId
 * @param {string} detail
 */
async function logEvent(repoPath, code, sessionId, detail) {
  try {
    const dir = path.join(repoPath, ".claude", "logs");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event: `cost-hygiene:${code}`,
      session_id: sessionId,
      detail
    });
    await fs.appendFile(path.join(dir, "events.jsonl"), line + "\n", "utf8");
  } catch {
    // best-effort
  }
}

/**
 * @param {string} raw
 * @returns {{session_id: string, file_path: string, content: string, cwd: string} | null}
 */
function parseInput(raw) {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.session_id === "string" &&
      typeof obj.cwd === "string" &&
      typeof obj.tool_input === "object" &&
      obj.tool_input !== null &&
      typeof obj.tool_input.file_path === "string" &&
      typeof obj.tool_response === "object" &&
      obj.tool_response !== null &&
      typeof obj.tool_response.content === "string"
    ) {
      return {
        session_id: obj.session_id,
        file_path: obj.tool_input.file_path,
        content: obj.tool_response.content,
        cwd: obj.cwd
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.env.CREW_COST_HYGIENE !== "1") {
    process.exit(0);
  }
  const raw = await readStdin();
  const input = parseInput(raw);
  if (input === null) {
    process.exit(0);
  }
  const { session_id, file_path, content, cwd } = input;
  const absPath = path.resolve(cwd, file_path);

  let state;
  try {
    state = await loadSession(cwd, session_id);
  } catch (err) {
    await logEvent(cwd, "state-load-fail", session_id, String(err));
    process.exit(0);
  }

  state = recordReadContent(state, absPath, content);
  state = evictLRU(state, absPath);

  try {
    await saveSession(cwd, session_id, state);
  } catch (err) {
    await logEvent(cwd, "state-write-fail", session_id, String(err));
  }
}

main().catch(async (err) => {
  try {
    await logEvent(process.cwd(), "uncaught", "unknown", String(err));
  } catch {
    // give up
  }
  process.exit(0);
});
```

- [ ] **Step 4: Run tests**

Expected: all hook tests pass (5 in this file now).

- [ ] **Step 5: Commit**

```bash
git add hooks/record-read-content.mjs tests/cost-hygiene-hook.test.mjs
git commit -m "feat(cost-hygiene): PostToolUse hook entry — captures Read content

Adds hooks/record-read-content.mjs. CREW_COST_HYGIENE=1 gated.
Reads tool_response.content from stdin and persists into the
session state via recordReadContent (caps at 50KB; LRU evicts on
2MB overflow). Always exits 0."
```

---

## Task 5: Wire hooks into `hooks/hooks.json`

**Files:**
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Read current `hooks/hooks.json`**

```bash
cat hooks/hooks.json
```

You will see 6 existing matchers (SessionStart, TaskCreated, TaskCompleted, SubagentStart, SubagentStop, TeammateIdle), all delegating to `${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh`.

- [ ] **Step 2: Add `PreToolUse` and `PostToolUse` matchers**

Update `hooks/hooks.json` by inserting these two top-level entries inside `"hooks"` (keep all existing entries intact):

```jsonc
"PreToolUse": [
  {
    "matcher": "Read",
    "hooks": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/check-redundant-read.mjs\""
      }
    ]
  }
],
"PostToolUse": [
  {
    "matcher": "Read",
    "hooks": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/record-read-content.mjs\""
      }
    ]
  }
]
```

- [ ] **Step 3: Validate manifest**

```bash
node ./scripts/validate-manifests.mjs
```

Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat(cost-hygiene): wire PreToolUse + PostToolUse Read matchers into hooks.json

Adds the two new matchers next to the existing 6 logging matchers.
Both hooks are env-var-gated (CREW_COST_HYGIENE=1) and exit 0 on
miss; shipping default-off until dogfood measurement confirms the
warning reduces redundant Read counts."
```

---

## Task 6: Full repo gates

- [ ] **Step 1: Run all gates in parallel**

```bash
node ./scripts/validate-manifests.mjs
node ./scripts/validate-skills.mjs
node ./scripts/validate-slices.mjs
npm run lint
npm run format:check
npm run typecheck
node --test
```

Expected: all EXIT 0. Test count = 112 (existing) + 6 (decide) + 10 (state) + 5 (hook) = **133 tests**.

- [ ] **Step 2: If `format:check` fails, fix**

```bash
npm run format
```

Then re-run `npm run format:check` to confirm.

- [ ] **Step 3: If any gate fails, fix the issue, then re-run all gates from Step 1.**

- [ ] **Step 4: Commit only if any cleanup was needed**

```bash
git status --short
# If nothing modified, skip the commit.
git add -p
git commit -m "chore(cost-hygiene): final-gate cleanup"
```

---

## Task 7: Dogfood enable + measure

**Files:**
- Modify: this repo's environment (env var only, no committed change).

- [ ] **Step 1: Enable the hook locally for this repo**

```bash
# Windows PowerShell:
$env:CREW_COST_HYGIENE = "1"

# Or bash on Windows/macOS/Linux:
export CREW_COST_HYGIENE=1
```

- [ ] **Step 2: Run a real Claude Code session in this repo for ≥30 minutes**

Use the repo normally (a `/crew:brief-me`, a small build slice, an investigation — whatever surfaces). Do not artificially trigger Reads.

- [ ] **Step 3: After the session, inspect state**

```bash
ls .claude/state/cost-hygiene/
cat .claude/state/cost-hygiene/<session_id>.json | head -50
```

You should see entries with `read_count > 1` for any redundantly-read paths.

- [ ] **Step 4: Generate cost report + compare**

```bash
node ./scripts/crew.mjs cost-report --repo "$PWD" --aggregate-all
```

Compare the `fileReReadCount` in the latest report to the prior baseline (114 in the F-grade reference session). Look for:
- `fileReReadCount` substantially lower (target: <30)
- `costHealth.topConcern` no longer "redundant Read calls"

- [ ] **Step 5: Record the measurement**

Write a brief observation to `.claude/artifacts/crew/runs/` (timestamped):

```bash
DATE=$(date -u +"%Y%m%dT%H%M%SZ")
cat > .claude/artifacts/crew/runs/${DATE}-observation-cost-hygiene-dogfood.md <<'EOF'
# Cost-Hygiene Dogfood Observation

- Session id: <fill in>
- Duration: <fill in>
- fileReReadCount before: 114 (baseline)
- fileReReadCount after: <fill in>
- costHealth.topConcern after: <fill in>
- Verdict: <pass / iterate / regress>
- Next: <promote to default-on / iterate on warning text / investigate ignored>
EOF
```

- [ ] **Step 6: Commit the observation**

```bash
git add .claude/artifacts/crew/runs/${DATE}-observation-cost-hygiene-dogfood.md
git commit -m "chore(cost-hygiene): dogfood observation — fileReReadCount <N>

Records single-session dogfood measurement of the cost-hygiene
hook. Baseline (114 rereads) vs measured. Verdict + next step
captured for the promote-to-default-on decision."
```

- [ ] **Step 7: Decide on promotion**

If verdict = `pass` (<30 rereads, top concern shifted): open a follow-up FEAT for "promote cost-hygiene hook to plugin default-on" in `docs/backlog/pending/`.

If verdict = `iterate`: open a follow-up FEAT for "tune cost-hygiene warning text" with hypothesis on why the model ignored the system-reminder.

If verdict = `regress`: open an incident note, disable the env var, file a bug.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| Locked decisions Q1–Q7 | Encoded in Task 1 (decide.mjs) + Task 3 (env-var gate) + Tasks 2c/2d (50KB/2MB caps) |
| Architecture — Hook trigger | Task 5 (hooks.json) |
| Architecture — Hook input contract | Task 3 Step 3 (parseInput) + Task 4 Step 3 (parseInput) |
| Architecture — Hook output contract | Task 3 Step 3 (decision/systemMessage emit) + Task 3 Step 1 (test asserts JSON) |
| Architecture — State schema | Task 2a–2e |
| Architecture — Latency budget | Implicit (no third-party deps; spec target <150ms p95). Not directly tested in plan |
| Components A (check-redundant-read.mjs) | Task 3 |
| Components A2 (record-read-content.mjs) | Task 4 |
| Components B (state.mjs) | Task 2a–2e |
| Components C (decide.mjs) | Task 1 |
| Components D (decide tests) | Task 1 Step 1 |
| Components E (state tests) | Task 2a–2e |
| Components F (hook integration tests) | Task 3 Step 1, Task 4 Step 1 |
| Error handling — Cardinal rule never block | Task 3 Step 3 (always exit 0) + Task 1 corrupt-stdin test |
| Error handling — 8 failure modes | Test coverage: stdin-parse-fail (Task 3 Step 1 test 4), input-shape-fail (covered by parseInput null), state-corrupt (Task 2e Step 1 test 1), stat-fail (Task 3 Step 3 lines 47–53), decide-throw (top-level catch in main) |
| Error handling — Atomic write safety | Task 2b Step 1 test 2 + Task 2e (stale tmp cleanup) |
| Testing — decide table | Task 1 Step 1 |
| Testing — state IO | Task 2a–2e |
| Testing — hook subprocess | Task 3 Step 1, Task 4 Step 1 |
| Testing — Dogfood plan | Task 7 |
| Testing — Test count gate (130 floor) | Task 6 documents 133 |
| Risk register | All risks covered by tests except "model ignores system-reminder" — measured in Task 7 |

Gaps: latency budget not asserted by an automated test. Acceptable — no Node-spawn timing test in repo today; budget is documented in spec and observable in Task 7 dogfood if it ever exceeds.

**2. Placeholder scan**

Searched: no "TBD", "TODO", "implement later", "fill in details", "appropriate error handling" patterns. Plan uses real code in every step. ✅

**3. Type consistency**

Cross-task consistency check:
- `decide()` signature: Task 1 Step 1 (test) and Step 3 (impl) and Task 3 Step 3 (caller) all use `{path, storedEntry, currentMtime, currentSize, now}` with `storedEntry: StoredEntry | null`. ✅
- `recordRead()` signature: Task 2c Step 1 (test) and Step 3 (impl) and Task 3 Step 3 (caller) all use `(state, filePath, mtime, size, now)`. ✅
- `recordReadContent()` signature: Task 2c Step 1 (test) and Step 3 (impl) and Task 4 Step 3 (caller) all use `(state, filePath, content)`. ✅
- `evictLRU()` signature: Task 2d Step 1 (test) and Step 3 (impl) and Tasks 3/4 (callers) all use `(state, protectedPath)` with `protectedPath: string | null`. ✅
- `loadSession()` / `saveSession()` signatures consistent across Tasks 2a, 2b, 3, 4. ✅
- `StoredEntry` shape: defined in Task 1 typedef + Task 2a typedef. Same field names in both (`read_count`, `first_read_at`, `last_read_at`, `mtime_at_last_read`, `size_at_last_read`, `content_bytes`, `content`). ✅
- `SessionState` shape: defined in Task 2a, used consistently across Tasks 2b–2e, 3, 4. ✅

All signatures consistent.
