---
phase: post-v0.3.11
feature: plugin-performance-stabilization
slice: null
kind: handoff
status: awaiting-user-commit-decision
mode: single-session
created: 2026-06-01T11:53:49Z
updated: 2026-06-01T12:10:00Z
---

# Task Handoff: plugin performance stabilization — 6 FEAT files written, awaiting commit decision

## State update — 2026-06-01T12:10Z

User picked option 2 (backlog). Six FEAT files now exist as untracked
files under `docs/backlog/pending/`:

- `FEAT-029.md` — Promote cost-hygiene reread hook to default-on (P0, autonomous_safe: yes)
- `FEAT-030.md` — Builder self-verify + reviewer-bundled validation (P0, autonomous_safe: no)
- `FEAT-031.md` — Sonnet-default for mechanical slices (P0, autonomous_safe: no)
- `FEAT-032.md` — Artifact-path-only subagent returns (P1, autonomous_safe: yes)
- `FEAT-033.md` — Tool-failure preflight hook (P1, autonomous_safe: yes)
- `FEAT-034.md` — Disambiguate aggregate vs per-slice cost reports (P2, autonomous_safe: yes)

Plus this handoff artifact itself, also untracked.

`git status --short` (relative to repo root):

```
?? .claude/artifacts/crew/handoffs/20260601T115349Z-handoff-perf-stabilization-feat-backlog-awaiting-user-choice.md
?? docs/backlog/pending/FEAT-029.md
?? docs/backlog/pending/FEAT-030.md
?? docs/backlog/pending/FEAT-031.md
?? docs/backlog/pending/FEAT-032.md
?? docs/backlog/pending/FEAT-033.md
?? docs/backlog/pending/FEAT-034.md
```

No code changes. No agent / skill / hook edits. Markdown-only.

### Continuation plan

User must pick one before next workflow step:

1. **commit** — single commit `docs(backlog): add FEAT-029..034 — plugin performance stabilization` covering all 7 files. After commit, repo is clean and either `triage` or `slice` can run on a clean diff.
2. **triage** — `/loop:backlog-triage` to score + move files from `pending/` to `triaged/`. Recommend committing first so triage moves are clean diffs.
3. **slice** — `/loop:slice-from-feature --id FEAT-029` to open dogfood slice immediately. Same dirty-diff issue as `triage` — recommend committing first.
4. **wip** — leave untracked across sessions. Next session must consult this handoff before any backlog work.

Recommended sequence: **commit → triage → slice FEAT-029**.

### Why holding instead of committing

