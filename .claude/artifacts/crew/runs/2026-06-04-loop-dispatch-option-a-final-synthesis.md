# Final Synthesis — Loop Dispatch Option A

- **Date:** 2026-06-04
- **Owner:** lead (cross-repo)
- **Mode:** single-session (cross-repo edit into `C:\work\mega\loop`)
- **Linked handoff:** `.claude/artifacts/crew/handoffs/2026-06-04-loop-dispatch-gaps-analysis.md`

## What the user asked

Address the dispatch gaps identified in the handoff. User picked Option A:
change loop's autonomous dispatch from `crew:builder` to `crew:lead` so the
real lead workflow runs at slice start.

## What shipped

Single commit in `C:\work\mega\loop`:

- **SHA:** `7b8b90b`
- **Title:** `feat(dispatch): route slice dispatch to crew:lead instead of crew:builder`
- **Files:** 13 (`+25 / -23` lines)

### Source

- `src/scripts/lib/slice-linker/dispatch.mts` (+ compiled `.mjs`):
  `buildDispatchInstruction` now emits `Dispatch crew:lead subagent` and
  embeds a lead-shaped prompt (frame → implement via `crew:builder` →
  review via `crew:reviewer` → validate via `crew:validator` →
  synthesize).
- `src/scripts/lib/slice-linker/start-slice.mts` (+ compiled `.mjs`):
  `computeNextAction` updated for both the approval-gate branch and the
  default dispatch branch.

### Tests

- `tests/slice-start.test.mjs` + `src/tests/slice-start.test.mts`: regex
  assertions updated from `/Dispatch \/crew:build subagent/` to
  `/Dispatch crew:lead subagent/`.
- `tests/slice-linker.test.mjs` + `src/tests/slice-linker.test.mts`:
  backward-compat regex updated.
- Full suite: **640 / 640 pass.**

### Docs

- `.claude/loop/rules.md`: step 4 + dispatch-discipline matrix row.
- `templates/loop-rules.md`: step 4 + dispatch matrix row.
- `templates/claude-md-hard-rules.md`: dispatch discipline summary.
- `commands/slice-start.md`: example `dispatchInstruction` + `nextAction`
  in returns block.
- `CLAUDE.md`: mirror of templates/claude-md-hard-rules summary.

## What was reviewed

Self-review only — single-session edit, no `crew:reviewer` subagent. The
diff is mechanical: replace `/crew:build` → `crew:lead` in dispatch text
and rewrite prompt body to match `crew:lead` agent's contract. Tests
guard the dispatch-text shape.

## What was validated

Loop's full `npm test` (640 tests) and `npm run lint` (no errors; one
pre-existing complexity warning on `complete-slice.mts:306` from FEAT-034
in-progress WIP, untouched by this commit).

## What's still open

Per the prior handoff's recommendation table:

1. **Option D + E** (auto-architect on `autonomous_safe: false` /
   `requires_design: true`) — still pending. Was originally
   recommended as ship-first; user pivoted to Option A. Worth measuring
   Option A's cost delta in next loop iteration before adding D on top.
2. **Option G** (mid-slice escalation badge) — conditional on grade
   data. Defer until Option A's grade signal is in.

## Risks / open questions

- **Cost delta unmeasured.** Lead pass adds opus framing turn before
  builder runs. Historical grade reports show ~$40 / slice on opus
  orchestrator + sonnet builder. Lead pass likely adds $5–10 / slice.
  Validate in next 2–3 grade reports.
- **`crew:lead` agent shape.** Loop's dispatch prompt now relies on
  `crew:lead` being present in the consumer repo. Both `hero-crew`
  (this repo) and `loop` repo ship it via the `crew` plugin
  dependency — confirmed at `agents/lead.md`. No consumer-repo
  breakage expected.
- **Interactive `/crew:build` flow unchanged.** Architect's manual two-
  model split (`commands/architect.md`) still references `/crew:build`
  for the editor phase. That path is human-driven and unaffected by
  this commit.
- **Loop repo WIP untouched.** FEAT-034 marker-drain slice (SLICE-30)
  remains in working tree of `C:\work\mega\loop`. Pre-existing complexity
  warning on `complete-slice.mts:306` belongs to that slice, not this
  commit.

## Next handoff suggestion

Run the loop against any pending FEAT in `C:\work\mega\loop` (e.g.
FEAT-034 once SLICE-30 lands), then read the resulting grade report.
Compare opus-spend vs the 10 prior grade averages snapshot in
`.claude/artifacts/loop/loop-snapshot.md`. If cost stays within 1.2× and
grade composite stays ≥ 0.85, Option A holds. If grade lifts ≥ 0.90,
greenlight Option D + E.
