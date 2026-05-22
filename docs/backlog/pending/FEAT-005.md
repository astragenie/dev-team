---
id: FEAT-005
status: pending
priority: P1
category: skill
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
depends_on: [FEAT-001]
slices: []
derived_from: null
autonomous_safe: false
phase: 2
---

# FEAT-005: First domain skill — dotnet/csharp-conventions

## Description

Author `skills/domain/dotnet/csharp-conventions/SKILL.md`. Distil the
relevant slice of `Astragenie.Standards/docs/csharp/coding-conventions.md`
into a skill the builder loads when touching `*.cs`.

Pattern this skill so future domain skills can copy its shape
(detection-trigger, trigger conditions, action steps, done criteria).

## Acceptance hints

- ≤200 lines.
- Frontmatter declares `tier: domain`, `stack: dotnet`, `triggers: ["*.cs"]`.
- Trigger conditions section gives the lead a clear "when to suggest this".
- Action steps section gives the builder a clear procedure.
- Done criteria section is testable.
- One concrete example.

## Why not autonomous-safe

Skill authorship is creative; needs human review of voice + accuracy.
