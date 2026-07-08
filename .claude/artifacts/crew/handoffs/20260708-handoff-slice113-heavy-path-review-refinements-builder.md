---
kind: handoff
objective: Implement SLICE-113 — heavy-path review refinements (stack-lens 2nd reviewer + parallel-dispatch telemetry)
owner: crew:fullstack-dev
slice: SLICE-113
feature: FEAT-203
phase: build
created_at: 2026-07-08
confidence: high
next_handoff: crew:reviewer (post-builder gate)
---
# Handoff — SLICE-113 builder complete

**Slice:** SLICE-113 — Heavy-path review refinements (stack-lens pick + parallel-dispatch telemetry)
**Feature:** FEAT-203

## Objective

FEAT-202 / SLICE-112 already made the LOW/MEDIUM default a single reviewer
via `RISK_GATE`. This slice refines only the remaining risk-gated **heavy
path** (`RISK_GATE=true`): (1) pick the 2nd reviewer by diff-extension
dominance instead of a generic second `crew:reviewer`, and (2) activate the
loop's already-built reviewer-timing telemetry + document the single-message
parallel-dispatch contract so silent serialization is flagged.

## Allowed scope (respected)

`skills/workflow/fan-out-review/SKILL.md`, `.claude/loop.json`,
`commands/orchestrate-slice.md`, `tests/heavy-path-review-refinements.test.ts`
— exactly the 4 files declared in the slice frontmatter `touches_files`. No
runner-plugin edit. No change to the LOW/MEDIUM default path (FEAT-202's
territory, untouched).

## Deliverable / what changed

1. **`skills/workflow/fan-out-review/SKILL.md`** — added a "Stack-lens
   2nd-reviewer pick (FEAT-203 / SLICE-113)" subsection: when `RISK_GATE =
   true` and exactly one additional reviewer is picked, choose by diff
   dominance — `.cs` ≥60% of changed files → `crew:csharp-reviewer`;
   `.ts`/`.tsx` ≥60% → `crew:typescript-reviewer`; otherwise generic
   `crew:reviewer` 2nd lens. Documented that only the 2nd lens's identity
   changes (1st reviewer stays `crew:reviewer`) and the rule doesn't affect
   the 4-reviewer security+performance scale-up. Added a matching bullet to
   the "Done" checklist. File is 54 lines (cap 200).
2. **`.claude/loop.json`** — `reviewers` block gained `strictParallel: true`
   and `serialTimingThresholdMs: 90000` (aligns runner-plugin's default),
   alongside the existing `ladder: ["A"]` (untouched).
3. **`commands/orchestrate-slice.md`** — Step 4 & 5 "Dispatch selection":
   - Added a "Single-message contract (FEAT-203 / SLICE-113)" sentence to
     the `RISK_GATE = true` bullet: every dispatched reviewer (1st + 2nd, or
     up to 4 on the security+performance scale-up) AND the dedicated
     `crew:verifier` MUST be emitted in that one parallel Agent-tool
     message — no message between dispatches, no wait-for-one-before-
     dispatching-the-next. Kept the pre-existing "dispatch the heavy path in
     one parallel message... AND/OR a dedicated `crew:verifier`" phrasing
     intact (SLICE-112's `tests/validation-gate-delegation.test.ts` asserts
     it via regex — verified no regression, see evidence below).
   - Added a "Stack-lens 2nd reviewer (FEAT-203 / SLICE-113)" paragraph
     restating the fan-out-review rule inline at the dispatch-selection
     decision point.
   - Added a "Parallel-dispatch telemetry (FEAT-203 / SLICE-113)" paragraph
     documenting the real runtime consumer (see boundary note below) and the
     honest `strictParallel` no-op-today caveat.
4. **`tests/heavy-path-review-refinements.test.ts`** (new, 9 tests, all
   passing) — asserts the `.claude/loop.json` config shape (`strictParallel:
   true`, `serialTimingThresholdMs: 90000`, `ladder` untouched) and the prose
   contract in both touched files (stack-lens rule + threshold, single-
   message contract, telemetry documentation, honest boundary statement).

## AC-2 runtime-consumer investigation (done before writing, not assumed)

Per the dispatch instruction, I inspected the installed runner-plugin cache
(`~/.claude/plugins/cache/astra/runner/0.65.0/src/scripts/lib/`) instead of
assuming:

- **`serialTimingThresholdMs` is a LIVE config knob.**
  `grade-telemetry.mts::computeReviewerSpan` reads
  `config?.reviewers?.serialTimingThresholdMs ?? 90000` and calls
  `detectSerialReviewer` (in `reviewer-timing.mts`, which diffs the
  earliest/latest timestamp among `.claude/artifacts/crew/reviews/` files
  matching the slice id). `slice-linker/complete-slice.mts` calls
  `recordSerialReviewerWarning` **unconditionally** (line 685, inside the
  slice-close ceremony) which reads the same config key (line 802), and when
  the span exceeds the threshold, stamps a `serial-reviewer-warning` badge on
  the slice + appends a grade observation note (`recordSerialReviewerWarning`,
  `appendSliceBadge`, `appendGradeObservation`). This ceremony IS the one
  dev-team's `/runner:close` runs via the installed loop plugin, so setting
  `serialTimingThresholdMs: 90000` in `.claude/loop.json` genuinely activates
  serial-dispatch detection on this repo's next slice close — not just
  documentation.
- **`strictParallel` is declared but NOT consumed anywhere yet.** It exists
  only as an optional field in `preset-schema.mts`'s `PresetV1["reviewers"]`
  type (schema/forward-compat declaration). `grep -rn "\.strictParallel"
  src/scripts` across the entire 0.65.0 cache returns zero hits — no runtime
  code branches on it. I did NOT fabricate a claim that it gates anything
  today; both `commands/orchestrate-slice.md` and the test suite state this
  boundary explicitly ("no runtime consumer branching on it yet").

This is a partial-yes, not the binary yes/no the AC anticipated: one field
(`serialTimingThresholdMs`) is live, the other (`strictParallel`) is
config-shape-only. I kept both in the config (harmless, forward-compat per
the AC's own fallback instruction) and documented the split honestly rather
than rounding either way.

## Self-verify gates run (evidence)

```
$ bun install
330 packages installed [22.53s]   # worktree had no node_modules; installed to unblock deps/typecheck

