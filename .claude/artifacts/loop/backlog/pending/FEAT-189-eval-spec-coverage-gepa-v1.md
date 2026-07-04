---
id: FEAT-189
status: pending
priority: P1
category: quality
target_release: null
created: 2026-07-04
depends_on: []
slices: []
derived_from: docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md
pm_customer_impact: 0.75
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.8
pm_technical_risk: 0.35
pm_dependency_depth: 0.2
composite_score: 0.7
autonomous_safe: true
tags: [stack:typescript, surface:evals, concern:gepa, concern:quality]
triage_notes: "Free-text intake 2026-07-04 (PM-scored at intake, FEAT-277 mode). Only 2 of 8 GEPA v1 target agents (fullstack-dev, reviewer) carry real eval specs; the other 6 point at planned: sentinels — surfaced as 6 live validate-agents.ts warnings on every CI run. Blocks two things: (1) verifier gates the FEAT-183 auto-merge decision with n=0 trials; (2) gepa-statistical-bar.md shows even covered agents sit at n=8-10, undetectable at the +5pp promotion bar — more real specs is the only path to a meaningful corpus. Templated spec+fixture authoring per evals/README.md precedent, no dispatch-prompt or runtime changes → autonomous_safe=true. Review caveat: fixture quality feeds GEPA promotion decisions downstream — reviewer should check failure-mode coverage per agent, not just schema shape."
---

# FEAT-189: Eval-spec coverage for GEPA v1 target agents

## Description

Author real eval specs (`evals/agents/*.yaml`) for the 6 agents currently carrying
`planned:` sentinels: verifier, backend-dev, frontend-dev, integrator, refactor,
release-engineer. Each spec follows the `crew-fullstack-dev.yaml` /
`crew-reviewer.yaml` precedent: candidate config, judge config with fallback
(groq primary + gemini validate), daily budget cap, and 5+ hand-seeded fixtures
covering the agent's core failure modes. Closes the coverage gap from the
2026-07-04 architecture review and unblocks honest GEPA corpus growth toward the
`min_soak_trials=20` statistical floor.

## Acceptance criteria

### S1 — verifier eval spec (highest priority: critical-allowlist agent, n=0 today)
- GIVEN `agents/verifier.md` currently declares `evals: planned:evals/agents/verifier.yaml`, WHEN S1 lands, THEN a real `evals/agents/verifier.yaml` exists with candidate config, judge config (groq primary + gemini fallback per existing pattern), and a daily budget cap block.
- GIVEN the verifier's core failure modes (false-PASS on a failing scenario, false-FAIL on a passing scenario, missing evidence citation, critical-allowlist misclassification), WHEN fixtures are authored, THEN at least 5 hand-seeded fixtures exist, each covering a distinct failure mode with an llm-rubric assertion.
- GIVEN `node ./scripts/validate-agents.ts` runs after S1, WHEN it checks `agents/verifier.md`, THEN the planned-eval warning for verifier no longer fires.
- GIVEN `bun run evals --dry-run --prompt verifier`, WHEN run against the new spec, THEN it executes cleanly against the fixtures with no schema errors.

### S2 — backend-dev + frontend-dev eval specs (builders, highest dispatch volume)
- GIVEN `agents/backend-dev.md` and `agents/frontend-dev.md` both declare `planned:` sentinels, WHEN S2 lands, THEN both gain real specs following the S1/precedent format (candidate, judge with fallback, budget block).
- GIVEN each agent's core failure modes (backend-dev: EF Core migration mistakes, missing null-safety, async/await misuse; frontend-dev: orval client drift, accessibility regressions, missing test coverage on new components), WHEN fixtures are authored, THEN each spec has 5+ hand-seeded fixtures covering those modes.
- GIVEN `validate-agents.ts` runs after S2, WHEN it checks both agent files, THEN neither planned-eval warning fires.

### S3 — integrator + refactor eval specs
- GIVEN `agents/integrator.md` and `agents/refactor.md` both declare `planned:` sentinels, WHEN S3 lands, THEN both gain real specs (candidate, judge+fallback, budget).
- GIVEN each agent's core failure modes (integrator: false-PASS on a broken live wire-up, missing OpenAPI-schema runtime validation; refactor: complexity-cap violations left unfixed, stale-ref false negatives), WHEN fixtures are authored, THEN each spec has 5+ hand-seeded fixtures.
- GIVEN `validate-agents.ts` runs after S3, WHEN it checks both files, THEN neither planned-eval warning fires.

### S4 — release-engineer eval spec + coverage closure
- GIVEN `agents/release-engineer.md` declares a `planned:` sentinel, WHEN S4 lands, THEN it gains a real spec (candidate, judge+fallback, budget) with 5+ fixtures covering its core failure modes (skipping a CI gate before release, marketplace-manifest version mismatch, force-push/tag-delete risk misses).
- GIVEN all 8 GEPA v1 target agents now carry real specs, WHEN `node ./scripts/validate-agents.ts` runs, THEN it emits zero planned-eval warnings (down from 6).
- GIVEN the full spec set exists, WHEN `crew:gepa-history` or an equivalent corpus check is run per agent, THEN the path toward `min_soak_trials=20` is unblocked for all 8 agents (this FEAT does not itself run the trials, only removes the authoring blocker).

## Refs

- `evals/README.md` — spec format + judge-registry recipe
- `evals/agents/crew-fullstack-dev.yaml`, `evals/agents/crew-reviewer.yaml` — precedent
- `docs/standards/gepa-statistical-bar.md` — why corpus size matters
- `docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md` §6 — evidence
