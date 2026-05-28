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
| 4 | Present design sections | 🔄 **in_progress — architecture section next** |
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
2. **Present design sections one at a time**, awaiting per-section approval (skill instruction):
   - Architecture: how PreToolUse fires, hook input shape, state location (`.claude/state/cost-hygiene/<session_id>.json`), output protocol (Claude Code hook stdout/exit semantics).
   - Components: 3 modules (entry, state, decide) + 2 test files; for each — purpose, public surface, dependencies (point of code-conventions.md "what does it do / how do you use it / what does it depend on" rule).
   - Data flow: stdin → parse → load state → stat file → decide → emit `<system-reminder>` block → write state → exit. Diagram.
   - Error handling: hook must NEVER block a Read on its own error (corrupt state file, fs error, JSON parse fail). Always fall through to allow. Log to `.claude/logs/events.jsonl` on internal error.
   - Testing: table-driven for `decide()` covering Q1–Q7 decision matrix (every reread, mtime-changed, content under/over 50KB cap, LRU eviction at 2MB, etc.).
4. On full design approval → write spec at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md`.
5. Self-review spec (placeholder/contradiction/scope/ambiguity).
6. User reviews spec.
7. On user approval → invoke `superpowers:writing-plans` skill.

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
