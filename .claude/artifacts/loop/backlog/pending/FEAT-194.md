---
id: FEAT-194
status: pending
priority: null
category: feature
target_release: null
created: 2026-07-06
updated: 2026-07-06
depends_on: []
slices: []
derived_from: null
---
## Description

Model-routing as a first-class toggleable feature + cost/token monitoring. TODAY model routing is config-presence only: loop.json.modelRouting absent → runner-plugin model-router resolveModel falls back to FALLBACK_MODEL=opus for every non-trivial build, so all autonomous builds burn Opus (agents' model_pinned:sonnet is vestigial — router never reads it). Interactive /crew:build (Agent-tool dispatch) bypasses the router entirely and inherits the session model (opus-4-8[1m]). Scope: (S1) wrap model routing behind a crew.json features.model-routing.enabled toggle (mirrors redundant-read-stop/subagent-inline-warn/shell-preflight), so it can be turned on/off + audited; (S2) make interactive dispatch (/crew:build, Agent-tool path) resolve+pass the builder tier model explicitly instead of inheriting the session model; (S3) reconcile agents' model_pinned — honor it in the router OR drop it to stop implying an inert guarantee; (S4) cost/token telemetry + monitoring: per-dispatch token + model + cache-hit surfaced (ride the existing cost-report + the FEAT-188 S1a subagent-incomplete signal), with a live burn-watch the operator can eyeball, and a per-run cost cap. Motivation: 150k->256k+ token burn observed; opus->sonnet on the token-heaviest build phase is the biggest single cost cut. Context: dev-team issue #167 (token-burn patch plan §P0-0), docs/research/2026-07-06-token-burn-patch-plan.md, cost reports at .claude/artifacts/crew/cost/ show 99.7-99.8% cache hit on opus-4-7.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.