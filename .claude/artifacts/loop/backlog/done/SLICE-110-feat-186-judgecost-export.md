---
id: SLICE-110
parent: FEAT-186
status: triaged
priority: P2
created: 2026-07-01
title: "FEAT-186 S1 — @astragenie/gepa-core exports JudgeCost canonical shape (MINOR bump)"
stack: typescript
autonomous_safe: false
est_days: 1
depends_on: [FEAT-184, SLICE-109]
touches_files:
  - gepa-core/src/types/cost.ts
  - gepa-core/src/judge.ts
  - gepa-core/src/index.ts
  - gepa-core/tests/judge-cost-shape.test.ts
  - gepa-core/CHANGELOG.md
  - gepa-core/package.json
---

# SLICE-110: FEAT-186 S1 — JudgeCost canonical shape export

## Source

FEAT-186 `proposed_slices` S1 (2026-06-29 pm-decompose). Materialized 2026-07-01 to unblock parallel S2 ‖ S3 dispatch.

## Scope

Define and export `JudgeCost` interface from `@astragenie/gepa-core`:

```ts
interface JudgeCost {
  usd: number;
  latency_ms: number;
  tokens?: { in: number; out: number };
  cache?: { hit: boolean; tokens_saved?: number };
}
```

- Wire shape into `LLMJudge.evaluate()` return type and `Trial.score` typing. No behavior change — pure type widening over what FEAT-184 already returns.
- Cut gepa-core MINOR release (0.5.0 → 0.6.0; additive only).
- Add contract test asserting `JudgeCost` is in the public export surface.
- Add contract test asserting `tokens?` and `cache?` stay optional across all 5 shipped providers (ollama, generic-openai, groq, gemini, azure).

## Acceptance criteria

**AC-1:** `import type { JudgeCost } from "@astragenie/gepa-core"` resolves. Shape matches the interface above field-for-field.

**AC-2:** `LLMJudge.evaluate()` return type is `Promise<{ score: number; rationale: string; cost: JudgeCost; latency_ms: number }>`. Existing callers compile without change (backward-compat via widening — old `cost_usd: number` becomes `cost: JudgeCost` with `usd` field).

**AC-3:** Contract test `tests/judge-cost-shape.test.ts` asserts:
- `JudgeCost` is exported from package root.
- `tokens?` is optional on all 5 provider mock outputs (ollama, generic-openai, groq, gemini, azure).
- `cache?` is optional on all 5 provider mock outputs.

**AC-4:** gepa-core `CHANGELOG.md` documents 0.6.0 as MINOR — additive export only, no breaking change to any 0.5.x consumer.

**AC-5:** `bun test tests/` green on gepa-core; dev-team `bun run test` unchanged (dev-team not yet consuming `JudgeCost` — that's S2's job).

**AC-6:** npm publish `@astragenie/gepa-core@0.6.0` succeeds. Package available on npmjs.org.

## Risks

- **Retroactive MAJOR risk**: tokens?/cache? optionality MUST stay optional on all 5 provider mock outputs. If any provider's typed mock output forces `tokens` non-optional, existing consumers break → MAJOR bump forced. Mitigation: contract test in AC-3 grep-asserts optionality across all 5 providers before publish.
- **Publish-lockout risk**: gepa-core v0.2.0 hit 24h unpublish lockout (see memory `gepa-core-v0.2.0-unpublish-lockout`). Any typo in package.json exports map before publish = new patch version bump, cannot re-use 0.6.0 slot for 24h. Mitigation: local `npm pack --dry-run` verification before publish; run against a scratch consumer package first.
- **SLICE-109 dependency**: azure judge must be in gepa-core before S1 ships — otherwise the shape contract test covers 4 providers instead of 5 and MAJOR risk on azure is unassessed. Hard gate: SLICE-109 close before S1 open.

## Out of scope (deferred)

- Consumer wiring in dev-team `evals/cli.ts` — deferred to SLICE-111 (S2).
- Renderer changes in `.claude/artifacts/crew/cost/<slice>.md` — deferred to SLICE-112 (S3).
- brief-me reader — deferred to S4.
- Asymmetry heuristic + Langfuse emission — deferred to S5.

## Dispatch notes

- Autonomous_safe=false: cross-plugin publish ceremony + npm publish + new exported type. Human review at handoff mandatory per CLAUDE.md hard rule + cross-plugin contract policy.
- Cross-repo: work happens in `astragenie/gepa-core` repo, not dev-team. Dispatch requires operator sitting on gepa-core clone.
- Wave gate: after publish, SLICE-111 (S2) + SLICE-112 (S3) unblock for parallel dispatch in dev-team.
