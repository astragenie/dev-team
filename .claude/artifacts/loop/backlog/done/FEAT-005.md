---
id: FEAT-005
status: done
closed_at: 2026-06-20
closed_via: audit-supersede
closure_note: "Audit 2026-06-20: tag-based routing on tags=[surface:ui|api|schema|docs, stack:*] in commands/orchestrate-slice.md (lines 38-44, 185) supersedes the originally-proposed single surface: frontmatter field. Loop emits the tag taxonomy (10+ done FEATs use it). Dispatched agents are crew:frontend-dev / crew:backend-dev / crew:fullstack-dev (current naming) rather than the originally-proposed crew:builder-fe / crew:builder-be (those files do not exist). The 63->0 generic-builder problem cited in the FEAT body is structurally addressed by the SPLIT_BUILD path. No further work needed."
priority: P2
category: routing
target_release: null
created: 2026-06-07
updated: 2026-06-20
depends_on: []
slices: []
derived_from: null
upstream_request: "https://github.com/sergeymilashico/loop/blob/main/docs/upstream-requests/2026-06-07-hero-crew-orchestrate-slice-surface-stack-routing.md"
pm_customer_impact: 0.65
pm_effort_estimate: 0.40
pm_strategic_alignment: 0.70
pm_technical_risk: 0.30
pm_dependency_depth: 0.20
autonomous_safe: false
composite_score: 0.675
plan: .claude/artifacts/loop/slice-specs/FEAT-005-slice-spec.md
triage_notes: "via=pm retriage 2026-06-10 | Concrete demand: loop activity report shows 63 generic builder runs vs 1 builder-fe stub vs 0 builder-be (FEAT body). Spec drafted (slice-specs/FEAT-005-slice-spec.md) lowers delivery risk; classifySlice pattern already in repo. autonomous_safe=false: edits commands/orchestrate-slice.md body — command authorship per backlog discipline (CLAUDE.md). Risk band 0.3: well-understood pattern, 1 script function + 1 command doc + tests; rollback = git revert one PR. Cost analog: SLICE-65 prompt+script $3.22/15.4min — effort 0.4 consistent. No weak grade dim hit (security 0.79 weak but unrelated)."
---
# FEAT-005: /crew:orchestrate-slice routes builder variant from FEAT `surface` + `stack` frontmatter

`crew:builder-fe` and `crew:builder-be` specialist agents already ship in crew but `/crew:orchestrate-slice` has no routing table that picks between them and the generic `crew:builder`. Every slice falls through to the generic builder regardless of FEAT classification.

Observed 2026-06-07 in the loop repo (57-agent activity window):

| Role | Total runs |
|---|---|
| `crew:builder` | 63 |
| `crew:builder-fe` | 1 (stub — 0 turns) |
| `crew:builder-be` | 0 |

Loop's `/loop:backlog-enrich` already writes routing fields into FEAT frontmatter (loop commit `4b7d030` on `main` 2026-06-07):

```yaml
---
id: FEAT-NNN
status: triaged
tags: [api-change, infra]
needs_contract: true
needs_ux: false
surface: backend         # frontend | backend | mixed | none
stack: [typescript, node]
---
```

Scope: extend `/crew:orchestrate-slice` (or its underlying dispatcher) to read SLICE / FEAT frontmatter and pick the builder variant:

| `surface` value | Dispatch |
|---|---|
| `frontend` | `crew:builder-fe` |
| `backend` | `crew:builder-be` |
| `mixed` | `crew:builder` (generic) |
| `none` | `crew:builder` (docs / config only) |
| absent / unparseable | `crew:builder` (backwards-compat) |

`stack` is informational for now — feeds the toolchain prompt the chosen builder variant receives. No hard routing on `stack` required in this first pass.

AC:
- `/crew:orchestrate-slice --id <SLICE>` reads frontmatter from the slice file AND the linked FEAT (slice takes precedence if both set `surface`).
- Routing matrix above is implemented; absent / invalid values fall through to `crew:builder`.
- Existing slices (no `surface` field) keep dispatching to `crew:builder` — zero regression.
- Agent activity report shows non-zero `crew:builder-fe` and `crew:builder-be` runs after loop completes one `surface: frontend` and one `surface: backend` slice.
- Doc update: `/crew:orchestrate-slice` command body documents the routing table.

Out of scope:
- Stack-based toolchain prompting beyond passing `stack` through to the builder context (separate FEAT).
- Re-routing existing in-flight slices retroactively.

Reference: full upstream request body at the URL in frontmatter — covers loop-side context, backwards-compat guarantees, and the contract loop already ships.
