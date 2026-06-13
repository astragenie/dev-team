---
feature: FEAT-163
status: active
---
# Run Brief: FEAT163 SLICE71: Self-orchestrating peer-dispatch — grant Agent tool to most agents, experiment, measure

- Created: 2026-06-13T09:20:22.453Z
- Tier: full
- Goal: Lead-as-sole-orchestrator pattern is **abandoned** (see [[project_lead_orchestration_abandoned]] memory). Two days of debugging the v0.35.2 / v0.35.3 lead-dispatch chain failed to reach a working state for autonomous flow. Loop's `slice-build` mode (lives in `src/scripts/lib/slice-linker/dispatch.mts`, default `orchestratorMode` as of FEAT-190) is the live orchestrator for the autonomous path.  SLICE-71 implements **FEAT-163 SLICE-A only** (foundation — 2 lowest-risk agents). SLICE-B/C/D/E defer
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - - Add `## Peer dispatch — when to use the Agent tool` section to `agents/document-writer.md` and `agents/refactor.md` (placed after `## Integration with Other Agents`)
- Section body per FEAT-163 spec includes: (a) peer whitelist with when-to-dispatch rationale; (b) blacklist enumeration; (c) dispatch budgets (≤2/slice
  - ≤1/turn); (d) Dispatch prompt purity subsection (inherited from lead v0.35.2: no identity injection
  - address peer directly
  - no caveman:*); (e) Final-tool-call invariant subsection (peer outputs ≠ substitute for own write-* artifact)
- Per FEAT-163 dispatch graph:
  - `document-writer` whitelist: `architect`
  - `researcher`
  - `investigator`; blacklist: implementers (`backend-dev`
  - `frontend-dev`
  - `fullstack-dev`)
  - all gates (`inspector`
  - `inspector-verifier`
  - `verifier`
  - `relea
- Out Of Scope:
  - - The other 8 agents in FEAT-163's Gain-Agent-tool table (`architect`
  - `backend-dev`
  - `frontend-dev`
  - `fullstack-dev`
  - `uxdesigner`
  - `qa-expert`
  - `performance-engineer`
  - `release-engineer`) — SLICE-B/C/D
- `scripts/validate-dispatch-graph.ts` (cycle detection across whitelist graph) — deferred to SLICE-B when ≥4 agents have whitelists worth graphing
- Constitution + dev.stable amendments — SLICE-D
- Planned Files: -
- Next Step: Begin implementation

