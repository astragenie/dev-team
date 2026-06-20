---
id: SLICE-83
title: Plugin-cache install smoke for hook entries
status: completed
feature: FEAT-168
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
created: 2026-06-20
updated: 2026-06-20
completed_at: 2026-06-20
---
# SLICE-83: Plugin-cache install smoke for hook entries

Implements FEAT-168. See [feature file](../../../backlog/in-progress/FEAT-168.md) for product context.

## Objective

`v0.37.1` shipped with a top-level `import { trace, SpanKind } from "@opentelemetry/api"` in `scripts/lib/telemetry/otel-bridge.ts`, statically reachable from all three `hooks/otel-*.ts` entries. Plugin installs land at `~/.claude/plugins/cache/astra/crew/<version>/` with the repo's `package.json` but no `node_modules` (the plugin loader does not run `npm install`). Bun resolved the top-level import, hit ENOENT, and wrote one stderr line per hook fire — every tool call. Hooks still exited 0 via `main().catch`, so the gate was non-blocking but loud.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: All tests pass (npm test) and linter is clean (npm run lint)
- [ ] AC-2: <replace with a concrete, testable acceptance criterion>

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-168 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