$ bun test tests/heavy-path-review-refinements.test.ts
9 pass / 0 fail

$ bun test tests/heavy-path-review-refinements.test.ts tests/validation-gate-delegation.test.ts \
    tests/orchestrate-slice.test.ts tests/tier-classification.test.ts tests/validate-agent-refs.test.ts
67 pass / 0 fail   # confirms no regression to SLICE-112's suite from the orchestrate-slice.md edit

$ node -e "JSON.parse(require('fs').readFileSync('.claude/loop.json','utf8')); console.log('valid')"
valid

$ node ./scripts/validate-skills.ts
Skills OK: 72 skill(s) checked. (10 pre-existing warnings, none new / none on touched files)

$ bun ./scripts/validate-configs.ts
validate-configs: OK (93 routing rows, 1 model profile(s), schema valid, no drift, all crew: tokens resolve)

$ bun ./scripts/validate-agent-refs.ts
Agent-ref validation OK: no phantom crew: dispatch references found.

$ bunx biome format tests/heavy-path-review-refinements.test.ts
Checked 1 file in 24ms. No fixes applied.

$ bunx tsc --noEmit
(no errors reported for the new/changed files)
```

### Correction made mid-slice

My first draft of the `RISK_GATE = true` sentence in
`commands/orchestrate-slice.md` replaced the exact phrase
`AND/OR a dedicated \`crew:verifier\`` that
`tests/validation-gate-delegation.test.ts` (SLICE-112) regex-matches. The
combined test run caught the regression immediately; I restored that
original phrasing and appended the new single-message-contract sentence
instead of rewriting the paragraph, then re-ran the combined suite to
confirm 67/67 pass. Evidence above reflects the corrected state.

## Changed files

- `.claude/loop.json`
- `commands/orchestrate-slice.md`
- `skills/workflow/fan-out-review/SKILL.md`
- `tests/heavy-path-review-refinements.test.ts` (new)

## Confidence

High — all 3 ACs have direct evidence (config diff, prose diff, passing
scoped + neighboring-suite tests, cross-plugin runtime-consumer boundary
verified by reading the installed runner-plugin source rather than assumed).

## Risks / open questions

- `strictParallel` currently has no runtime consumer in the installed
  runner-plugin (0.65.0). It is forward-compat only — if a future
  runner-plugin release wires it to something stricter (e.g. hard-fail
  instead of warn-badge on serial dispatch), no dev-team change is needed to
  benefit, but reviewers should not read its presence in `.claude/loop.json`
  as proof of active enforcement today.
- The stack-lens 2nd-reviewer rule is documented (SKILL + command prose) but
  not mechanically enforced — `/crew:orchestrate-slice` is prompt-driven, so
  correct application depends on the orchestrating agent reading and
  following the rule at dispatch time, same as the rest of the classify/
  dispatch logic in this command file. No CLI classifier was added in this
  slice (out of scope per "Building a new telemetry engine" exclusion).

## Suggested next handoff

`crew:reviewer` — this slice is `risk: low` (frontmatter) with no
`concern:security`/`concern:performance` tags and not `SPLIT_BUILD`, so it
falls under its own SLICE-112 `RISK_GATE=false` default: single reviewer,
no dedicated verifier.
