---
id: SLICE-87
title: "FEAT-142 SLICE-A — Adversarial design lenses (architect + architect-reviewer)"
status: pending
feature: FEAT-142
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
autonomous_safe: false
developer_type: inline
estimated_complexity: small
created: 2026-06-20
updated: 2026-06-20
depends_on: []
touches_files: [agents/architect.md, agents/3rdparty/architect-reviewer.md, scripts/validate-adr-template.ts, tests/validate-adr-template.test.ts]
touches_files_confidence: declared
file_line_budgets:
  agents/architect.md: 350
  agents/3rdparty/architect-reviewer.md: 130
  scripts/validate-adr-template.ts: 175  # bumped from 150 — validator logic + multi-mode arg parsing needs the room; not worth obfuscating
  tests/validate-adr-template.test.ts: 180
---
# SLICE-87 — FEAT-142: adversarial design lenses for architect + architect-reviewer

Targets architecture_quality grade dimension. Architect produces one design; architect-reviewer evaluates that single proposal. Neither is forced to generate or attack alternatives, so plausible-but-weak designs survive review. This slice adds:

1. **Architect**: ADR template now REQUIRES `## Options Considered` section with ≥3 meaningfully different options + per-option `Why rejected:` reasoning for non-chosen options. Template section in `agents/architect.md` body.
2. **Architect-reviewer**: new `## Adversarial review` section — refute each leading option (inversion: "how does this fail?"), assess second-order effects at 6-month + 2-year horizons, state confidence per major claim + what evidence would change it. Reviewer MUST reject ADRs with <3 options OR single-line "rejected" reasoning per option.
3. **PM pre-mortem mitigations**:
   - sample-quality lint: `scripts/validate-adr-template.ts` walks `docs/architecture/decisions/ADR-*.md`, asserts each has `## Options Considered` with ≥3 H3 (`### Option N:`) headings + each non-chosen option has a `Why rejected:` line. Runs in CI as advisory at first (don't break existing ADRs).
   - tests for the validator.

## In scope

1. Edit `agents/architect.md` (cap 350) — append ADR template requirements + reference the new validator. Net add ≤30 LOC.
2. Edit `agents/3rdparty/architect-reviewer.md` (130 LOC cap, currently 57) — add `## Adversarial review` section + reject-criteria. Net add ~50 LOC.
3. New `scripts/validate-adr-template.ts` — Markdown scanner. Walks `docs/architecture/decisions/ADR-*.md`. For each: extract `## Options Considered`, count `### Option N:` H3s, check each non-chosen option has `Why rejected:` line. Returns exit code 2 if any ADR fails (CI gate).
4. New `tests/validate-adr-template.test.ts` — fixture ADRs (well-formed, single-option, options-without-rationale) + assertions.

## Out of scope

- Pushing specifics into new `skills/domain/architecture-advisory/` — defer until cap squeeze. Current architect.md has headroom.
- Wiring the validator into `.github/workflows/test.yml` — separate micro-PR after validator stabilizes on real ADRs.
- Migrating existing ADRs to the new template — validator runs advisory at first.
- Eval fixtures asserting architect actually produces ≥3 options (would need FEAT-162 eval substrate; defer).

## Acceptance criteria

- [ ] AC-1: `bun run typecheck` clean.
- [ ] AC-2: `bun test tests/validate-adr-template.test.ts` — all cases PASS (well-formed ADR passes, single-option fails, options-without-rationale fails).
- [ ] AC-3: `node scripts/validate-adr-template.ts --advisory --repo "$PWD"` runs against current `docs/architecture/decisions/` without crashing (advisory mode: log warnings, exit 0).
- [ ] AC-4: `node scripts/validate-adr-template.ts --strict --repo "$PWD"` exits non-zero IF any current ADR fails. Capture which ADRs need migration.
- [ ] AC-5: file LOC budgets met.
- [ ] AC-6: `git diff --stat` shows ONLY the 4 touches_files.
- [ ] AC-7: `bun run validate:agents` still PASS — `agents/architect.md` stays ≤ 350 LOC after edit.

## Done When

- all ACs PASS
- commit pushed
- FEAT-142 moved to done/

## Reviewer ladder

- Reviewer A: `crew:inspector` — correctness + cap-compliance + scope (no edits outside touches_files).
- Reviewer B: `crew:3rdparty:architect-reviewer` — meta-review: does the new adversarial checklist itself meet the bar it sets? (recursive eat-your-own-dog-food check)
- Validator: implicit via AC-3/AC-4 manual smoke + AC-2 unit tests.