Per project rule (CLAUDE.md → "NEVER commit changes unless the user
explicitly asks you to"), commit authorization required. User has
not yet typed `commit` (or any of the four options above) in
response to the pick-one prompt.

## State update — 2026-06-01T12:25Z — brainstorming mid-flight

User invoked `/superpowers:brainstorming` for FEAT-029. Brainstorming
skill is active. Workflow has progressed through clarifying questions
+ approach selection + start of design presentation. Design Section 1
presented; awaiting user approval.

### Clarifying answers locked

- **Topic:** FEAT-029 — dogfood + default-on flip.
- **Dogfood bar:** state-file shape + measured reread reduction + no side-effects.
- **Baseline:** A/B same task, hook off then on, diff counts.
- **Side-effects surface (all four required):**
  - tool-call latency < +50ms p90
  - zero false-positive blocks
  - no state-file growth runaway
  - all 8 CI gates green
- **A/B task:** `/crew:brief-me` + small edit. Predictable repeat-read pattern.
- **Rollback safety net:** env-var off + crash-safe + patch path. Belt+suspenders.
- **Pass threshold:** ≥50% reread drop, 1 A/B pair.

### Approach selected

**Approach A — lead-driven manual dogfood.** User runs two fresh
sessions (env var off / on), lead reads both cost reports, diffs
`fileReReadCount`, writes evidence handoff, opens flip slice.

Rejected:
- **B — scripted A/B harness:** overengineered; spawning interactive
  Claude Code sessions from a script is non-trivial.
- **C — replay from cost-report history:** workloads not matched;
  fails the "1 A/B pair" requirement.

### Design presented so far — Section 1: workflow architecture

Two-slice plan:

**Slice A — Dogfood evidence**
1. Fresh session, `$env:CREW_COST_HYGIENE=0`, run `/crew:brief-me`,
   one small Edit, close.
2. Capture cost-report path.
3. Second fresh session, `$env:CREW_COST_HYGIENE=1`, same task, close.
4. Capture second cost-report path.
5. Lead diffs `fileReReadCount`, checks state-file shape + size,
   computes latency delta from `toolResultP90`, writes evidence
   handoff under `.claude/artifacts/crew/handoffs/`.
6. PASS gate: ≥50% reread drop AND no false-positive blocks AND
   <+50ms p90 latency AND state-file bounded AND CI green.

**Slice B — Flip + release (only if Slice A PASS)**
1. Edit `hooks.json` default-on. Keep `CREW_COST_HYGIENE=0` opt-out.
2. Wrap hook in try/catch → silent no-op on error.
3. Bump `package.json` + `.claude-plugin/marketplace.json` to v0.3.12.
4. `CHANGELOG.md` entry.
5. All 8 CI gates green.
6. Tag + release.

**Status: Section 1 presented to user, awaiting "looks right" approval
before continuing to Section 2 (components/files touched), Section 3
(data flow), Section 4 (error handling), Section 5 (testing).**

### Continuation plan for next session

If session resumes mid-brainstorming:

1. Re-read this handoff. Confirm above constraints + Approach A still hold.
2. Resume at Section 2 (components/files touched), or whichever section
   the user is reviewing.
3. After all sections approved, write design doc to
   `docs/superpowers/specs/2026-06-01-feat-029-dogfood-design.md`.
4. Spec self-review (placeholder / consistency / scope / ambiguity).
5. User reviews spec file.
6. Invoke `superpowers:writing-plans` skill — terminal state.

### Untracked files state (unchanged from previous State Update)

```
?? .claude/artifacts/crew/handoffs/20260601T115349Z-...-awaiting-user-choice.md
?? docs/backlog/pending/FEAT-029.md
?? docs/backlog/pending/FEAT-030.md
?? docs/backlog/pending/FEAT-031.md
?? docs/backlog/pending/FEAT-032.md
?? docs/backlog/pending/FEAT-033.md
?? docs/backlog/pending/FEAT-034.md
```

Still awaiting commit authorization. Brainstorming output (design doc)
will add `docs/superpowers/specs/2026-06-01-feat-029-dogfood-design.md`
to the untracked set once written.

## State update — 2026-06-01T12:40Z — triage path-mismatch detected

User invoked `/loop:backlog-triage`. Command returned `{ triaged: 0,
results: [] }`. Investigation shows path mismatch:

- `CLAUDE.md` declares `docs/backlog/{pending,triaged,in-progress,done}/`
  as the canonical Engineering OS backlog location. All 6 FEAT files
  this session wrote live there.
- `.claude/loop.json` `loop.backlogPath` is set to `docs/backlog`.
- `/loop:backlog-triage` CLI (loop plugin 0.5.5) actually scans
  `.claude/artifacts/loop/backlog/pending/` (empty) and ignores the
  `loop.json` backlogPath setting.

Possible loop-plugin bug or convention drift between hero-crew and
loop. Not investigated this session. Worth filing as a loop-side
issue separately.

### Current state of 6 FEAT files

All have `status: pending`, `priority` set (P0/P0/P0/P1/P1/P2),
`category: performance`, `autonomous_safe` set, `created: 2026-06-01`.
They need only:
- `status: pending` → `triaged`
- `git mv` from `docs/backlog/pending/` to `docs/backlog/triaged/`

Heuristic triage from the CLI would add no value (all fields already
filled).

### Three options presented to user

1. **manual** — edit frontmatter + `mv` files. Bypasses loop CLI
   path-mismatch. Clean, single source of truth. **Recommended.**
2. **dual-write** — copy files into `.claude/artifacts/loop/backlog/pending/`
   then re-run `/loop:backlog-triage`. Keeps loop CLI happy but
   duplicates files across two trees. Convention drift gets worse.
3. **skip triage** — leave in `pending/`, open slice via
   `/loop:slice-from-feature --id FEAT-029`. May hit same path
   mismatch downstream; not yet investigated.

User has not yet picked.

### Continuation plan for next session (revised)

If session resumes here:

1. Re-read this handoff. Confirm three options still valid.
2. Get user pick on triage approach.
3. If `manual`: edit 6 FEAT frontmatters + `mv` to `docs/backlog/triaged/`
   in one batch.
4. After triage: resume brainstorming Section 2 (components/files touched)
   for FEAT-029, or open the dogfood slice if user wants to skip remaining
   design sections.
5. Still pending: commit authorization, design doc, spec self-review,
   user spec review, writing-plans skill invocation.

### Untracked files state (unchanged)

Still 7 untracked files from earlier State Updates. No new files in this
update — only a CLI run that returned 0 results.

## State update — 2026-06-01T12:55Z — manual triage executed, WIP continues

User said "go" after the three-option triage menu (manual / dual-write /
skip). Interpreted as accept the recommended option (manual). Executed:

1. Edited `status: pending` → `status: triaged` in all 6 FEAT
   frontmatters via the Edit tool.
2. `mv` all 6 files from `docs/backlog/pending/` to
   `docs/backlog/triaged/` via Bash.
3. `git status --short` confirms 6 files now untracked under
   `docs/backlog/triaged/` instead of `docs/backlog/pending/`.

`docs/backlog/pending/` now contains only `FEAT-024.md` (pre-existing,
cross-repo loop quality gate, unrelated to perf — left as-is).

### Explicit WIP intent (re-stated for stop hook)

This session is **intentionally** mid-flight WIP. No commit
authorization has been given. Per project rule (CLAUDE.md → "NEVER
commit changes unless the user explicitly asks you to"), the agent
is holding all 7 untracked files (6 FEATs + this handoff) for the
user's commit decision.

The handoff artifact, taken as a whole (this State Update + State
Updates #1–3 + Original analysis below), is sufficient to resume
work in any future session.

### Active brainstorming state (re-confirmed)

Brainstorming for FEAT-029 (superpowers:brainstorming skill) remains
active. Progress:

- Clarifying questions: complete (6 answers locked, see State Update #2).
- Approach selection: complete (Approach A, lead-driven manual dogfood).
- Design Section 1 (workflow architecture): **presented, awaiting "looks
  right" approval**.
- Design Sections 2–5: not yet presented.
- Design doc: not yet written.
- Spec self-review: not yet run.
- User spec review: not yet started.
- `superpowers:writing-plans` skill: not yet invoked.

### Untracked files state — current

```
?? .claude/artifacts/crew/handoffs/20260601T115349Z-handoff-perf-stabilization-feat-backlog-awaiting-user-choice.md
?? docs/backlog/triaged/FEAT-029.md
?? docs/backlog/triaged/FEAT-030.md
?? docs/backlog/triaged/FEAT-031.md
?? docs/backlog/triaged/FEAT-032.md
?? docs/backlog/triaged/FEAT-033.md
?? docs/backlog/triaged/FEAT-034.md
```

### Next-session resume checklist

1. Read this handoff end-to-end. Confirm all State Updates still apply.
2. Confirm WIP files still untracked or pick up post-commit history.
3. Offer user the four-option menu: resume / commit / slice / stop.
4. If resume: present Design Section 2 (components/files touched) for FEAT-029.
5. If commit: `docs(backlog): add FEAT-029..034 (triaged) — plugin performance stabilization` + handoff in one commit.
6. If slice: `/loop:slice-from-feature --id FEAT-029` — note loop CLI path-mismatch may bite again; manual slice scaffold may be needed.
7. If stop: leave WIP, next session resumes from step 1.

## Original analysis (preserved below)

# Task Handoff: plugin performance stabilization — 6 candidate FEATs, awaiting user execution choice

## Objective

User asked "what features are next, I want to concentrate on plugin performance stabilization." Session produced an evidence-backed list of 6 candidate FEATs derived from cost telemetry + existing cost-discipline memory. Work is paused at the decision gate: user must pick an execution path before any implementation begins.

## Owner

Lead (next session). User has not yet selected execution path.

## Allowed scope

- Either execute FEAT-029 directly (dogfood path), or
- Write FEAT-029 through FEAT-034 as files into `docs/backlog/pending/` via `/loop:backlog-add`, or
- Pivot to a different perf-related direction the user supplies.

## Forbidden scope

- Do not start implementation work on any of the 6 candidate FEATs without explicit user pick.
- Do not edit `agents/lead.md` or `agents/builder.md` or `agents/reviewer.md` without an opened slice and a review gate (FEAT-030, FEAT-031 are `autonomous_safe: false`).
- Do not flip cost-hygiene hook default-on (FEAT-029 last step) without the dogfood evidence handoff in hand.

## Deliverable

Six candidate FEAT entries proposed, ranked by impact, with evidence + autonomous-safety flag:

### P0 — Direct wins from telemetry

1. **FEAT-029** — Promote cost-hygiene reread hook to default-on.
   - Evidence: aggregate cost report shows 114 redundant Reads/slice; hook shipped v0.3.11 default-off; sits in `next` field of last completed run.
   - Path: dogfood `CREW_COST_HYGIENE=1` one session → record state-file evidence → flip default → bump v0.3.12.
   - autonomous_safe: **yes**.

2. **FEAT-030** — Builder self-verify + reviewer-bundled validation.
   - Evidence: 49 subagent dispatches on SLICE-08 cost report; cost-discipline rule #3 (`feedback_cost_discipline.md`).
   - Path: amend `agents/builder.md` (self-run lint+test+typecheck before handoff) + `agents/reviewer.md` (emit validation-evidence note when tests-already-green code-only) + skip `crew:validator` in that branch.
   - autonomous_safe: **no** — agent prompt edits require human review.

3. **FEAT-031** — Sonnet-default for mechanical slices.
   - Evidence: opus-4-7 burned $1821 of $2098 recent USD (86.7%); cost-discipline rule #1.
   - Path: lead-agent gate that picks model by slice shape (spec frames design → Sonnet; ambiguous → Opus). Codify rule #1 into `agents/lead.md`.
   - autonomous_safe: **no** — lead prompt edit.

### P1 — Compaction + cache hygiene

4. **FEAT-032** — Artifact-path-only subagent returns.
   - Evidence: 34 compactions/slice on SLICE-08; cost-discipline rule #2.
   - Path: PostToolUse hook on `Agent` that warns when subagent return body exceeds N bytes without an artifact path; update agent prompts to mandate write-then-return-path.
   - autonomous_safe: **yes** (additive hook + reviewed prompt update).

5. **FEAT-033** — Tool-failure preflight.
   - Evidence: 3.4–4.4% tool fail rate across recent slices; cost-discipline rule #5.
   - Path: PreToolUse hook running cheap preflight on Bash/PowerShell chains (cwd exists, env-var ref shape matches shell). Soft-warn only, never block.
   - autonomous_safe: **yes**.

### P2 — Cost-attribution signal cleanup

6. **FEAT-034** — Disambiguate aggregate vs per-slice cost reports.
   - Evidence: every recent cost report has `aggregateAll: true`, `sourceCount: 4–5`. Cost grade "F" driven by aggregate; per-slice reread is 9, not 114. Aggregate sums across worktrees, looks like a regression that isn't real.
   - Path: split `cost-report` into `cost-report-slice` (one session, the slice that ran) vs `cost-report-aggregate` (rollup). Brief-me grades only the per-slice variant.
   - autonomous_safe: **yes**.

## Recommended sequence

**029 → 030 → 032 → 033 → 031 → 034**.

Rationale:
- 029 first — zero-risk, validates infra already shipped, cuts reread waste immediately.
- 030 + 032 next — biggest compaction/subagent wins, both already in cost-discipline memory.
- 033 — cheap, additive, no prompt edits.
- 031 last among prompt edits — highest USD lever but lead-prompt edits need careful review.
- 034 — cosmetic but unblocks honest cost grading.

## Changed files or evidence

- Read `docs/backlog/pending/FEAT-024.md` — only pending item, not perf-related (cross-repo quality gate).
- Read `docs/backlog/product-backlog.md` — Phase 1 closed, no perf phase.
- Read memory `feedback_cost_discipline.md` — six rules from SLICE-61 post-mortem already pinned, three of the six candidate FEATs (030, 031, 032) codify those rules into agent prompts / hooks.
- No code changes. No new files committed. `git status --short` clean.

## Confidence level

High on the analysis (telemetry directly sourced from `brief-me` cost reports + costHealth field; rules cross-checked against existing memory file). Low on execution path until user picks one.

## Risks or open questions

- **Aggregate-vs-per-slice noise (FEAT-034)** may be inflating the "F" grade. Before treating cost grade F as actionable, confirm whether the 114 reread count is true regression or aggregation double-count across 4 source projects. If false signal, FEAT-034 jumps to P0.
- **Lead-prompt edits (FEAT-030, FEAT-031)** are `autonomous_safe: false` per `FEAT-003` precedent. Loop cannot pick these without human review on the slice handoff. If user wants loop-autonomous execution, sequence 029 → 032 → 033 → 034 only; defer 030 + 031 to interactive sessions.
- **No backlog file written.** If user pivots away from these FEATs before backlog-add, this handoff is the only record. If user picks `dogfood` or `backlog`, next session should consult this file before re-deriving the analysis.

## Suggested next handoff

Two branches depending on user pick:

- **dogfood** branch: next handoff captures FEAT-029 task 7 execution (state-file evidence + default-on flip + v0.3.12 release prep).
- **backlog** branch: next handoff captures `/loop:backlog-add` execution for FEAT-029…034, with triage scores assigned by PM agent.

Either branch should reference this handoff as the analysis source.
