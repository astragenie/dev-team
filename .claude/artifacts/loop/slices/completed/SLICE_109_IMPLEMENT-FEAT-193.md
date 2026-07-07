---
id: SLICE-109
title: Implement FEAT-193
status: completed
feature: FEAT-193
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
created: 2026-07-07
updated: 2026-07-07
completed_at: 2026-07-07
---
# SLICE-109: Implement FEAT-193

Implements FEAT-193. See [feature file](../../../backlog/in-progress/FEAT-193.md) for product context.

## Objective

**GEPA-consumption layer on top of FEAT-188's capture/recall infra.** Rescoped

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] **AC-1 (S2 · aggregate):** GIVEN sibling repos on the machine each holding
- [ ] **AC-2 (S2 · dedup + idempotent):** GIVEN the same trial `(agent, rationale-hash)`
- [ ] **AC-3 (S2 · completeness — product_completeness gate):** GIVEN N eligible sibling
- [ ] **AC-4 (S2 · marker discipline):** GIVEN a trial with `source: "captured"` but WITHOUT
- [ ] **AC-5 (S2 · read-only on siblings):** GIVEN sync scans sibling repos, WHEN it runs,
- [ ] **AC-6 (S3 · digest):** GIVEN an aggregated hub corpus with failing trials, WHEN
- [ ] **AC-7 (S3 · completeness):** GIVEN the hub corpus holds failures for M agents, WHEN
- [ ] **AC-8 (S3 · astramem citation):** GIVEN FEAT-188 astramem lessons match a failure
- [ ] **AC-9 (S3 · human gate — no blind auto-promote):** GIVEN the report informs
- [ ] **AC-10 (S3 · provenance blocker cleared first):** GIVEN `champion-provenance-writer.ts`

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-193 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
