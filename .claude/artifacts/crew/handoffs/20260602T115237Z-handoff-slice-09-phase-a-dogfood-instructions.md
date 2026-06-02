---
phase: post-v0.3.11
feature: FEAT-029
slice: SLICE-09
kind: handoff
status: phase-a-awaiting-user-driven-sessions
mode: user-driven
created: 2026-06-02T11:52:37Z
updated: 2026-06-02T11:52:37Z
---

# Task Handoff: SLICE-09 Phase A dogfood — user-driven A/B sessions required

## Objective

Capture before/after evidence that the v0.3.11 cost-hygiene reread hook
cuts redundant Read calls without regressing tool-call latency, blocking
behavior, or state-file size. Evidence is the gate for Phase B (flip
default in `hooks/check-redundant-read.mjs:74` + `hooks/record-read-content.mjs:80`
+ bump v0.3.12).

## Owner

User (this session is paused at the Phase A gate). Cannot be executed from
inside a running Claude Code session — A/B requires two **fresh** sessions
launched from a clean shell with different env-var settings.

## Why not inline

`process.env.CREW_COST_HYGIENE` is read by the hook process at hook
invocation time, but env vars inherited from the parent Claude Code
process. Inverting the env var mid-session does not retroactively re-run
prior Read tool calls and produces no comparable baseline.

## A/B procedure

Run both sessions on the **identical** small task:
1. `/crew:brief-me`
2. one small `Edit` (any file — pick a single-line typo fix, do not
   commit the edit).
3. stop the session.

### Session A — baseline (hook off)

```powershell
cd C:\work\mega\hero-crew
$env:CREW_COST_HYGIENE = "0"
claude
```

Then in the session:
```
/crew:brief-me
```
Make one small Edit. Stop the session.

Record the cost-report path that lands under
`.claude/artifacts/crew/cost/`.

### Session B — hook on

Open a **fresh** Claude Code session (do not reuse Session A's shell):

```powershell
cd C:\work\mega\hero-crew
$env:CREW_COST_HYGIENE = "1"
claude
```

Same task: `/crew:brief-me` → one small Edit → stop.

Record the second cost-report path.

## Evidence to collect

After both sessions stop, populate this handoff with:

1. **Cost report paths** — both `.claude/artifacts/crew/cost/<ts>-cost-report-*.md`
   files written by Session A and Session B.
2. **`fileReReadCount` delta** — read the `fileReReadCount` field from
   each cost report. Compute Session B / Session A. Target: ≥50% drop.
3. **State file inspection** — after Session B closes, stat
   `.claude/state/cost-hygiene/<session_id>.json`. Confirm size ≤ 2 MB
   and parses as valid JSON. Record byte count + `total_bytes` field.
4. **Latency delta** — diff `toolResultP90` between the two reports.
   Target: Session B p90 ≤ Session A p90 + 50 ms.
5. **Block scan** — grep `.claude/logs/payloads/` for Session B
   for any tool-call denied/blocked decisions attributed to the hook.
   Target: zero blocks (hook is record-only + soft-warn).
6. **CI status** — run `npm test && npm run lint && node --test`
   locally (or check the latest CI run on origin/main). Target: green.

## PASS / FAIL verdict

PASS gate, all four required:
- reread drop ≥ 50% (or absolute drop ≥ 1 if per-slice baseline is tiny)
- p90 latency delta < +50 ms
- zero blocks
- state file ≤ 2 MB and valid JSON
- CI green

If PASS → continue to Phase B (next handoff: open SLICE-09 Phase B,
flip both hook scripts, bump version, CHANGELOG, ship v0.3.12).

If FAIL on any → investigate, do NOT flip default. Open follow-up
slice to fix the regression first.

## Continuation plan

Resume in a future session after both A/B sessions complete:

1. Read this handoff. User pastes Session A + Session B cost-report
   paths into the conversation.
2. Lead reads both reports, computes the deltas above, writes the
   PASS/FAIL verdict back into this handoff (in-place update),
   timestamped.
3. If PASS: open Phase B. Two-file edit (line 74 and 80) +
   `tests/cost-hygiene-hook.test.mjs` opt-out test + `package.json`
   + `marketplace.json` + `CHANGELOG.md`. All 8 CI gates. Single
   commit + tag v0.3.12 (user-triggered per `CLAUDE.md` Release
   workflow).
4. If FAIL: write a fix-slice handoff describing the regression and
   stop.

## Changed files or evidence

- Slice scaffold: `docs/ai-loop/slices/pending/SLICE_09_DOGFOOD-AND-FLIP-COST-HYGIENE-REREAD-HOOK-DEFAULT-ON.md`
- Feature promoted: `docs/backlog/triaged/FEAT-029.md` →
  `docs/backlog/in-progress/FEAT-029.md` with `slices: [SLICE-09]`.
- Source analysis (read-only): `hooks/check-redundant-read.mjs`,
  `hooks/record-read-content.mjs`, `hooks/hooks.json`,
  `scripts/lib/cost-hygiene/state.mjs`.

## Confidence level

High on Phase A procedure design (matches Approach A from the
brainstorming session captured in
`20260601T115349Z-handoff-perf-stabilization-feat-backlog-awaiting-user-choice.md`).
High on Phase B implementation shape (env-gate inversion is two lines).
Medium on the threshold: if per-slice baseline reread is already tiny
(~9), the 50% relative target may compress to absolute "at least 1
fewer reread"; this is acknowledged in the slice AC-2 mitigation.

## Risks or open questions

- See SLICE-09 Risks + Open questions sections in the slice file.
- The handoff's recorded threshold can be loosened with reviewer
  approval if per-slice baseline is too small to give a meaningful
  ratio.

## Suggested next handoff

After A/B sessions complete: `<ts>-handoff-slice-09-phase-a-verdict.md`
with PASS or FAIL and the four metrics. If PASS, the verdict handoff
explicitly triggers the Phase B implementation slice continuation.
