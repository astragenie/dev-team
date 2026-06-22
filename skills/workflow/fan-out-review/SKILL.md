---
name: fan-out-review
prompt_id: fan-out-review
version: 1.0.0
tier: workflow
description: Fan-out review procedure for HIGH-risk or security/performance-tagged slices — how many inspectors to dispatch, how to aggregate findings, and how to resolve inspector disagreement.
owner: sergeymilashico
last_reviewed: 2026-06-13
triggers: ["fan-out", "fan-out review", "multiple inspectors", "inspector disagreement", "HIGH risk review", "concern:security", "concern:performance"]
---

# Fan-Out Review

## Trigger

Load when risk is HIGH or FEAT tags include `concern:security` / `concern:performance` and the dispatcher needs to decide inspector dispatch count and aggregation strategy.

## Fan-Out Review

When risk is HIGH or FEAT tags include `concern:security` / `concern:performance`: dispatch 2 inspectors default (correctness + slice's dominant concern); scale to 4 when both security and performance tags are present or the dispatcher's prompt flags a wide blast radius. Each gets a `Review lens:` line. Aggregate all lens findings before one fullstack-dev re-dispatch — never one per lens.

**Inspector disagreement** (lens A → PASS, lens B → NEEDS_FIX, or 2+ lenses conflict on severity): dispatch `crew:3rdparty:architect-reviewer` for binding tiebreaker. Single round, decision final, no further escalation in the same review dimension.

**Forbidden pattern:** lumping doc + policy + code into one fullstack-dev dispatch. Split per the Pick agent step (variants by file concern).

## Done

Fan-out review is complete when:

- the correct inspector count has been chosen (2 default; 4 on both security + performance or wide blast radius)
- all lens findings have been aggregated before a single fullstack-dev re-dispatch
- inspector disagreement has been resolved via `crew:3rdparty:architect-reviewer` tiebreaker (single round, binding)
- the forbidden lumping pattern has been avoided
