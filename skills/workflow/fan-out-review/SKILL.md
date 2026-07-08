---
name: fan-out-review
prompt_id: fan-out-review
version: 1.0.0
tier: workflow
description: Fan-out review procedure for HIGH-risk or security/performance-tagged slices — how many reviewers to dispatch, how to aggregate findings, and how to resolve reviewer disagreement.
owner: sergeymilashico
last_reviewed: 2026-06-13
triggers: ["fan-out", "fan-out review", "multiple reviewers", "reviewer disagreement", "HIGH risk review", "concern:security", "concern:performance"]
---

# Fan-Out Review

## Trigger

Load when risk is HIGH or FEAT tags include `concern:security` / `concern:performance` and the dispatcher needs to decide reviewer dispatch count and aggregation strategy.

## Fan-Out Review

**Single-reviewer is the default.** Outside the trigger conditions below, `/crew:orchestrate-slice` dispatches exactly **one** `crew:reviewer` (`RISK_GATE = false` — see `commands/orchestrate-slice.md` Step 4.5 and `skills/workflow/validator-gate/SKILL.md`). This skill's fan-out only applies once `RISK_GATE` flips true.

When risk is HIGH or FEAT tags include `concern:security` / `concern:performance` (i.e. `RISK_GATE = true`): dispatch 2 reviewers default (correctness + slice's dominant concern); scale to 4 when both security and performance tags are present or the dispatcher's prompt flags a wide blast radius. Each gets a `Review lens:` line. Aggregate all lens findings before one fullstack-dev re-dispatch — never one per lens.

**Stack-lens 2nd-reviewer pick (FEAT-203 / SLICE-113).** When `RISK_GATE = true` and exactly one additional (2nd) reviewer is being picked, choose it by diff dominance instead of a generic second `crew:reviewer`:

- Count the builder's changed files (from the handoff's `## Changed files` list). Compute the `.cs` share and the `.ts`/`.tsx` share of that count.
- `.cs` files ≥ 60% of changed files → dispatch `crew:csharp-reviewer` as the 2nd lens (deep .NET idiom review — async correctness, EF Core patterns, ASP.NET Core wiring).
- `.ts` / `.tsx` files ≥ 60% of changed files → dispatch `crew:typescript-reviewer` as the 2nd lens (compiler compliance, type safety, Zod boundaries, React rules).
- Neither threshold met (mixed diff, or dominant extension is something else) → fall back to a generic `crew:reviewer` 2nd lens (existing default behavior, unchanged).
- This selection only replaces the *2nd* reviewer's identity — the 1st reviewer is always `crew:reviewer` (correctness/regression lens per Step 4 of `commands/orchestrate-slice.md`), and the 4-reviewer security+performance scale-up path is unaffected (stack-lens applies to the 2-reviewer default only).

**Reviewer disagreement** (lens A → PASS, lens B → NEEDS_FIX, or 2+ lenses conflict on severity): dispatch `crew:architect-reviewer` for binding tiebreaker. Single round, decision final, no further escalation in the same review dimension.

**Forbidden pattern:** lumping doc + policy + code into one fullstack-dev dispatch. Split per the Pick agent step (variants by file concern).

## Done

Fan-out review is complete when:

- the single-reviewer default was preserved outside HIGH-risk / `concern:security` / `concern:performance` / `SPLIT_BUILD` triggers (`RISK_GATE = false`)
- the correct reviewer count has been chosen once `RISK_GATE = true` (2 default; 4 on both security + performance or wide blast radius)
- the 2nd reviewer was picked by stack-lens dominance (`.cs` ≥60% → `crew:csharp-reviewer`; `.ts`/`.tsx` ≥60% → `crew:typescript-reviewer`; otherwise generic `crew:reviewer`)
- all lens findings have been aggregated before a single fullstack-dev re-dispatch
- reviewer disagreement has been resolved via `crew:architect-reviewer` tiebreaker (single round, binding)
- the forbidden lumping pattern has been avoided
