# Task Handoff: Brainstorming — cost-hygiene PreToolUse reread hook, 7 Qs locked + 3 approaches presented, awaiting Approach B/A/C choice

- Created: 2026-05-28T19:33:43Z
- From: lead
- To: lead (next session)
- Supersedes: none (first handoff for cost-hygiene workstream)
- Sibling handoff: `20260528T190032Z-handoff-brainstorming-ts-port-error-handling-presented-awaiting-answers.md` (TS port brainstorm, paused mid-flight with 5 open Qs)
- Objective: Design a PreToolUse Read hook that quotes prior file content in a `<system-reminder>` block to prevent redundant Reads (the F-grade root cause: 114 redundant Reads in the last session)
- Allowed Scope: brainstorming dialogue only; spec write at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md` after design approved; no code until spec approved
- Forbidden Scope: No `hooks/check-redundant-read.mjs`. No new `scripts/lib/cost-hygiene/`. No changes to `hooks/hooks.json`. No tests. No plugin version bump
- Deliverable: Spec at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md`, committed, user-approved → then invoke `superpowers:writing-plans`
- Changed Files (this session): none yet for this workstream (only the prior AC5 fixup + prior handoff/synthesis are committed; cost-hygiene brainstorm has not touched code or specs)
- Confidence: high
- Risks: scope creep into other reread-prevention paths (skill prompt edits, CLAUDE.md rule additions); the user already declined those in favor of the hook approach — stay locked on hook

## Brainstorming Skill Progress

| # | Checklist item | Status |
|---|---|---|
| 1 | Explore project context | ✅ completed |
| 2 | Ask clarifying questions | ✅ completed (7 Qs locked) |
| 3 | Propose 2-3 approaches | ✅ completed (**Approach B approved** 2026-05-28T19:34Z) |
| 4 | Present design sections | 🔄 **in_progress — Sections 1 ✅ + 2 ✅ APPROVED; Sections 3 (Data flow) + 4 (Error handling) + 5 (Testing) batched-delivered, awaiting full-design approval** |
| 5 | Write design doc | pending |
| 6 | Spec self-review | pending |
| 7 | User reviews spec | pending |
| 8 | Invoke writing-plans skill | pending |

## Locked Decisions (Q1–Q7)

