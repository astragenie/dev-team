# Cost-Hygiene Reread Hook Design

- Date: 2026-05-28
- Status: draft (awaiting user review)
- Feature area: `hooks/hooks.json`, `hooks/check-redundant-read.mjs` (new), `scripts/lib/cost-hygiene/` (new dir), `tests/cost-hygiene-*.test.mjs` (new)

## Overview

The crew plugin currently detects redundant Reads after the fact (`scripts/lib/cost-advisor.mjs:496-502` fires at ≥3 rereads per session; `scripts/lib/session-cost.mjs:790-791` aggregates `fileReReadCount`) but the detection is reactive — it surfaces in cost reports after the cost has already been paid. The last 5 sessions averaged $419.68 each, with "114 redundant Read calls of files already loaded this session" as the top concern and the dominant driver of the F-grade cost health.

This design adds a `PreToolUse` hook on `Read` that intercepts every Read tool call. When the hook detects that the same path was already loaded earlier in the same session and the file's mtime hasn't changed since, it injects a `<system-reminder>` block into the assistant's context that quotes the prior file content and explicitly instructs the assistant not to re-issue the Read. The hook never blocks the Read from succeeding — it can only inject context. A paired `PostToolUse` hook captures the content of each successful Read for use by future reread interception.

The design is intentionally surgical: one new directory (`scripts/lib/cost-hygiene/`) with two focused modules (state IO, pure decision), one hook entry script, three test files, and minor `hooks/hooks.json` additions. All decisions made during brainstorming (Q1–Q7) are locked.

## Goal

Reduce redundant Read counts to under 10 per session (down from 114) and recover the cost previously spent on cache-busting redundant tool output. Success measured by `costHealth.topConcern` no longer being "redundant Read calls" in the next 5 sessions after enablement.

## Scope

### In scope

- New `PreToolUse` and `PostToolUse` matchers on `Read` in `hooks/hooks.json`.
- New `hooks/check-redundant-read.mjs` (PreToolUse hook entry).
- New `hooks/record-read-content.mjs` (PostToolUse hook entry, captures content).
- New `scripts/lib/cost-hygiene/state.mjs` (session state IO + LRU eviction).
- New `scripts/lib/cost-hygiene/decide.mjs` (pure decision logic + warning formatter).
- New `tests/cost-hygiene-decide.test.mjs` (pure table-driven tests).
- New `tests/cost-hygiene-state.test.mjs` (fs tests with `os.tmpdir()`).
- New `tests/cost-hygiene-hook.test.mjs` (integration test spawning hook subprocess).
- Dogfood plan: ship the hook **disabled** by default in the first release; enable on this repo via env-var for one full session; promote to plugin default-on in a follow-up minor release after measurement.

### Out of scope

- Blocking the Read tool call. Hook always exits 0. Active blocking risked false positives on legitimate re-reads (file edited externally, file changed by previous tool call) and was explicitly rejected during brainstorming (Q1: "Warn only" picked over "Block by default" and "Hybrid").
- Cross-session deduplication. Each session gets its own state file. Subagents have their own session ID and their own state.
- Other tools (Edit, Write, Bash, Glob, Grep). Scope is `Read` only.
- Changes to `scripts/lib/cost-advisor.mjs` reread detector. That stays as the after-the-fact reporting path — this hook is the preventive path.
- Changes to `CLAUDE.md` cost-discipline rule or `feedback_cost_discipline` memory. Both are documented; clearly insufficient on their own; this hook supplements them.

## Locked Brainstorming Decisions (Q1–Q7)

