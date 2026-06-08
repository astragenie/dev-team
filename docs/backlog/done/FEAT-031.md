---
id: FEAT-031
title: Sonnet-default for mechanical slices
priority: P0
status: done
category: performance
target_release: v0.7.0
created: 2026-06-01
updated: 2026-06-02
depends_on: []
slices: [SLICE-15]
derived_from: null
autonomous_safe: false
github_issue: 41
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/41"
---
## Description

Recent cost reports show `claude-opus-4-7` burning $1821 of $2098 USD
(86.7%) across 3 slices, while `claude-sonnet-4-6` covered 5 slices
for $277. Cost-discipline rule #1 from `feedback_cost_discipline.md`
already states: Sonnet by default for mechanical / framed slices,
Opus only for slice-start framing, hard refactor, or ambiguous
architecture. Codify that selection rule into the lead agent prompt
so the loop picks the right model per slice shape instead of
inheriting whatever the session opened with.

## Acceptance hints

- `agents/lead.md` includes a model-selection gate at slice start:
  spec frames design + file paths + test signatures known → recommend
  Sonnet; ambiguous architecture / hard refactor / design choice
  required → recommend Opus.
- Recommendation surfaces in the run-brief artifact so the user can
  override before the slice opens.
- Cost reports continue to track `modelMix` so the
  recommendation effectiveness can be measured slice-over-slice.
- Documentation entry (in `docs/architecture/architecture.md` or a
  routing-table row) describing the rule and its rationale.

## Notes

- `autonomous_safe: false` — lead prompt edit.
- Highest USD lever among the perf candidates; sequence after FEAT-030
  and FEAT-032 so the agent-prompt review work is bundled.
- Source analysis: handoff `20260601T115349Z-...-awaiting-user-choice.md`.
