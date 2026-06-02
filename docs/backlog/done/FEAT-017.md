---
id: FEAT-017
status: done
priority: P2
category: workflow
target_release: v0.3.1
created: 2026-05-23
updated: 2026-05-23
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 17
github_milestone: 1
---
# FEAT-017: wire plugin-dev:plugin-validator + skill-reviewer into reviewer phase

## Description

The `plugin-dev` plugin (already installed at session level) ships two
skills directly useful for **this** repo's review phase:

- `plugin-dev:plugin-validator` — manifest + structure sanity check.
- `plugin-dev:skill-reviewer` — triggering-effectiveness + best-practice
  review for new / modified skills.

Today the reviewer agent has no formal routing into these. Reviewers
who don't know they exist fall back to ad-hoc grep, which misses the
quality signal these skills are designed to surface.

This FEAT adds explicit reviewer-phase routing so any review that
touches `plugins/`, `skills/`, `commands/`, `agents/`, `hooks/`, or
`*.mcp.json` automatically considers running these skills before the
final review verdict.

## Scope

In scope:

- Add 2 rows to `docs/routing-table.md`:
  - "Plugin-shape change touched (manifest, hooks, commands)" →
    reviewer invokes `plugin-dev:plugin-validator`.
  - "Skill change touched (`skills/**/SKILL.md`)" → reviewer invokes
    `plugin-dev:skill-reviewer` *and* runs
    `node ./scripts/validate-skills.mjs`.
- Update `agents/reviewer.md` prompt with a "Reviewer skill checklist"
  section that cites the routing-table rows.
- Add a one-line callout in `CLAUDE.md` under "CI gates" or "Plugin
  shape" so the connection is discoverable from repo memory.
- Update `docs/architecture/architecture.md` skill-tier section to
  mention reviewer-phase skills as a real, used pattern.

Out of scope:

- Forking or rewriting the upstream `plugin-dev` skills. Consume as-is.
- Wiring `plugin-validator` into CI (already covered by local
  `scripts/validate-manifests.mjs`; the skill is for richer narrative
  feedback during review, not a hard gate).
- Adding agent-development / hook-development to builder routing — that
  is a separate FEAT if it earns its keep.

## Acceptance hints

- `docs/routing-table.md` shows both new rows; mtime is fresh so
  `brief-me` stops flagging staleness.
- `agents/reviewer.md` references the two skills by exact name.
- A reviewer subagent dispatched against a recent plugin-shape diff
  surfaces output from `plugin-dev:plugin-validator` and includes its
  findings in `write-review-result`.
- A reviewer subagent dispatched against a skills/** diff surfaces
  output from `plugin-dev:skill-reviewer` and links its findings into
  the review artifact.
- No lint, format, typecheck, or test regressions
  (`npm run lint && npm test`).

## Risks / open questions

- `plugin-dev` skills are upstream; their interface (skill IDs,
  triggering descriptions) could change. Pin the documented name in
  routing-table and `agents/reviewer.md`; if upstream renames, treat as
  a doc-only fix.
- Reviewer may over-invoke the skills on diffs that don't actually need
  them. Mitigation: routing-table rows are specific to path patterns,
  not generic.