| # | Question | Decision |
|---|---|---|
| Q1 | Action type on detected reread | **Warn-only**, never block |
| Q2 | Per-file trigger threshold | **Every reread** (fire on Read #2, #3, …) |
| Q3 | Distribution scope | **Crew plugin** `hooks/hooks.json`, default-on for all consumers |
| Q4 | Hook language | **Node ESM** (`.mjs`) |
| Q5 | Warning format | **Inline content quote** in `<system-reminder>` wrapper |
| Q6 | State cap | **Per-file 50KB, session-file 2MB, LRU eviction** |
| Q7 | Edit-aware exception | **mtime stat**: suppress warning if file changed since last Read |

## Three Approaches Presented (this session)

### Approach A — Single-file hook (fast)

Everything in one file: `hooks/check-redundant-read.mjs`. Stdin parse + state IO + mtime stat + decide + stdout emit. Mixed concerns; hard to unit-test.

### Approach B — Hook + library split (recommended this session)

```
hooks/check-redundant-read.mjs              # thin entry: stdin → call lib → stdout
scripts/lib/cost-hygiene/state.mjs          # session-state JSON read/write + LRU evict
scripts/lib/cost-hygiene/decide.mjs         # pure: (path, stored, mtimeNow, sizeNow) → {warn, message}
tests/cost-hygiene-decide.test.mjs          # pure-function unit tests, no fs
tests/cost-hygiene-state.test.mjs           # state IO + LRU eviction, os.tmpdir() fixtures
```

Pure `decide()` makes the warning-format the unit of test-table coverage. Matches existing `scripts/lib/` directory shape (`installer/`, `briefing/`).

### Approach C — Reuse session-cost.mjs machinery — DROPPED

Fatal flaw: `session-cost.mjs` parses transcript JSONL **after-the-fact**. Hook fires **before** the transcript update for the current Read. State source mismatch. Cannot be salvaged without forking the parser.

**Approach B APPROVED 2026-05-28T19:34Z.** Next: present design sections one at a time (architecture → components → data flow → error handling → testing).

## Resume Instructions

1. **Approach B is approved** (this session). Task 3 completed, Task 4 in_progress.
2. **Section 1 (Architecture) APPROVED** by user. Content retained below for reference.
3. **Section 2 (Components) APPROVED** by user (with `approve, batch` directive). Content retained below.
4. **Sections 3 + 4 + 5 DELIVERED in one batch**, awaiting full-design approval. Content captured below under "Sections 3–5 (batched delivery, awaiting approval)". Do NOT re-present; wait for user's `approve` / `revise <area>` / `stop` decision.
5. On full design approval → mark Task 4 completed, Task 5 in_progress, write spec at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md`.
5. On full design approval → write spec at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md`.
6. Self-review spec (placeholder/contradiction/scope/ambiguity).
7. User reviews spec.
8. On user approval → invoke `superpowers:writing-plans` skill.

## Section 1 — Architecture (APPROVED 2026-05-28T19:39Z)

### Hook trigger

Add `PreToolUse` matcher in `hooks/hooks.json` scoped to `Read`:

```json
"PreToolUse": [
  {
    "matcher": "Read",
    "hooks": [
      { "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/check-redundant-read.mjs\"" }
    ]
  }
]
```

### Hook input (stdin JSON from Claude Code)

```jsonc
{
  "session_id": "abc123-def...",
  "tool_name": "Read",
  "tool_input": { "file_path": "C:/abs/path", "offset": 1, "limit": 2000 },
  "cwd": "C:/work/mega/hero-crew"
}
```

### Hook output (stdout) and exit semantics

Hook **always exits 0** (never blocks the Read). Stdout is one of:

- **Silent pass**: empty stdout (no reread, or mtime changed since last Read of this path)
- **Warning**: JSON conforming to Claude Code PreToolUse output schema:

```json
{
  "decision": "approve",
  "systemMessage": "<system-reminder>You already loaded /abs/path Nx this session at <ts>. Content unchanged (mtime <iso>). Prior content:\n\n<quoted body>\n\nDo not re-issue the Read.</system-reminder>"
}
```

`systemMessage` is injected before the actual Read result reaches the assistant.

### State location

`.claude/state/cost-hygiene/<session_id>.json` — per-session, gitignored (`.claude/state/` already in `.gitignore` per CLAUDE.md).

Schema:

```jsonc
{
  "session_id": "abc123",
  "first_seen": "2026-05-28T19:35:00Z",
  "last_seen": "2026-05-28T19:42:13Z",
  "total_bytes": 487231,
  "entries": {
    "/abs/path": {
      "read_count": 3,
      "first_read_at": "...",
      "last_read_at": "...",
      "mtime_at_last_read": "2026-05-28T18:11:02Z",
      "size_at_last_read": 27419,
      "content_bytes": 27419,
      "content": "..."
    }
  }
}
```

Per-file 50KB cap, session-file 2MB cap, LRU evict on overflow (per Q6).

### Three boundaries (Approach B)

1. **Hook entry** `hooks/check-redundant-read.mjs` — I/O only: parse stdin → call lib → write stdout → exit 0.
2. **State lib** `scripts/lib/cost-hygiene/state.mjs` — fs only: read/write session JSON, LRU evict, atomic write (write-temp + rename).
3. **Decide lib** `scripts/lib/cost-hygiene/decide.mjs` — pure: `decide({path, storedEntry, currentMtime, currentSize})` → `{action: "pass"|"warn", message: string|null}`. No fs, no stdin/stdout.

### Latency budget

Target: **<150ms p95**. Components: Node startup ~80ms, stdin parse <1ms, state read ~5–15ms, fs.stat ~1–3ms, decide <1ms, atomic write ~5–15ms, stdout <1ms. Worst case ~115ms.

## Section 2 — Components (APPROVED 2026-05-28T19:50Z)

### Component A — `hooks/check-redundant-read.mjs` (hook entry)

- **Does**: Reads stdin JSON, calls `loadSession` → `decide` → `saveSession` → writes stdout (empty or `{decision, systemMessage}`) → exits 0.
- **Use**: Invoked by Claude Code on every Read tool call. Never called manually.
- **Depends on**: `scripts/lib/cost-hygiene/state.mjs`, `scripts/lib/cost-hygiene/decide.mjs`, `node:fs/promises`, `node:path`. Zero third-party deps.
- **Public surface**: none — process entry point.
- **Target size**: ≤30 lines (CLAUDE.md "Hooks should stay small and auditable").

### Component B — `scripts/lib/cost-hygiene/state.mjs` (session state IO)

- **Does**: Reads/writes per-session JSON at `.claude/state/cost-hygiene/<sessionId>.json`. Enforces 50KB/file + 2MB/session caps via LRU eviction. Atomic writes (temp + rename).
- **Use**: `loadSession(repoPath, sessionId) → SessionState`; `saveSession(repoPath, sessionId, state) → Promise<void>`; `recordRead(state, path, mtime, size, contentOrNull) → SessionState` (pure transformation, no fs).
- **Depends on**: `node:fs/promises`, `node:path`. Pure helpers from `scripts/lib/util.mjs` if any. No imports from cost-advisor, session-cost, wakeup.
- **Public surface**: `loadSession`, `saveSession`, `recordRead`. Internal: `evictLRU`, `applyContentCap`.
- **Target size**: ≤200 lines.

### Component C — `scripts/lib/cost-hygiene/decide.mjs` (pure decision)

- **Does**: Given path + stored entry (or null) + current mtime + current size → returns `{action: "pass"|"warn", message: string|null}`. No fs. No side effects.
- **Use**: `decide({ path, storedEntry, currentMtime, currentSize, now }) → DecideResult`. Called by hook entry between `loadSession` and `saveSession`.
- **Depends on**: nothing. Pure.
- **Public surface**: `decide`. Internal: `formatWarning(entry, currentMtime)` (builds `<system-reminder>` block with prior content quoted per Q5).
- **Target size**: ≤120 lines.

### Component D — `tests/cost-hygiene-decide.test.mjs`

Table-driven, no fs. Covers Q1–Q7 matrix:

- first Read of path (no stored entry) → pass
- Read #2 of path, mtime unchanged → warn (per Q2 "every reread")
- Read #2 of path, mtime newer → pass (per Q7 edit exception)
- Read #N with content stored → warn message quotes the body
- Read #N with content absent (file was >50KB) → warn message says "(content omitted, file size NNN KB)"
- Read with mtime unchanged but size changed → warn (mtime is the gate per Q7; size recorded but not the trigger)

### Component E — `tests/cost-hygiene-state.test.mjs`

`os.tmpdir()` fixtures. Covers:

- `loadSession` returns empty shape when file absent
- `saveSession` atomic-write (temp + rename, leaves no `.tmp` on success)
- `recordRead` increments `read_count`, updates `last_read_at`, preserves `first_read_at`
- `recordRead` with content >50KB stores entry with `content: null`, `content_bytes: 0`
- `evictLRU` triggers when `total_bytes > 2_000_000`, drops least-recently-read first
- `evictLRU` never drops the entry being recorded
- malformed state file → `loadSession` returns empty shape + logs event (does NOT throw)

### Dependency graph

```
hooks/check-redundant-read.mjs
   ├── scripts/lib/cost-hygiene/state.mjs
   │      └── node:fs/promises, node:path
   └── scripts/lib/cost-hygiene/decide.mjs
          └── (none — pure)

tests/cost-hygiene-decide.test.mjs → scripts/lib/cost-hygiene/decide.mjs
tests/cost-hygiene-state.test.mjs  → scripts/lib/cost-hygiene/state.mjs (+ os.tmpdir fixtures)
```

DAG. No cycles. `decide.mjs` has zero deps → maximally testable.

### Why split state / decide

- **state.mjs** = side-effecting boundary. Tests need fs fixtures.
- **decide.mjs** = pure logic. Tests are tables — fast, deterministic, no fs.
- **Q5's warning format lives in `decide.mjs`** — the prevention lever per memory. Pure tests pin down its exact text + structure. Any future drift caught by test diff.

## Sections 3–5 (batched delivery, awaiting approval)

### Section 3 — Data flow

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
   │  3. resolve abs path           │
   └──────┬─────────────────────────┘
          ▼
   loadSession(cwd, session_id)        ──► fs read .claude/state/cost-hygiene/<sid>.json
          ▼
   fs.stat(abs_path)                   ──► currentMtime, currentSize
          │                                 (if stat fails: no-such-file → pass silently)
          ▼
   decide({path, storedEntry, currentMtime, currentSize, now})
          │
          ├── action: "pass"  ──────────►  silent: empty stdout, exit 0
          │
          └── action: "warn" + message
                  ▼
          stdout: {"decision":"approve","systemMessage":"<system-reminder>...</system-reminder>"}
                  ▼
   recordRead(state, path, mtime, size, content?)
          ▼
   saveSession(cwd, session_id, state) ──► fs atomic write (.tmp + rename)
          ▼
        exit 0
            ▼
   Claude Code reads stdout, injects systemMessage,
   then proceeds with the actual Read.
```

Single pass. No retries, no async fanout. Order: `loadSession` → `stat` → `decide` → `saveSession`. State written even on `pass` so `read_count` increments and `first_read_at` persists.

**Content acquisition** — when the hook records the first Read of a path, it doesn't have the content (Read hasn't run yet). Two options:

- **A**: Paired `PostToolUse` Read hook records content after Claude Code returns the Read result. Two hooks, each does one job.
- **B**: PreToolUse hook itself reads file (`fs.readFile`) to cache content before Read runs. One hook but double I/O.

**Recommendation: A** (paired PostToolUse). Avoids redundant file reads. Adds one more matcher to `hooks/hooks.json`.

### Section 4 — Error handling

**Cardinal rule: hook MUST NEVER prevent a Read from succeeding.** Any internal error → silent pass + log to `.claude/logs/events.jsonl`.

| Failure | Response |
|---|---|
| stdin not valid JSON | exit 0 silently, log `cost-hygiene:stdin-parse-fail` |
| `session_id` or `tool_input.file_path` missing | exit 0 silently, log `cost-hygiene:input-shape-fail` |
| State file corrupt JSON | `loadSession` returns empty shape, log `cost-hygiene:state-corrupt`, continue |
| State file unreadable (permission) | `loadSession` returns empty shape, log once per session |
| State file write fails | log `cost-hygiene:state-write-fail`, exit 0 with already-emitted stdout (decision still injected if warn) |
| `fs.stat` on target fails (no-such-file, perm) | treat as "no prior entry comparable" — pass + skip recording |
| `decide()` throws (defensive) | exit 0 silently, log `cost-hygiene:decide-throw` with stack |
| Node spawn slower than expected | no enforcement; Claude Code's own hook timeout governs |

**Log format**: one JSON line appended:

```json
{"ts":"<iso>","event":"cost-hygiene:<code>","session_id":"<sid>","detail":"<short>"}
```

Top-level `try/catch` wraps `main()`. No exceptions propagate.

**Atomic write safety** — `saveSession` writes to `<path>.tmp.<pid>` then `fs.rename`. Crash between write+rename leaves orphan `.tmp.*`. Cleanup on next `loadSession`: glob `<sid>.json.tmp.*`, delete any older than 60s. Single-pass best-effort.

### Section 5 — Testing

#### `tests/cost-hygiene-decide.test.mjs` (pure, table-driven)

Cases:

- first read, no stored entry → pass
- reread, mtime unchanged → warn (message contains "already loaded 1×", "Prior content:", content excerpt)
- reread, mtime newer → pass
- 5th reread, content stored → warn (message contains "already loaded 4×")
- reread, content omitted (>50KB) → warn (message contains "content omitted, file size 87 KB")
- reread, mtime unchanged + size changed → warn (mtime is gate per Q7; size recorded but not trigger)

Each row = one `test()` block. Assertions: `action` exact + message-substring presence.

#### `tests/cost-hygiene-state.test.mjs` (fs, `os.tmpdir()` fixtures)

- `loadSession` empty when file absent
- `saveSession` then `loadSession` round-trip preserves entries
- `saveSession` atomic — no `.tmp.<pid>` left on success
- `recordRead` increments `read_count`, updates `last_read_at`, preserves `first_read_at`
- `recordRead` caps content at 50KB, sets `content:null` when oversized
- `evictLRU` drops least-recently-read on session-cap overflow
- `evictLRU` never drops the entry being recorded
- `loadSession` on corrupt JSON returns empty + logs event (no throw)
- `loadSession` cleans up stale `.tmp.<pid>` files older than 60s

Each `setup()` uses `await fs.mkdtemp(path.join(os.tmpdir(), "cost-hygiene-"))`. Teardown recursive delete.

#### Dogfood plan (before promoting to plugin default-on)

- **Step 1**: land hook **disabled** in `hooks/hooks.json` — commented out or behind `CREW_COST_HYGIENE=1` env-var.
- **Step 2**: enable locally on this repo for one full work-session. Measure: did `costHealth.topConcern` drop below "redundant Read" as #1? Did total session $ drop?
- **Step 3**: yes → flip default to on in next plugin minor release. No → analyze: was warning visible? Iterate on `decide.mjs` message format.

#### Integration test (added with hook landing)

`tests/cost-hygiene-hook.test.mjs` spawns the hook script as subprocess:

- hook with no stdin exits 0 silently
- hook with valid first-read stdin emits empty stdout, writes state
- hook with reread stdin emits `{decision, systemMessage}` with prior content
- hook with corrupt state file exits 0, allows read, logs event

`child_process.spawn("node", [HOOK_PATH])`, writes stdin, asserts stdout + state-file delta. ~150ms per test.

#### Test count gate

Repo currently has **112 tests**. Hook lands with ≥18 new (6 decide + 9 state + 3+ integration). New floor: **130 tests**. CI test-count guard deferred to FEAT-024-style enforcement work.

## Reference

- F-grade root cause: brief-me's `costHealth.topConcern` = "114 redundant Read calls of files already loaded this session." (5 recent reports, avg $419.68/session)
- Existing detector: `scripts/lib/cost-advisor.mjs:496-502` (id `file-rereads`, trigger `>= 3`, severity bands 5/15). Already surfaces recommendation; reactive only.
- Existing data source: `scripts/lib/session-cost.mjs:703-707` (`collectFileReReadEntries`), `:790-791` (`fileReReadCount`), `:820` (`fileReReadTopPaths` — top 5). Parses transcript JSONL post-hoc.
- Existing hooks anatomy: `hooks/hooks.json` defines `SessionStart`, `TaskCreated`, `TaskCompleted`, `SubagentStart`, `SubagentStop`, `TeammateIdle` — all delegate to `${CLAUDE_PLUGIN_ROOT}/scripts/log_event.sh`. No `PreToolUse` today.
- Plugin shape constraint (CLAUDE.md): "Hooks should stay small and auditable." Approach B's thin entry honors this; A doesn't.
- Memory `feedback_cost_discipline.md` already exists; clearly insufficient on its own (the session that wrote it still had 114 rereads).

## Cross-Workstream Note

This brainstorm is a **detour** from the TS-port brainstorm. The TS-port handoff (`20260528T190032Z`) is still mid-flight with 5 open Error Handling Qs. Next session must choose which workstream resumes:

- **Option A**: continue cost-hygiene brainstorm (this handoff) — pick Approach B, design sections, spec, plan.
- **Option B**: resume TS-port brainstorm (sibling handoff) — answer the 5 Error Handling Qs, then Testing section, then spec.
- **Option C**: park both, address something else surfaced by next session's `crew brief-me`.

No artifact-state conflict between the two workstreams — independent specs at independent paths.
