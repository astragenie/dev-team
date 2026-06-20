---
id: FEAT-160
status: done
closed_at: 2026-06-20
closed_via: lead-orchestration-abandoned-superseded
closure_note: "SLICE-86 shipped the agent-registry library + `crew agent-route` CLI on top of the pre-existing capabilities frontmatter (already present on 30 agent files). The remaining lead.md slim-down is now DEAD WORK: lead-as-sole-orchestrator was abandoned 2026-06-12 per memory project_lead_orchestration_abandoned. Loop slice-build dispatch + inline-from-main-thread orchestration replaced lead routing. The agent-registry library remains useful — any future orchestrator (e.g. /crew:orchestrate-slice, loop dispatch) can consume it without lead.md being involved. Closing FEAT-160 done."
priority: P3
category: quality
target_release: null
created: 2026-06-11
updated: 2026-06-20
depends_on: []
slices: [SLICE-86]
derived_from: null
autonomous_safe: false
tags: [refactor, governance, lead-orchestration, registry]
pm_customer_impact: 0.4
pm_effort_estimate: 0.3
pm_strategic_alignment: 0.5
pm_technical_risk: 0.35
pm_dependency_depth: 0.9
composite_score: 0.468
triage_notes: "Capability registry from OpenAI review is speculative (scales to 30+ agents — we have 17); touches every agent frontmatter + schema-debate risk (overlap with feat-tag-schema.md); declined-adjacent: pay refactor cost now for problem we don't have."
partial_progress: "SLICE-86 (2026-06-20) shipped registry + CLI: scripts/lib/agent-registry.ts (loadAgentRegistry + routeByTags) + `node scripts/crew.ts agent-route` subcommand + 7 tests. Capabilities frontmatter was already on all 30 agents from a prior pass. REMAINING: lead.md slim-down — replace hardcoded Tag-to-agent table with `see agent-registry` reference, keep top-5 canonical routes inline. autonomous_safe=false (agents/lead.md edit per CLAUDE.md governance, requires human-in-loop review)."
started_at: 2026-06-20
---
# FEAT-160: Dynamic capability discovery (agent capability registry)

## Description

OpenAI review (8.7/10) flagged hardcoded agent names in lead's
routing table as a scalability limit. Current design scales to
~10-15 agents but becomes painful at 30+.

Replace hardcoded routing with capability metadata in each agent's
frontmatter, plus a discovery layer that builds the routing table
at lead's session start from agent files on disk.

Example agent frontmatter addition:

```yaml
capabilities:
  - surface:ui
  - stack:react
  - concern:accessibility
  - lens:visual
selection_priority: 10
```

New `scripts/lib/agent-registry.ts` walks `agents/**/*.md`, parses
frontmatter, builds `Record<tag, AgentMatch[]>` lookup table. Lead
reads the registry instead of consulting its inlined Tag-to-agent
mapping.

Benefits per OpenAI feedback:
- Adding a new agent = 1 file with capabilities frontmatter; no
  lead.md edit.
- Tag table → derived from filesystem, not maintained by hand.
- Capability-based fan-out review (pick reviewers whose
  capabilities match the diff's concern tags).

## Acceptance hints

- All 17 agents gain `capabilities:` frontmatter (camel-cased tag
  list).
- `scripts/lib/agent-registry.ts` builds and caches lookup table.
- `node scripts/crew.ts route --tags "..." --concerns "..."`
  returns ranked agent matches.
- Lead's Tag-to-agent mapping section becomes a thin reference
  ("see `agent-registry` for full route"). Top 5 canonical routes
  retained inline for quick scan.
- Unit tests cover registry build + lookup + ambiguity ranking.
- Backward compatible: if frontmatter `capabilities:` missing,
  agent is still discoverable (logs warning, no route).

## Notes

Depends on agreement on capability tag schema. Likely overlaps with
existing `docs/standards/feat-tag-schema.md`. Could combine with
FEAT-158 (move policy to skills) since both touch lead routing.
autonomous_safe=false — touches every agent frontmatter. Source:
OpenAI review 2026-06-11 commit `f554a16`.
