---
id: FEAT-043
title: "Prompt & doc change test coverage — agent keyword assertions + negative regex tests"
priority: P1
status: done
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md
plan: docs/superpowers/plans/2026-06-05-feat-c-prompt-doc-test-coverage.md
related: [FEAT-044, FEAT-045, FEAT-046]
phase: null
tags: [concern:testing, concern:governance, surface:cli]
pm_customer_impact: 0.70
pm_demand_signal: 0.80
pm_technical_feasibility: 0.95
pm_scope_risk: 0.85
pm_strategic_alignment: 0.85
pm_composite: 0.83
---
# FEAT-043 — Prompt & doc change test coverage

## Why

Agent prompt edits have zero semantic coverage — structural shape tests (line count,
required sections) pass silently when a prompt drops a required gate keyword, names
the wrong skill, or uses a stale flag. classify-scenario over-match was caught by
reviewer this session; root cause was no negative test for compound-word false positives.
The pattern recurs across all verb-matching logic.

## Spec

`docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md` → FEAT-C

## Acceptance criteria

- [ ] AC-1: `tests/agent-prompt-content.test.mjs` exists with ≥5 keyword assertions per agent file (5 agents × 5 keywords = ≥25 tests)
- [ ] AC-2: All new tests pass on current agent files; failure message names missing keyword and file
- [ ] AC-3: `validate-skills.mjs` warns when `last_reviewed` is absent from a skill's frontmatter
- [ ] AC-4: `classify-scenario.mjs` test suite includes ≥2 negative (non-match) cases per verb set (interaction/visibility/navigation/input)
- [ ] AC-5: `node --test` 100% pass; `npm run lint` zero warnings
