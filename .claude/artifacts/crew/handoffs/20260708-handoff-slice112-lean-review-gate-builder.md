---
kind: handoff
objective: Implement SLICE-112 — lean review gate for /crew:orchestrate-slice (port runner-plugin model)
owner: crew:fullstack-dev
slice: SLICE-112
feature: FEAT-202
phase: build
created_at: 2026-07-08
confidence: high
next_handoff: crew:reviewer (post-builder gate)
---
# Handoff — SLICE-112 builder complete

**Slice:** SLICE-112 — Lean review gate for /crew:orchestrate-slice (port runner-plugin model)
**Feature:** FEAT-202

## Objective

Port runner-plugin's proven lean post-builder gate into dev-team's
`/crew:orchestrate-slice` path: LOW/MEDIUM-risk slices dispatch exactly one
`crew:reviewer` and no dedicated `crew:verifier`, with validation delegated
to the evidenced reviewer approval + `loop.validation.satisfiedByReview:
true` (already honored by runner-plugin's `deriveValidationGate`) plus the
pre-push hook / CI full-suite gate. The heavy path (2nd reviewer /
`crew:verifier`) stays available but is now risk-gated (`RISK_GATE`) instead
of the always-on default.

## Allowed scope

`.claude/loop.json`, `commands/orchestrate-slice.md`,
`skills/workflow/validator-gate/SKILL.md`,
`skills/workflow/fan-out-review/SKILL.md`,
`tests/validation-gate-delegation.test.ts` — exactly the 5 files declared in
the slice frontmatter `touches_files`.

## Forbidden scope (respected)

- No edit to runner-plugin (source pattern, already lean — `deriveValidationGate`
  needed no change).
- No removal of the full test suite anywhere — pre-push hook
  (`hooks/pre-push-verifier.ts`) and CI (`.github/workflows/test.yml`) are
  unchanged and still own the whole-repo full gate.
- No change to `loop.modelRouting` (verified unchanged by
  `tests/validation-gate-delegation.test.ts`).

## Deliverable / what changed

1. **`.claude/loop.json`** — `reviewers.ladder` `["A","B"]` → `["A"]`; added
   `loop.validation.satisfiedByReview: true` nested under the existing
   `loop` object (alongside `cost` and `modelRouting`, which are untouched).
2. **`commands/orchestrate-slice.md`**:
   - Step 4.5 now computes `RISK_GATE` (true when slice frontmatter
     `risk: high`, OR FEAT tags `concern:security`/`concern:performance`, OR
     `SPLIT_BUILD = true`) alongside the existing `SHORT_SLICE`/`TIER`
     telemetry classification (tier no longer drives gate composition).
   - Step 4 & 5 "Dispatch selection" rewritten: `RISK_GATE=false` → exactly
     one `crew:reviewer`, no `crew:verifier`. `RISK_GATE=true` → heavy path
     (2nd reviewer per `fan-out-review` and/or dedicated `crew:verifier`),
     explicit override condition documented inline.
   - Step 4 / Step 5 prompt bodies updated to reflect the conditional
     verifier and the reviewer-as-evidenced-artifact framing.
   - Conflict rule (`needs_fix` invalidates validation) updated: only marks
     `VALIDATION_PATH` stale when one was actually produced (`RISK_GATE=true`);
     re-dispatch re-selects the same `RISK_GATE`-derived gate composition.
3. **`skills/workflow/validator-gate/SKILL.md`** — rewritten: removed the
   "always dispatch, no skip" absolute; documents the `satisfiedByReview`
   delegation as the LOW/MEDIUM default and the risk-gated exception
   (mirrors the same three signals as the command). 39 lines (cap 200).
4. **`skills/workflow/fan-out-review/SKILL.md`** — added an explicit
   "single-reviewer is the default" statement pointing at `RISK_GATE=false`;
   existing 2–4 reviewer fan-out language kept for the `RISK_GATE=true` case.
   36 lines (cap 200).
5. **`tests/validation-gate-delegation.test.ts`** (new, 10 tests, all
   passing) — asserts the `.claude/loop.json` config shape (`ladder: ["A"]`,
   `satisfiedByReview: true`, `modelRouting` unchanged) and the prose
   contract in both touched SKILL/command files (delegation language present,
   risk-gate signals present, old absolute removed, full-suite ownership by
   CI/pre-push documented).

**Cross-plugin note (surfaced per dispatch instructions, not fabricated):**
`deriveValidationGate` (the actual gate resolver honoring `satisfiedByReview`
+ the `!unproven` guard) lives in runner-plugin
(`src/scripts/lib/validation-gate.mts`), not in this repo. `grep -rn
"deriveValidationGate|satisfiedByReview|review-badge" tests/ scripts/` inside
dev-team returned zero hits pre-slice — there is no dev-team import surface
for that function. Per the dispatch note, I did not fabricate a cross-plugin
import; the test suite instead asserts at the level dev-team owns (config
shape + prose contract). If runner-plugin ever exposes a
dev-team-consumable export, extend this suite to exercise the `satisfied:
true` (evidenced review-badge) and `unproven` (does-not-satisfy) cases
directly.

## Self-verify gates run (evidence)

```
$ node -e "JSON.parse(require('fs').readFileSync('.claude/loop.json','utf8')); console.log('valid')"
valid

$ bun install
330 packages installed [23.48s]   # worktree had no node_modules; installed to unblock dependent test files

$ bun test tests/validation-gate-delegation.test.ts
10 pass / 0 fail

$ bun test tests/validation-gate-delegation.test.ts tests/orchestrate-slice.test.ts tests/tier-classification.test.ts
50 pass / 0 fail

$ bun test tests/orchestrate-slice.test.ts tests/tier-classification.test.ts tests/architect-feature.test.ts \
    tests/cli-recall-block.test.ts tests/memory-recall-injection-completeness.test.ts tests/validate-agent-refs.test.ts \
    tests/validation-gate-delegation.test.ts
72 pass / 0 fail

$ node --experimental-strip-types scripts/validate-skills.ts
Skills OK: 72 skill(s) checked. (only pre-existing unrelated warnings on other files)

$ node --experimental-strip-types scripts/validate-manifests.ts
Manifests OK

$ bunx biome check --files-ignore-unknown=true tests/validation-gate-delegation.test.ts
Checked 1 file in 7ms. No fixes applied.  (one quote-style fix applied before this clean run)
```

## Changed files

- `.claude/loop.json`
- `commands/orchestrate-slice.md`
- `skills/workflow/validator-gate/SKILL.md`
- `skills/workflow/fan-out-review/SKILL.md`
- `tests/validation-gate-delegation.test.ts` (new)

## Confidence

High — all 5 ACs have direct evidence (config diff, prose diff, passing
scoped tests, unmodified CI/pre-push full-suite ownership confirmed by
inspection).

## Risks / open questions

- AC-4's core mechanism (`deriveValidationGate` resolving `satisfied: true`
  with `review-badge:` reason) is asserted only at the config/prose level in
  this repo — the resolver itself lives in runner-plugin and was out of
  scope to edit or import (see cross-plugin note above). Reviewer should
  confirm this is an acceptable evidence boundary for AC-4, or flag if a
  stronger cross-repo assertion is required before close.
- `RISK_GATE`'s `risk: high` frontmatter signal depends on slice authors
  continuing to set `risk:` in frontmatter (already an established
  convention — 8/8 sampled completed slices set it). No enforcement added
  in this slice if a slice omits `risk:` entirely; `RISK_GATE` would then
  rely solely on the tag/`SPLIT_BUILD` signals.

## Suggested next handoff

`crew:reviewer` — single-reviewer gate per the new `RISK_GATE=false` default
this slice itself falls under (risk: medium, no `concern:security`/
`concern:performance` tags, not `SPLIT_BUILD`).
