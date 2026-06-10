---
id: FEAT-040
title: "/crew:orchestrate-slice — tag-driven specialist ladder command"
priority: P2
status: done
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: null
related: [FEAT-038, FEAT-039]
phase: null
tags: ["stack:llm", "surface:cli", "concern:governance"]
github_issue: 56
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/56"
created: 2026-06-10
depends_on: []
slices: []
---
# FEAT-040 — /crew:orchestrate-slice: tag-driven specialist ladder command

## Why

The crew workflow dispatches specialists manually today — lead reads a slice, decides which
agents to run, and assembles prompts by hand. For PM-triaged slices with `tags:` frontmatter,
this decision is mechanical: `surface:api` → architect first; `surface:ui` → uxdesigner;
`BEHAVIOR_CHANGED` → validator; `surface:docs` → copywriter. A command that encodes this
ladder removes the manual assembly cost and makes the specialist sequence visible and
reproducible in the main thread.

## Approach

A new `commands/orchestrate-slice.md` command with an 8-step dispatch ladder:

- **Step 0** — Read and classify slice by tags + AC text → derive `NEEDS_CONTRACT`,
  `NEEDS_UX`, `BEHAVIOR_CHANGED`, `RELEASE_CONTENT`, `DOCS_NEEDED` flags
- **Step 1** — `crew:architect` (contract artifact) — skip when `NEEDS_CONTRACT = false`
- **Step 2** — `crew:uxdesigner` (UX spec) — skip when `NEEDS_UX = false`
- **Step 3** — `crew:builder` (implementation, reads contract + UX spec)
- **Step 4** — `crew:reviewer` (contract conformance section required when contract exists)
- **Step 5** — `crew:validator` — skip when `BEHAVIOR_CHANGED = false`
- **Step 6** — `crew:copywriter` — skip when `RELEASE_CONTENT = false`
- **Step 7** — `loop:document-writer` (or copywriter fallback) — skip when `DOCS_NEEDED = false`
- **Step 8** — `write-final-synthesis`

Companion change: `agents/architect.md` gains a `## Contract artifact schema` section
(immutable-first-write rule, four required sections: TypeScript Interfaces / API Contracts /
Event Schemas / Data Contracts, path convention `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`).

Full spec already drafted — see reverted commit `f6a3d83` in hero-crew git history.

## Acceptance criteria

- [ ] AC-1: `commands/orchestrate-slice.md` exists with Step 0–8 ladder and classification logic
- [ ] AC-2: Step 0 classification prints one-line summary before any dispatch
- [ ] AC-3: `needs_contract: true/false` and `needs_ux: true/false` frontmatter overrides take precedence over tag heuristics
- [ ] AC-4: `skip:` array in slice frontmatter force-skips named specialists
- [ ] AC-5: Step 4 reviewer prompt requires `Contract Conformance: PASS/FAIL` section when contract artifact exists
- [ ] AC-6: Step 4 surfaces review-result path and halts with `/crew:fix` instruction on `needs_fix`
- [ ] AC-7: `agents/architect.md` has `## Contract artifact schema` with immutable-first-write rule and four required sections
- [ ] AC-8: Contract artifact path convention is `designs/<FEAT-ID>-contracts.md` under `.claude/artifacts/crew/`
- [ ] AC-9: Tests cover file shape and required headers (≥7 structural tests)
- [ ] AC-10: `node ./scripts/validate-agents.mjs` passes (architect.md ≤300 lines)
- [ ] AC-11: `npm run lint && npm run format:check` clean

## Notes

- Full implementation already exists in `f6a3d83` — was reverted from FEAT-038/039 run due to
  scope drift (no dedicated review pass). Builder can restore from that commit as starting point.
- `autonomous_safe: false` — new command + agent prompt edit require human review.
