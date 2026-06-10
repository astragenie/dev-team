---
id: FEAT-024
title: "Loop-side enforcement — AC linter, slice template test AC, ladder + marathon gates"
priority: P1
status: done
closed: 2026-06-05
closed_note: "All 4 work items shipped in loop 0.7.6 (ac-linter.mjs, start-slice AC gate, test-adequacy-gate.mjs, slice template AC). Marketplace.json already at 0.7.7."
category: quality-gate
target_release: loop-0.3.6
autonomous_safe: false
cross_repo: hero-crew-autonomous-loop
parent_spec: null
related: [FEAT-023]
hero_crew_companion: validate-slices.mjs (6840023) scans pending/ for AC placeholders — hero-crew-side done
phase: 2
github_issue: 28
github_milestone: 2
github_url: "https://github.com/sergeymilashico/hero-crew/issues/28"
created: 2026-06-10
depends_on: []
slices: []
---
# FEAT-024 — Loop-side enforcement (cross-repo coordination)

## Why

FEAT-023 closes the hero-crew (review CLI + reviewer agent) half of the customer's 4-driver report. The other half lives in the companion `hero-crew-autonomous-loop` plugin:

- `loop:slice-from-feature` / `loop:slice-start` do not reject slice files whose Acceptance Criteria section contains literal `AC-N: ...` or empty `[ ]` placeholders. Customer's SLICE-92 shipped with un-filled placeholders.
- `loop:slice-review-ladder` does not require populated Test Adequacy on Reviewer A / Reviewer B reports before assembling a "pass" verdict.
- Marathon-mode auto-close does not inspect the review-result artifact's Test Adequacy field before advancing to the next slice. Customer's run auto-closed 9 slices in ~8 min on "build + review passed" alone.

## Work items (in `hero-crew-autonomous-loop` repo)

- AC placeholder linter at slice-start. Regex: lines matching `^- \[ \] AC-\d+:\s*\.{2,}\s*$` (literal three-dot placeholder). Skill aborts with a clear error listing the offending lines.
- Slice template test AC. Mirror hero-crew's `SLICE_TEMPLATE.md` test-coverage AC-N bullet so new repos onboarded by `loop:install` inherit the same default.
- `loop:slice-review-ladder` test-adequacy gate. Skill refuses to assemble "pass" verdict if either Reviewer artifact has empty `Test Adequacy` and no `Test Adequacy Skip Reason`. Reviewer prompts also require populating the field.
- Marathon-mode quality gate. Marathon-close logic reads each completed slice's `review-result` artifact; refuses to mark complete + refuses to advance if `Test Adequacy` is empty for an approved code-bearing review. First miss flips marathon to single-step + surfaces blocker through `brief-me`.

## Hero-crew responsibility

- File this ticket here so the dependency is tracked in `brief-me`.
- After loop release that delivers these items: bump `plugins[name=loop].version` in `.claude-plugin/marketplace.json`.

## Acceptance criteria

- [ ] AC-1: loop repo cuts a release containing all four work items above.
- [ ] AC-2: marketplace.json bumped to that loop version in this repo.
- [ ] AC-3: smoke-test in a throwaway repo confirms placeholder-AC slice files refuse to open.
- [ ] AC-4: smoke-test confirms marathon auto-close fails when a slice has empty Test Adequacy.
