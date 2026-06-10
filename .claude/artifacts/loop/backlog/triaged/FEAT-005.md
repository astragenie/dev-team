---
id: FEAT-005
status: triaged
priority: P2
category: routing
target_release: null
created: 2026-06-07
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
upstream_request: "https://github.com/sergeymilashico/loop/blob/main/docs/upstream-requests/2026-06-07-hero-crew-orchestrate-slice-surface-stack-routing.md"
pm_customer_impact: 0.65
pm_effort_estimate: 0.4
pm_strategic_alignment: 0.7
pm_technical_risk: 0.3
pm_dependency_depth: 0.2
autonomous_safe: false
triage_notes: "via=pm retriage w/ spec. Flipped autonomous_safe true->false: edits commands/orchestrate-slice.md dispatch routing = command authorship, human-in-loop per backlog discipline. High-quality spec lowers delivery risk."
composite_score: 0.6675
plan: .claude/artifacts/loop/slice-specs/FEAT-005-slice-spec.md
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
