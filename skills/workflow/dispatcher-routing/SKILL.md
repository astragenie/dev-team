---
name: dispatcher-routing
prompt_id: dispatcher-routing
version: 1.0.0
tier: workflow
description: Agent quick reference table and specialist routing rules for the dispatcher orchestrator — which crew agent to dispatch for each need, architect-mandatory triggers, and multi-need split rule.
owner: astra
last_reviewed: 2026-06-13
triggers: ["dispatch", "route", "which agent", "agent quick reference", "specialist", "routing"]
---

# Lead Routing

## Trigger

Load when the dispatcher needs to pick an agent or decide how to split a multi-need slice.

## Agent Quick Reference

For most slices, pick from the main crew:

| Need | Agent | Stack |
|------|-------|-------|
| Backend code (API, DB, server) | `crew:backend-dev` | C#/.NET, Node, Python, Go |
| Frontend code (UI, React, CSS) | `crew:frontend-dev` | React, TypeScript |
| Mixed code (scripts, CI, agents, skills, infra) | `crew:fullstack-dev` | TypeScript, Python, Terraform |
| Architecture / ADR / schema design | `crew:architect` | agnostic |
| UX flow / a11y / wireframe | `crew:uxdesigner` | React |
| Customer docs (README, CHANGELOG, release notes) | `crew:document-writer` | Markdown |
| Independent code review | `crew:reviewer` | agnostic |
| Behavior validation / full-suite gate | `crew:verifier` | agnostic |
| FE+BE wire-up smoke after parallel fullstack-devs | `crew:integrator` | TypeScript, React |
| Deployment + environment evidence | `crew:release-engineer` | agnostic |
| Read-only investigation (persistent findings) | `crew:researcher` | agnostic |
| Cheap file:line lookup (no findings persist) | `crew:investigator` | agnostic |
| LOW-tier review+validate | `crew:reviewer` + `crew:verifier` (concurrent) | agnostic |
| Code quality sweep (stale refs, drift) | `crew:refactor` | TypeScript |
| Performance audit (latency, N+1, benchmarks) | `crew:performance-engineer` | agnostic |
| QA / test coverage gap analysis | `crew:qa-expert` | agnostic |

For specialist work (3rdparty agents, fan-out lenses, arbitration, scope-specific picks) rely on the Agent quick reference table above + the examples listed here; dispatch `crew:investigator` if you need a specific capability lookup. Specialist routing examples: LOW-tier slices run `crew:reviewer` + `crew:verifier` concurrently (there is no combined agent), `crew:csharp-reviewer` (stack:csharp lens), `crew:3rdparty:refactoring-specialist` (concern:refactor + scope:wide), `crew:test-automator` (concern:test-infra), `crew:3rdparty:critical-thinking` (ambiguity disambiguator), `crew:architect-reviewer` (reviewer disagreement tiebreaker). External caveman plugin agents (`caveman:cavecrew-builder` etc.) are NOT first-class crew specialists — do not route to them; they're owned by the caveman plugin and shipped with their own discipline.

**Architect-mandatory:** `surface:schema`, `concern:governance` (enforcement / process / methodology) MUST route to architect, never to fullstack-dev. `concern:governance` (customer-facing docs) routes to `crew:document-writer`; (in-prompt policy edits) routes to architect.

Multi-need slices → split into parallel bundles per Step 3; one agent per concern. No clear pick AND no obvious file pattern → dispatch `crew:3rdparty:critical-thinking` (read-only) to disambiguate intent before committing to a route.

The dispatched subagent loads its own skills — you don't need to enumerate them. If a specific skill MUST be loaded (e.g. a security-advisory consultation), name it in the dispatch prompt under `required skills:`.

## Done

Routing decision is complete when:

- the correct agent (or parallel bundle) has been identified from the table
- architect-mandatory triggers have been checked (schema, governance)
- multi-need slices have been split into one agent per concern
- the dispatch prompt contains only task framing (no identity leakage)
