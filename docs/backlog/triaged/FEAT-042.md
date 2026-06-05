---
id: FEAT-042
title: "/crew:architect-feature — feature-level researcher+architect pipeline"
priority: P1
status: triaged
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-architect-feature-design.md
related: [FEAT-040]
phase: null
tags: [stack:llm, surface:cli, concern:governance]
pm_customer_impact: 0.85
pm_demand_signal: 0.80
pm_technical_feasibility: 0.90
pm_scope_risk: 0.75
pm_strategic_alignment: 0.90
pm_composite: 0.84
---
# FEAT-042 — /crew:architect-feature

## Why

`orchestrate-slice` dispatches architect per-slice, building contracts incrementally.
For features with multiple slices, builder and uxdesigner on slice 1 start without
any contracts — they invent shapes that later slices must then conform to. A
feature-level architecture pass (researcher → architect) before slice 1 produces
a contracts artifact and infers surface/stack/concern tags, written back to the FEAT
frontmatter so the loop plugin propagates them to every slice.

## Spec

`docs/superpowers/specs/2026-06-05-architect-feature-design.md`

## Acceptance criteria

- [ ] AC-1: `commands/architect-feature.md` exists with two-phase researcher+architect pipeline
- [ ] AC-2: Phase 1 researcher prompt includes FEAT file, linked spec, and existing slice files
- [ ] AC-3: Phase 2 architect produces `## Inferred Tags` YAML section in contracts artifact
- [ ] AC-4: Tag write-back is additive — never removes existing FEAT tags
- [ ] AC-5: `--auto-start` finds first pending slice, runs `loop.mjs slice start`, then `orchestrate-slice`
- [ ] AC-6: `--auto-start` exits cleanly with message when no pending slice found
- [ ] AC-7: Re-run is safe — contracts artifact extended, tags merged
- [ ] AC-8: All error conditions produce documented output and correct exit behavior