| # | Question | Decision |
|---|---|---|
| Q1 | Action on detected reread | Warn-only, never block. Inject `<system-reminder>` into context via `decision: "approve"` + `systemMessage` |
| Q2 | Per-file trigger threshold | Fire on every reread (Read #2, #3, …) of the same path |
| Q3 | Distribution | Crew plugin, default-on (after dogfood gate) |
| Q4 | Hook language | Node ESM (`.mjs`) |
| Q5 | Warning format | Inject prior content inline within a `<system-reminder>` block |
| Q6 | State cap | Per-file 50KB, session-file 2MB, LRU eviction on overflow |
| Q7 | Edit-aware exception | Suppress warning when `fs.stat` mtime is newer than stored `mtime_at_last_read` |

## Architecture

```
Claude Code about to invoke Read tool
            │
            ▼
   PreToolUse fires; spawns:
   node hooks/check-redundant-read.mjs
            │
            ▼ stdin (JSON)
   ┌────────────────────────────────┐
   │ hooks/check-redundant-read.mjs │
   │  1. parse stdin                │
   │  2. extract session_id,        │
   │     file_path, cwd             │
   │  3. resolve absolute path      │
   └──────┬─────────────────────────┘
          ▼
   loadSession(cwd, session_id)        ──► fs read .claude/state/cost-hygiene/<sid>.json
          ▼
   fs.stat(abs_path)                   ──► currentMtime, currentSize
          │                                 (stat fails: no-such-file → pass silently)
          ▼
   decide({path, storedEntry, currentMtime, currentSize, now})
          │
          ├── action: "pass"  ──────────►  silent: empty stdout, exit 0
          │
          └── action: "warn" + message
                  ▼
          stdout: {"decision":"approve","systemMessage":"<system-reminder>...</system-reminder>"}
                  ▼
   recordRead(state, path, mtime, size, content=null)
          ▼
   saveSession(cwd, session_id, state) ──► fs atomic write (.tmp.<pid> + rename)
          ▼
        exit 0
            ▼
   Claude Code reads stdout, injects systemMessage,
   then proceeds with the actual Read.
            ▼
   PostToolUse fires; spawns:
   node hooks/record-read-content.mjs
            ▼
   loadSession → recordReadContent(state, path, contentFromToolResult)
            ▼ (content stored if ≤50KB; else size+mtime only)
   saveSession
            ▼
        exit 0
```

The PreToolUse path is the **detection** path. The PostToolUse path is the **content-capture** path. Splitting them avoids the PreToolUse hook having to do a redundant `fs.readFile` for content acquisition.

### State location

`.claude/state/cost-hygiene/<session_id>.json` — per-session, gitignored (the `.claude/state/` directory is already excluded per `CLAUDE.md`'s artifact direction section).

### State schema

```jsonc
{
  "session_id": "abc123",
  "first_seen": "2026-05-28T19:35:00Z",
  "last_seen": "2026-05-28T19:42:13Z",
  "total_bytes": 487231,
  "entries": {
    "/abs/path/to/file": {
      "read_count": 3,
      "first_read_at": "2026-05-28T19:35:00Z",
      "last_read_at": "2026-05-28T19:42:13Z",
      "mtime_at_last_read": "2026-05-28T18:11:02Z",
      "size_at_last_read": 27419,
      "content_bytes": 27419,    // 0 if file >50KB (path-only entry)
      "content": "..."           // omitted (null) if oversized
    }
  }
}
```

### Hook input contract (stdin from Claude Code)

```jsonc
{
  "session_id": "abc123-def...",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/abs/path",
    "offset": 1,
    "limit": 2000
  },
  "cwd": "/working/directory"
}
```

### Hook output contract (stdout)

Hook **always exits 0**. Stdout is one of:

- **Silent pass** (empty stdout): no reread, or mtime changed since last Read.
- **Warning** (JSON conforming to PreToolUse hook output schema):

```json
{
  "decision": "approve",
  "systemMessage": "<system-reminder>You already loaded /abs/path 3 times this session. Content unchanged (mtime 2026-05-28T18:11:02Z). Prior content:\n\n<quoted body>\n\nDo not re-issue the Read.</system-reminder>"
}
```

`systemMessage` is injected before the actual Read result reaches the assistant.

### Latency budget

Target: <150ms p95 per PreToolUse invocation. Components: Node startup ~80ms, stdin parse <1ms, state JSON read ~5–15ms, `fs.stat` ~1–3ms, `decide()` <1ms, atomic write ~5–15ms, stdout <1ms. Worst case ~115ms.

## Components

### Component A — `hooks/check-redundant-read.mjs` (PreToolUse hook entry)

- **Does**: Reads stdin JSON, calls `loadSession` → `decide` → `saveSession`, writes stdout (empty or `{decision, systemMessage}`), exits 0.
- **Use**: Invoked by Claude Code on every `Read` tool call. Never called manually.
- **Depends on**: `scripts/lib/cost-hygiene/state.mjs`, `scripts/lib/cost-hygiene/decide.mjs`, `node:fs/promises`, `node:path`. Zero third-party deps.
- **Public surface**: none — process entry point.
- **Target size**: ≤30 lines (CLAUDE.md: "Hooks should stay small and auditable").

### Component A2 — `hooks/record-read-content.mjs` (PostToolUse hook entry)

- **Does**: Reads stdin JSON (Claude Code passes the tool result on PostToolUse), extracts file_path + content from the Read result, calls `loadSession` → `recordReadContent` (variant of `recordRead` that fills in `content` if ≤50KB) → `saveSession`, exits 0.
- **Use**: Invoked by Claude Code on every successful `Read` tool result.
- **Depends on**: `scripts/lib/cost-hygiene/state.mjs`, `node:fs/promises`, `node:path`.
- **Public surface**: none — process entry point.
- **Target size**: ≤30 lines.

### Component B — `scripts/lib/cost-hygiene/state.mjs` (session state IO)

- **Does**: Reads/writes per-session JSON at `.claude/state/cost-hygiene/<sessionId>.json`. Enforces 50KB/file + 2MB/session caps via LRU eviction. Atomic writes (temp + rename).
- **Use**:
  - `loadSession(repoPath, sessionId) → SessionState`
  - `saveSession(repoPath, sessionId, state) → Promise<void>`
  - `recordRead(state, path, mtime, size) → SessionState` (no fs; pure transformation)
  - `recordReadContent(state, path, content) → SessionState` (caps content at 50KB; sets `content_bytes` and `total_bytes`)
- **Depends on**: `node:fs/promises`, `node:path`. No imports from `cost-advisor`, `session-cost`, `wakeup`.
- **Public surface**: `loadSession`, `saveSession`, `recordRead`, `recordReadContent`. Internal: `evictLRU`, `applyContentCap`, `cleanupStaleTempFiles`.
- **Target size**: ≤200 lines.

### Component C — `scripts/lib/cost-hygiene/decide.mjs` (pure decision)

- **Does**: Given a path, the stored entry (or null), current mtime, current size, and now → returns `{action: "pass" | "warn", message: string | null}`. No fs. No side effects. No imports.
- **Use**: `decide({ path, storedEntry, currentMtime, currentSize, now }) → DecideResult`. Called by hook entry between `loadSession` and `saveSession`.
- **Depends on**: nothing. Pure.
- **Public surface**: `decide`. Internal: `formatWarning(entry, currentMtime)` (builds the `<system-reminder>` block with prior content quoted per Q5).
- **Target size**: ≤120 lines.

### Component D — `tests/cost-hygiene-decide.test.mjs`

Table-driven, no fs. Covers Q1–Q7 matrix:

- First read of path (no stored entry) → `pass`
- Read #2 of path, mtime unchanged → `warn` (message contains "already loaded 1 time", "Prior content:", content excerpt)
- Read #2 of path, mtime newer → `pass` (per Q7 edit exception)
- Read #5 of path, content stored → `warn` (message contains "already loaded 4 times")
- Read of path, content omitted (oversized when first stored) → `warn` (message contains "content omitted, file size NNN KB")
- Read of path, mtime unchanged but size changed → `warn` (mtime is the gate per Q7; size is recorded but not the trigger)

Each row = one `test()` block. Assertions: `action` exact + message-substring presence.

### Component E — `tests/cost-hygiene-state.test.mjs`

Uses `os.tmpdir()` fixtures. Covers:

- `loadSession` returns empty shape when file absent
- `saveSession` then `loadSession` round-trip preserves entries
- `saveSession` atomic — no `.tmp.<pid>` left on success
- `recordRead` increments `read_count`, updates `last_read_at`, preserves `first_read_at`
- `recordReadContent` caps content at 50KB, sets `content: null` when oversized
- `recordReadContent` updates `total_bytes` after content fill
- `evictLRU` drops least-recently-read on session-cap overflow
- `evictLRU` never drops the entry being recorded
- `loadSession` on corrupt JSON returns empty + logs event (does not throw)
- `loadSession` cleans up stale `.tmp.<pid>` files older than 60s

Each `setup()` uses `await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-"))`. Teardown: recursive delete.

### Component F — `tests/cost-hygiene-hook.test.mjs`

Integration test that spawns the hook script as a subprocess:

- Hook with no stdin exits 0 silently
- Hook with valid first-read stdin emits empty stdout, writes state
- Hook with reread stdin emits `{decision, systemMessage}` with prior content quoted
- Hook with corrupt state file exits 0, allows read, logs event

Uses `child_process.spawn("node", [HOOK_PATH])`, writes stdin via `proc.stdin.end(JSON.stringify(...))`, asserts stdout content + state-file delta after process exit. ~150ms per test.

### Dependency graph

```
hooks/check-redundant-read.mjs
   ├── scripts/lib/cost-hygiene/state.mjs
   │      └── node:fs/promises, node:path
   └── scripts/lib/cost-hygiene/decide.mjs
          └── (none — pure)

hooks/record-read-content.mjs
   └── scripts/lib/cost-hygiene/state.mjs

tests/cost-hygiene-decide.test.mjs → scripts/lib/cost-hygiene/decide.mjs
tests/cost-hygiene-state.test.mjs  → scripts/lib/cost-hygiene/state.mjs
tests/cost-hygiene-hook.test.mjs   → spawns hook subprocess (no direct lib imports)
```

DAG. No cycles. `decide.mjs` has zero deps → maximally testable.

### Why split state / decide

- `state.mjs` is the side-effecting boundary. Tests need fs fixtures.
- `decide.mjs` is pure logic. Tests are tables — fast, deterministic, no fs.
- Q5's warning format lives in `decide.mjs` — the prevention lever per `feedback_cost_discipline.md` memory. Pure tests pin down exact text + structure. Future drift caught by test diff.

## Error Handling

Cardinal rule: **the hook must never prevent a Read from succeeding.** Any internal error → silent pass + log entry to `.claude/logs/events.jsonl`.

| Failure | Response |
|---|---|
| stdin not valid JSON | exit 0 silently; log `cost-hygiene:stdin-parse-fail` |
| `session_id` or `tool_input.file_path` missing | exit 0 silently; log `cost-hygiene:input-shape-fail` |
| State file corrupt JSON | `loadSession` returns empty shape; log `cost-hygiene:state-corrupt`; continue |
| State file unreadable (permission) | `loadSession` returns empty shape; log once per session |
| State file write fails | log `cost-hygiene:state-write-fail`; exit 0 with stdout already emitted (decision injected if warn) |
| `fs.stat` on target fails (no-such-file, perm) | treat as "no prior entry comparable" — pass + skip recording |
| `decide()` throws (defensive) | exit 0 silently; log `cost-hygiene:decide-throw` with stack |
| Node spawn slower than expected | no enforcement; Claude Code's own hook timeout governs |

Log format (one JSON line appended):

```json
{"ts":"<iso>","event":"cost-hygiene:<code>","session_id":"<sid>","detail":"<short>"}
```

Top-level `try/catch` wraps `main()`. No exceptions propagate.

### Atomic write safety

`saveSession` writes to `<path>.tmp.<pid>` then `fs.rename`. Crash between write and rename leaves orphan `.tmp.<pid>` files. Cleanup happens on the next `loadSession`: glob `<sid>.json.tmp.*`, delete any older than 60s. Single-pass best-effort.

## Testing

### Decision matrix (`decide.mjs`) — Component D above

Pure, fast, table-driven. ≥6 cases covering Q1–Q7.

### State IO (`state.mjs`) — Component E above

Fs-using, `os.tmpdir()` fixtures. ≥9 cases.

### Integration (`hook.mjs` subprocess) — Component F above

Spawned subprocess. ≥4 cases.

### Dogfood plan (Step-Gated Promotion)

- **Step 1 — Ship disabled.** First release lands the hook in `hooks/hooks.json` behind an env-var check (`CREW_COST_HYGIENE=1`). The hook entry script's first action: `if (process.env.CREW_COST_HYGIENE !== "1") process.exit(0)`. Default off in plugin — consumers and this repo enable explicitly by setting the env var.
- **Step 2 — Local enable.** Enable on this repo (`hero-crew`) via env-var for one full work-session. Measure delta:
  - Did `costHealth.topConcern` drop below "redundant Read calls" as the #1 concern?
  - Did total session $ drop?
  - Did the new `fileReReadCount` in `session-cost.mjs` drop below 30?
- **Step 3 — Promote.**
  - If measurements pass → flip default to on in the next plugin minor release.
  - If not → analyze. Was the warning visible enough? Did model ignore the `<system-reminder>` block? Iterate on `decide.mjs`'s `formatWarning` text.

### Test count gate

Repo currently has **112 tests**. Hook lands with ≥18 new tests (6 decide + 9 state + 3+ integration). New floor: **130 tests**. CI test-count regression guard deferred to a future FEAT-024-style enforcement work item.

## Risk Register

| Risk | Mitigation |
|---|---|
| Hook blocks a legitimate Read due to internal bug | Cardinal rule: always exit 0, never propagate exceptions. Top-level `try/catch`. Integration test verifies "hook with no stdin exits 0 silently". |
| State file grows unbounded | Per-file 50KB cap + per-session 2MB cap + LRU eviction (Q6). State tests assert eviction triggers at correct threshold. |
| State file corrupts (crash mid-write) | Atomic write via `.tmp.<pid>` + rename. Stale temp cleanup on next load. State tests assert "no `.tmp.<pid>` left on success". |
| False positive: file edited externally between Reads | mtime stat exception (Q7). If mtime newer → pass silently. State test asserts mtime-newer case → `pass`. |
| Model ignores the `<system-reminder>` block (precedent: cost-discipline memory already exists yet last session still had 114 rereads) | Dogfood gate. Step 2 measures whether the warning actually reduces reread count. If not → iterate on warning text before promoting. Inline content (Q5) is the strongest format identified. |
| Hook latency degrades user experience | Latency budget <150ms p95. Components measured; Node startup dominates. Atomic write is single small file. No third-party deps to load. |
| Subagent state pollution | Each subagent gets its own `session_id` from Claude Code. Per-session JSON keyed by `session_id`. State tests assert per-session isolation. |
| PostToolUse content capture missed (e.g. Read failed) | PostToolUse only fires on successful Read. If Read fails, no content captured — PreToolUse sees no `content` next time, falls back to path-only warning ("content omitted, file size NNN KB"). Test in Component D covers this. |
| Test count drop on regression | Repo has 112 tests; lands with ≥18 new (floor 130). CI test-count regression guard not in initial scope but documented as follow-up. |

## Out of Scope

- Active blocking of the Read tool call (Q1 rejected this; "Warn only" picked).
- Cross-session deduplication (each session has its own state file).
- Other tools (Edit, Write, Bash, Glob, Grep) — scope is `Read` only.
- Changes to `scripts/lib/cost-advisor.mjs` reread detector — that path stays as after-the-fact reporting.
- Changes to `CLAUDE.md` cost-discipline rule or `feedback_cost_discipline` memory.
- A CI test-count regression guard (documented as follow-up FEAT work).
- Promotion to plugin default-on in the first release. Default-on requires dogfood measurement first.
- Migrating the existing six hooks from `.sh` to `.mjs`. Out of scope; this design adds Node hooks alongside existing shell hooks.
- A `crew-hygiene-status` subcommand for inspecting the state file. Useful but deferred.
