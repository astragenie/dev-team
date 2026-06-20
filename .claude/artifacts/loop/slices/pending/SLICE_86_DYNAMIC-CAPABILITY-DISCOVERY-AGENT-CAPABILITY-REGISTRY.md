---
id: SLICE-86
title: "FEAT-160 partial — agent-registry library + crew agent-route CLI (no lead.md edit)"
status: pending
feature: FEAT-160
phase: null
priority: P3
target_release: null
requires_validation: true
risk: low
autonomous_safe: true
developer_type: inline
estimated_complexity: small
created: 2026-06-20
updated: 2026-06-20
depends_on: []
touches_files: [scripts/lib/agent-registry.ts, scripts/crew.ts, tests/agent-registry.test.ts]
touches_files_confidence: declared
file_line_budgets:
  scripts/lib/agent-registry.ts: 200
  scripts/crew.ts: 1050
  tests/agent-registry.test.ts: 250
---
# SLICE-86 — FEAT-160 partial: agent-registry library + `crew agent-route` CLI

Builds the read-only capability registry promised by FEAT-160 (capability metadata discovery) and exposes an ad-hoc routing CLI. **Defers the `agents/lead.md` slim-down to a follow-up `autonomous_safe: false` slice.** All 30 agent files already carry `capabilities:` frontmatter — this slice closes the "registry consumer" gap so the lead's hardcoded routing table can become a thin reference rather than the authoritative source.

## In scope

1. New `scripts/lib/agent-registry.ts`:
   - exports `AgentCapabilities`, `AgentRegistryEntry`, `RouteQuery`, `RouteMatch` types
   - `loadAgentRegistry(repo, agentsSubdir = "agents")` — walks `agents/**/*.md`, parses YAML frontmatter via existing `yaml` dep
   - `routeByTags(registry, query)` — filters by role/surface/stack/concern/lens/scope, returns ranked `RouteMatch[]` (score = `matched_count * 10 + priority`)
   - silently skips files without `capabilities:` frontmatter (descriptive-only agents)
2. Edit `scripts/crew.ts`:
   - add `--role`, `--surface`, `--stack`, `--concern`, `--lens` flags (reuses existing `--scope`)
   - add `agent-route` subcommand: pretty table output + JSON return shape `{ registryCount, matchCount }`
   - add usage entry for `agent-route`
3. New `tests/agent-registry.test.ts` — 7 cases covering parse, skip-no-caps, walk-nested-dirs, single-dim query, multi-dim AND semantics, empty query, ranking math.

## Out of scope (deferred to FEAT-160 SLICE-B — autonomous_safe=FALSE)

- `agents/lead.md` slim-down — replacing the hardcoded routing table with `"see agent-registry"` and keeping top-5 canonical routes inline.
- Hot-path performance optimization — registry walk is ~30 file reads, no caching layer needed today.

## Acceptance criteria

- [ ] AC-1: `bun run typecheck` clean.
- [ ] AC-2: `bun test tests/agent-registry.test.ts` — all 7 cases PASS.
- [ ] AC-3: `node scripts/crew.ts agent-route --role inspector --repo "$PWD"` returns ≥1 match (inspector / qa-expert / performance-engineer all carry `role: [inspector]`). Verified via live invocation.
- [ ] AC-4: `node scripts/crew.ts agent-route --role implementer --stack typescript --repo "$PWD"` returns matches scoring 20+ (2 dimensions * 10). Live invocation.
- [ ] AC-5: file LOC budgets met: agent-registry.ts ≤ 200, agent-registry.test.ts ≤ 250, crew.ts net add ≤ 60 (subcommand handler + flag additions).
- [ ] AC-6: `git diff --stat` shows ONLY the 3 touches_files (the 6 flag additions in scripts/crew.ts are within the existing file edit).

## Done When

- all ACs PASS
- commit pushed
- FEAT-160 stays in in-progress/ — lead.md slim deferred to follow-up
- ceremony artifacts written
