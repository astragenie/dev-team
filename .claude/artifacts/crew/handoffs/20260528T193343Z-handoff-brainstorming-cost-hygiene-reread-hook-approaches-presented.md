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
| 4 | Present design sections | 🔄 **in_progress — Sections 1 (Architecture) ✅ APPROVED + 2 (Components) DELIVERED awaiting approval; Sections 3–5 pending** |
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
3. **Section 2 (Components) DELIVERED**, awaiting approval. Content captured below under "Section 2 — Components (delivered, awaiting approval)". Do NOT re-present; wait for user's `approve` / `revise <area>` / `stop` decision.
4. On Section 2 approval → present Section 3 (Data flow). Pending sections 3–5 outlined under "Pending sections (not yet presented)" below.
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

## Section 2 — Components (delivered, awaiting approval)

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

## Pending sections (not yet presented)

- **Section 3 — Data flow**: stdin → parse → load state → stat file → decide → emit `<system-reminder>` block → write state → exit. With diagram.
- **Section 4 — Error handling**: hook NEVER blocks Read on its own error (corrupt state, fs fail, JSON parse fail) — always fall through to allow. Log to `.claude/logs/events.jsonl` on internal error.
- **Section 5 — Testing**: table-driven for `decide()` covering Q1–Q7 decision matrix (every reread fires, mtime-changed suppresses, content under/over 50KB cap, LRU eviction at 2MB, session-id partition, malformed state file). State-lib tests use `os.tmpdir()` fixtures. Plus dogfood plan: run hook against this repo's actual workflow before promoting to plugin default-on.

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
