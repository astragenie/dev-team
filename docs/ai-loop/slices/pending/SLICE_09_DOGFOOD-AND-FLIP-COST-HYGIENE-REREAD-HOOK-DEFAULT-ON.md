---
id: SLICE-09
feature: FEAT-029
title: Dogfood + flip cost-hygiene reread hook default-on
status: pending
priority: P0
autonomous_safe: true
created: 2026-06-02
---

# SLICE-09: Dogfood + flip cost-hygiene reread hook default-on

- **Priority**: P0
- **Status**: Pending
- **Author**: herolegion
- **Created**: 2026-06-02
- **Parent Feature**: FEAT-029

## Objective

Promote the v0.3.11 `CREW_COST_HYGIENE` PreToolUse + PostToolUse Read-tracker
hook from env-var-gated default-off to default-on, after capturing dogfood
evidence that it cuts redundant Read calls without regressing latency, CI,
or producing false-positive blocks.

## Why now

- Aggregate cost reports show 114 redundant Reads / slice on recent SLICE-08
  runs. The infrastructure to fix this already shipped in v0.3.11; only the
  default is wrong.
- FEAT-029 is the top-priority P0 in the perf-stabilization backlog
  (FEAT-029..034) and is the recommended first slice in the
  `20260601T115349Z-handoff-perf-stabilization-feat-backlog-awaiting-user-choice.md`
  handoff.
- Unblocks: cleaner per-slice grade signal (FEAT-034), removes confounding
  reread noise from upcoming subagent/compaction wins (FEAT-030, FEAT-032).

## In scope

**Phase A — Dogfood evidence (lead-driven, two fresh sessions, manual)**

- Run two fresh Claude Code sessions on identical A/B task:
  `/crew:brief-me` + one small Edit + stop.
- Session A: `$env:CREW_COST_HYGIENE=0` (baseline, default-off).
- Session B: `$env:CREW_COST_HYGIENE=1` (hook active).
- Capture both cost-report artifact paths.
- Diff `fileReReadCount` between the two reports.
- Inspect `.claude/state/` reread-tracker file shape + size after Session B.
- Compute latency delta from `toolResultP90`.
- Confirm zero false-positive blocks in Session B transcript.
- Write evidence handoff under `.claude/artifacts/crew/handoffs/` named
  `<ts>-handoff-feat-029-dogfood-evidence.md` containing: both report
  paths, reread delta, state-file path/size, p90 delta, CI status,
  PASS / FAIL verdict against thresholds.

**Phase B — Flip + release (only if Phase A PASS)**

- Edit `hooks.json` so the PreToolUse + PostToolUse Read matchers fire
  by default. The env-var gate inverts: `CREW_COST_HYGIENE=0` becomes
  the explicit opt-out path.
- Wrap hook entry points in try/catch → silent no-op on error (no
  blocking failures).
- Bump `package.json` `version` → `0.3.12`.
- Bump `.claude-plugin/marketplace.json` `plugins[name=crew].version`
  → `0.3.12`.
- Add `CHANGELOG.md` v0.3.12 section dated 2026-06-02 (or release date)
  noting the default flip + opt-out path.
- All 8 CI gates green locally and on CI.

## Out of scope

- Promoting any other FEAT-029..034 candidate (FEAT-030 builder self-verify,
  FEAT-031 sonnet-default, FEAT-032 artifact-path-only returns,
  FEAT-033 tool-failure preflight, FEAT-034 disambiguate cost reports).
- Editing `agents/builder.md` / `agents/reviewer.md` / `agents/lead.md`
  prompts — those are FEAT-030 + FEAT-031 and are `autonomous_safe: false`.
- Changing the hook's matcher list, byte threshold, or state-file
  format. This slice flips the default only.
- Tagging + pushing the v0.3.12 release. Release workflow remains
  user-triggered per `CLAUDE.md` → Release workflow.

## Acceptance criteria

Each criterion must be testable with evidence per
`01-loop-control/EVIDENCE_RULES.md`.

- [ ] AC-1: Phase A evidence handoff exists at
      `.claude/artifacts/crew/handoffs/<ts>-handoff-feat-029-dogfood-evidence.md`
      and references both A/B cost-report artifact paths.
- [ ] AC-2: `fileReReadCount` drops by ≥50% comparing Session A baseline
      to Session B (hook on). Evidence: numbers from the two cost reports
      cited in AC-1's handoff.
- [ ] AC-3: Session B transcript shows zero hook-induced tool-call blocks
      (hook is soft-warn / record-only; never blocks). Evidence: scan
      Session B `.claude/logs/payloads/` for any `block` decision attributed
      to the cost-hygiene hook.
- [ ] AC-4: Tool-call `toolResultP90` delta between Session A and Session B
      is < +50ms (no measurable latency regression). Evidence: diff the
      two cost reports' `toolResultP90` fields.
- [ ] AC-5: `.claude/state/cost-hygiene/<session_id>.json` remains
      bounded after Session B (size ≤ `SESSION_CAP_BYTES` = 2 MB per
      `scripts/lib/cost-hygiene/state.mjs`, valid JSON, LRU eviction
      observed when nearing cap). Evidence: file stat + parse check
      + total_bytes field inspection recorded in evidence handoff.
- [ ] AC-6: `hooks/check-redundant-read.mjs` line 74 and
      `hooks/record-read-content.mjs` line 80 invert the env-var gate:
      hook body runs when `CREW_COST_HYGIENE !== "0"` (default-on) and
      short-circuits exit 0 when `CREW_COST_HYGIENE === "0"`. Evidence:
      diff of both files; new fresh-install e2e-smoke run shows the
      hook records reads without setting the env var.
- [ ] AC-7: Explicit opt-out via `CREW_COST_HYGIENE=0` disables both
      hooks. Evidence: existing `tests/cost-hygiene-hook.test.mjs`
      updated so the off-case asserts `=== "0"` short-circuit and the
      on-case covers both unset and any non-`0` value; manual run
      confirms no reread state is written when opt-out is set.
- [ ] AC-8: `package.json` and `.claude-plugin/marketplace.json` both
      bumped to `0.3.12`. Evidence: file diffs; existing
      `scripts/validate-manifests.mjs` passes.
- [ ] AC-9: `CHANGELOG.md` v0.3.12 entry added, grouped under FEAT-029,
      describing the default flip + opt-out path + release date.
      Evidence: file diff.
- [ ] AC-10: All 8 CI gates green:
      `npm ci` → `validate-manifests` → `validate-skills` →
      `validate-slices` → `npm run lint` (zero warnings) →
      `npm run format:check` → `npm run typecheck` → `node --test` →
      `node ./scripts/e2e-smoke.mjs`. Evidence: green CI run artifact
      or local terminal capture.

## Done When

- all acceptance criteria above are PASS with evidence
- build passes per `.claude/loop.json` `stack.build`
- tests pass per `.claude/loop.json` `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` field
  populated
- Crew `final-synthesis` artifact written
- entry appended to `../backlog/completed-slices.md`
- this slice file moved from `slices/pending/` → `slices/completed/`
- FEAT-029 moves from `docs/backlog/in-progress/` to `docs/backlog/done/`
- v0.3.12 release tag is **not** required at slice close — release
  workflow is user-triggered separately (see `CLAUDE.md` Release
  workflow). Slice closes when the version-bump commit lands on main
  with green CI.

## Reviewer ladder

- Reviewer A: code-bearing review — `hooks.json` diff, version bumps,
  CHANGELOG, opt-out test wiring.
- Reviewer B: evidence review — verify Phase A handoff numbers honestly
  reflect the cost-report diffs, threshold checks are real, no cherry-
  picked sessions.

## Risks

- **Phase A blocked by session-boundedness.** Dogfood requires two
  fresh Claude Code sessions launched by the user; cannot be executed
  inline from a running session. Slice must pause after writing the
  evidence-handoff scaffold and wait for the user to drive the two
  sessions.
- **Aggregate vs per-slice noise (FEAT-034 risk).** Current aggregate
  cost report shows 114 reads but per-slice shows 9. If the 114 figure
  is artifact aggregation noise rather than true regression, the
  ≥50% reread-drop AC may be hard to evidence on a small A/B task.
  Mitigation: AC-2 measures the per-slice delta, not the aggregate;
  if per-slice baseline is already low (~9), the 50% threshold drops
  to a small absolute number and the test still validates the hook
  is doing work.
- **State-file growth runaway.** First long session with the hook on
  could grow the reread-tracker file unboundedly. AC-5 guards size;
  Phase B try/catch wrapping guards crash safety.
- **CI gate drift.** v0.3.11 already passes all 8 gates; flipping a
  default shouldn't change that, but `e2e-smoke` may need updating
  if it asserted the env-var-gated behavior.

## Resolved during slice open (2026-06-02)

- **Env gate location**: `hooks/check-redundant-read.mjs:74` and
  `hooks/record-read-content.mjs:80`, both currently
  `if (process.env.CREW_COST_HYGIENE !== "1") process.exit(0);`.
  Two-file flip. `hooks/hooks.json` does NOT carry the gate — it
  always wires the matchers; the hook scripts themselves decide
  whether to run.
- **State file path**: `.claude/state/cost-hygiene/<session_id>.json`
  with `SESSION_CAP_BYTES = 2 MB` total + per-file `PER_FILE_CAP_BYTES =
  50 KB` content cap + LRU eviction (`scripts/lib/cost-hygiene/state.mjs`).
  `.claude/state/` is already in the machine-local-only gitignore
  list per `CLAUDE.md` → "What is committed vs ignored" — no
  policy change needed.

## Open questions

- Should the v0.3.12 release ship simultaneously with this slice's
  commit, or be batched with FEAT-030/032/033 fixes? Default: ship
  029 standalone so the cost-hygiene fix lands fast for consumer
  installs; subsequent perf wins ride later releases. User decision
  before tagging.
