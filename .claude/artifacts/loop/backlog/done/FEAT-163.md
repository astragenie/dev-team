---
id: FEAT-163
status: done
priority: P1
category: reliability
target_release: v0.36
created: 2026-06-12
updated: 2026-06-13
depends_on: [FEAT-161]
slices: [SLICE-71, SLICE-73]
derived_from: null
autonomous_safe: false
tags: [agent-prompts, dispatch, reliability, peer-dispatch, self-orchestration, v0.36, experimental]
pm_customer_impact: 0.7
pm_effort_estimate: 0.85
pm_strategic_alignment: 0.85
pm_technical_risk: 0.85
pm_dependency_depth: 0.55
composite_score: 0.52
triage_notes: "via=pm triage 2026-06-13 | Demand: maintainer (single stakeholder, current session) validated by memory project_lead_orchestration_abandoned 2026-06-12 — 2 days debugging the v0.35.2/v0.35.3 lead-dispatch chain failed; lead-as-sole-orchestrator pattern explicitly abandoned. Workaround = loop's slice-build mode in src/scripts/lib/slice-linker/dispatch.mts is the live orchestrator (FEAT-190 default) — works, but central-router shape repeats the single-point-of-failure that broke lead. Workaround tolerable for in-flight slices; intolerable as the long-term shape. Frequency: structural — every slice routes through the orchestrator. Customer impact 0.70 (not 0.8+) because the FEAT is EXPERIMENTAL — value is hypothesis-testing, not confirmed delivery; SLICE-E may declare failure + revert. Strategic alignment 0.85: core to autonomous-loop reliability mission; v0.36 minor bump per FEAT body line 132 signals strategic weight. Effort 0.85: multi-slice epic (A-E, 5 slices), touches 10 agent prompts + scripts/validate-agents.ts + new scripts/validate-dispatch-graph.ts + .claude/crew/constitution.md + agents/deployer.md dev.stable schema; expect 4-6 weeks of iteration with measurement gates between slices. Technical risk band 0.85 (high end of 0.6-0.8 / low end of 0.9-1.0): dispatch contract change for half the agents = public/cross-plugin contract change per body line 132 + paired loop-side dispatch deny-list reconciliation per body line 133; 7 itemized risks in FEAT body (fan-out explosion, mesh loops, termination ambiguity, review-gate independence violation, FEAT-161 amplification, cost spiral, identity-anchor leak); rollback per slice via git revert until SLICE-C lands, then constitution amendment makes rollback require coordinated multi-file revert. Dependency depth 0.55: FEAT-161 SLICE-70 (Prong A — HARD OUTPUT CONTRACT) landed 2026-06-13 PASS (cost $7.51, see 20260613T090257Z report) but FEAT-161 Prong B (stub-artifact pattern) still pending per FEAT-161 frontmatter — body line 134 names Prong B as hard prerequisite for SLICE-C (peer dispatch amplifies specialist-pause). SLICE-A + SLICE-B do not block on FEAT-161 Prong B. Grade signal: observability 0.79 and security 0.79 are weak dims; peer-dispatch pattern needs observability AC (dispatch-trace logging per peer call so cost-aggregate can attribute fan-out) and security AC (whitelist enforcement at validate-dispatch-graph.ts hard-fails CI on cycles — body line 121 already proposes this). Both weak dims have AC analogs in body — pass. Pre-mortem (mandatory at P1): (1) Two weeks later — most likely failure: cost spiral during SLICE-C measurement window exceeds 2× v0.35.x baseline (FEAT body line 32 names this rollback gate); secondary likely failure: identity-anchor leak recurs because 10 agents now construct dispatch prompts and the lead v0.35.2 'Dispatch prompt purity' rules are copied imprecisely into each agent (body line 33 acknowledges); tertiary: mesh-loop in advisory pair qa-expert ↔ performance-engineer (body line 50 explicitly allows bidirectional and says 'OK because both are advisory non-gating' — assumption that needs measurement, not assertion). (2) Rollback path: SLICE-A/B = single git revert per agent, clean. SLICE-C = revert + delete validate-dispatch-graph.ts + reset .claude/crew/constitution.md + check that no in-flight slice depends on peer-dispatched output; coordinated multi-file revert. SLICE-D-E = revert release-engineer addition + delete or amend DEC-NNN doc. Hard rollback gate at SLICE-C body line 110 ('if cost > 2× baseline or pause-rate > baseline, revert C'). (3) Coverage gap: zero existing test asserts 'agent's dispatch whitelist matches its prompt' — agent-prompt-content.test.ts checks markdown shape, not graph integrity. The proposed scripts/validate-dispatch-graph.ts IS the coverage but is itself untested at triage time. AC for SLICE-A must include validate-agents.ts assertion 'Peer dispatch section present with whitelist + blacklist + budget lines when Agent tool granted'; AC for SLICE-B/C must include validate-dispatch-graph.ts cycle-detection unit test. (4) Cost analog: FEAT-148 aggregate cost-report 20260610T200000Z = $25.27 across 38 msgs for builder-scoped self-verify (cross-module, contract-shape change) — that's the closest analog to SLICE-C. SLICE-A scope (2 agents, prompt-only) maps to SLICE-64 / SLICE-65 size ≈ $3-5. SLICE-C measurement budget cited in FEAT body line 136 = $45-75 for 5 slices @ avg 3 peer dispatches @ $1-5 ea — calibrated against $7.51 FEAT-161 SLICE-70 actual today, this is plausible if peer dispatches stay shallow; under-estimated if mesh interactions emerge. Whole-FEAT estimate $80-150 across 8-12 sessions. autonomous_safe=false confirmed per FEAT body lines 107-110 (SLICE-A through SLICE-D all flag autonomous_safe=false — only SLICE-E doc-only is autonomous_safe=true); whole-FEAT flag false because the FEAT scope spans SLICE-A through D. Decomposition gate (FEAT-168): FEAT body already provides 5-slice decomposition with risk staging (A=foundation, B=advisory, C=implementers HARD GATE, D=release-engineer, E=findings doc) — proposed_slices structure is in body; recommend formal proposed_slices YAML block when SPEC is written. SLICE-C is the load-bearing slice and should NOT be scoped until FEAT-161 Prong B lands. RECOMMENDATIONS: (1) Hold SLICE-C until FEAT-161 Prong B PASSes; (2) Schedule loop:architect dispatch before SLICE-A to confirm directed-graph constraint + bidirectional-pair exception (qa-expert ↔ performance-engineer) is structurally sound; (3) Coordinate with FEAT-162 (subscription-billed eval harness) — peer dispatch creates exactly the trace shape FEAT-162 will assert on; running them in opposite order means SLICE-C lacks regression coverage."
started_at: 2026-06-13
slices_complete: [SLICE-71, SLICE-73, SLICE-75]
completed_at: 2026-06-13
---
# FEAT-163: Self-orchestrating peer-dispatch — grant Agent tool to most agents, experiment, measure

## Description

Lead-as-sole-orchestrator pattern is **abandoned** (see [[project_lead_orchestration_abandoned]] memory). Two days of debugging the v0.35.2 / v0.35.3 lead-dispatch chain failed to reach a working state for autonomous flow. Loop's `slice-build` mode (lives in `src/scripts/lib/slice-linker/dispatch.mts`, default `orchestratorMode` as of FEAT-190) is the live orchestrator for the autonomous path.

**Pivot decision (2026-06-12):** rather than perfecting top-down orchestration, **let agents self-orchestrate.** Give the `Agent` tool to most agents. Each agent dispatches peers for dependency fetches and downstream handoffs as needed. This mirrors the `agents/3rdparty/frontend-developer.md` Integration-with-Other-Agents pattern but with **actual** runtime dispatch capability (3rdparty's protocol is cosmetic JSON-in-text; ours will be real Agent tool calls).

**Hypothesis:** peer dispatch reduces orchestrator complexity, removes the single-point-of-failure pattern that caused the lead reliability issues, and produces more accurate handoffs because the agent closest to the work knows what it needs from upstream and what it produces for downstream — better than a central router can.

**Acknowledged risks (experimental — measure, don't assume):**

1. **Fan-out explosion.** Without dispatch budgets, peer A calls peer B calls peer A → cost spiral. Mitigation: per-agent `maxSubagentsPerSlice` budget + prompt-level "you may dispatch ≤N peers per turn" rule.
2. **Mesh loops.** Builder dispatches architect, architect re-dispatches builder. Mitigation: directed-graph constraint — each agent's prompt declares "you MAY dispatch [whitelist]" + "you may NEVER dispatch [blacklist]" with NO bidirectional edges.
3. **Termination ambiguity.** Who calls `/loop:slice complete --id <id>`? Today the slice ceremony is run by the orchestrating agent. Mitigation: builder remains the slice-close authority — builder's final write-handoff signals slice complete, then control returns to loop walker which dispatches inspector + verifier separately.
4. **Review-gate independence.** If builder can dispatch its own reviewer, review is no longer independent. **Hard rule: review and validation gates (`crew:inspector`, `crew:verifier`, `crew:inspector-verifier`, `crew:release-engineer`) remain dispatchable ONLY by the orchestrator (loop walker), never by any peer agent.**
5. **FEAT-161 (specialist pause) amplification.** More dispatches = more pause failure modes. Mitigation: FEAT-161 (P1) should land before or in parallel with this.
6. **Cost.** Each peer dispatch = full LLM session. Mitigation: dispatch budget per slice + monitor cost-aggregate after first 3 slices under v0.36; halt + rethink if cost > 2× v0.35.x baseline.
7. **Identity-anchor leakage repeat.** Each agent now constructs dispatch prompts. If they leak orchestrator identity into peer prompts, v0.35.2's misroute pattern returns. Mitigation: add a SHARED "Dispatch prompt purity" section to every agent that gains the Agent tool — same rules from `agents/lead.md` v0.35.2 release.

## Acceptance hints

### Scope — which agents gain Agent tool

**Gain Agent tool (10 agents):**

| Agent | May dispatch | May NOT dispatch | Reason |
|---|---|---|---|
| `architect` | `researcher`, `investigator` (architect → document-writer dropped per DEC-022 to preserve DAG; route docs handoff via lead) | implementers, gates, peers | Architect already opus + judgment role; needs to fan-out to read-only specialists during design |
| `backend-dev` | `architect` (for contract clarification), `investigator` (for code locator), `document-writer` (for API docs after impl) | `frontend-dev`, `fullstack-dev`, gates | Builder may need architect input mid-implementation; locator helps speed; downstream docs handoff is natural |
| `frontend-dev` | `architect`, `investigator`, `uxdesigner`, `document-writer` | `backend-dev`, `fullstack-dev`, gates | Same shape as backend-dev + uxdesigner for design clarification |
| `fullstack-dev` | `architect`, `investigator`, `uxdesigner`, `document-writer`, `performance-engineer` | `backend-dev`, `frontend-dev`, gates | Owns both ends; broader dispatch white-list |
| `refactor` | `investigator` | implementers, gates | Refactor is sweep-only; investigator locates targets |
| `uxdesigner` | `architect`, `researcher` | implementers, gates | Design needs architecture context + market research |
| `qa-expert` | `investigator`, `performance-engineer` | implementers, gates | QA needs locator + perf-scenario coordination |
| `performance-engineer` | `investigator`, `qa-expert` | implementers, gates | Bi-directional with qa-expert is OK because both are advisory non-gating |
| `document-writer` | `architect`, `researcher`, `investigator` | implementers, gates | Needs source of truth from designers/researchers |
| `release-engineer` | `document-writer` (for release notes) | implementers, gates | Release notes handoff |

**Stay tool-isolated (8 agents):**

| Agent | Why |
|---|---|
| `lead` | Deprecated as orchestrator — keep Agent tool only for legacy `/crew:build` path until that command is removed in a later FEAT |
| `inspector` | Review gate — must stay independent of dispatch chain |
| `inspector-verifier` | Combined gate — same independence rule |
| `verifier` | Validation gate — same |
| `researcher` | Read-only investigation — no need to dispatch (consumers dispatch researcher, not other way around) |
| `investigator` | Same — leaf node |
| `integrator` | Specialized E2E — leaf node |
| `parallel-runner` | Already orchestrator-of-orchestrators; tool surface stays as-is |

### Per-agent prompt additions

Each Agent-tool-gaining agent gets a NEW section after `## Integration with Other Agents`:

```markdown
## Peer dispatch — when to use the Agent tool

You have the `Agent` tool. You MAY dispatch peers in this whitelist when you need
their output to complete YOUR task:

- <peer-1>: <when to dispatch>
- <peer-2>: <when to dispatch>

You MUST NOT dispatch:

- <blacklist enumeration>

Dispatch budget per slice: max <N> peer dispatches (default 2).
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

When you write a dispatch prompt for a peer:

- Do NOT inject your own role / identity into the body ("you are the orchestrator", "as the lead", etc.).
- Address the peer directly as that peer ("Implement X", "Locate Y", "Produce ADR draft for Z").
- State the deliverable expected back (artifact path, headline).
- State the scope rails (forbidden files, time/budget cap).
- Never use `caveman:*` agents.

### Final-tool-call invariant (HARD)

Regardless of what you dispatch or receive from peers, your LAST tool call before
returning to the parent orchestrator MUST be your role's mandatory write-* artifact
call (`crew write-handoff` for builders, `crew write-review-result` for reviewers,
etc.). Peer outputs are inputs to YOUR work, not substitutes for it.
```

### Per-slice decomposition

- **SLICE-A** (foundation): pick 2 lowest-risk agents to gain Agent tool first — recommend `document-writer` (already low-stakes, mostly read+write markdown) and `refactor` (already isolated quality sweep). Add Agent tool to frontmatter, add Peer dispatch section to body. Validate-agents green. Run 1 manual end-to-end slice under each — measure cost + dispatch count + any misroute behavior. autonomous_safe = false (first cut of new pattern).
- **SLICE-B**: extend to `architect` + `uxdesigner` + `qa-expert` + `performance-engineer` (advisory roles). Measure on next 3 slices. autonomous_safe = false.
- **SLICE-C**: extend to implementers (`backend-dev`, `frontend-dev`, `fullstack-dev`) — highest blast radius. Run 5 slices under measurement. Hard rollback gate: if cost > 2× baseline or pause-rate > baseline, revert C. autonomous_safe = false.
- **SLICE-D**: extend to `release-engineer`. Lowest priority — deploy work rarely needs peer dispatch. autonomous_safe = false.
- **SLICE-E**: write findings to `docs/decisions/DEC-NNN-peer-dispatch-experiment.md`. Either declare the experiment a success and tighten the pattern, or declare it a failure and revert. autonomous_safe = true (doc only).

### Constitution + dev.stable amendments

- `.claude/crew/constitution.md` currently lists 6 team roles and references lead as orchestrator. Update to reflect peer-dispatch pattern + flag review-gate independence rule as a HARD RULE.
- `dev.stable: true` commit-unlock today requires `/crew:build` or `/crew:fix` flow. Update to also unlock for `slice-build` flow (already a known gap from the SLICE-104 audit notes).

### Validation hooks

- `scripts/validate-agents.ts` must check: Agent-tool-gaining agents have a `Peer dispatch` section with whitelist + blacklist + budget lines. Lint-style rule, not behavioral.
- Optional: `scripts/validate-dispatch-graph.ts` (new) — parses the whitelists across all 10 Agent-tool agents and asserts the dispatch graph has NO cycles. Fails if any agent's whitelist includes a peer whose own whitelist includes this agent.

### Out of scope

- Wiring loop's `slice-build` to consume the new peer-dispatch pattern. Loop's dispatch is unchanged; this FEAT enables peer dispatch WITHIN the builder's session, not at the orchestrator level. Loop walker still dispatches builder + inspector + verifier directly.
- Removing `crew:lead` entirely. Legacy `/crew:build` still uses lead. Separate cleanup FEAT after the experiment validates.
- Changing the review/validation gate dispatch path. Inspector + verifier remain orchestrator-only.

## Closure (2026-06-13)

FEAT-163 closes with SLICE-A + SLICE-B + SLICE-C + SLICE-D + SLICE-E all landed. v0.36 target hit at the prompt-contract level.

- **SLICE-A** (DEC-020): foundation — `document-writer`, `refactor` carry Peer dispatch; `validate-agents.ts` lint rule scoped via PEER_DISPATCH_ALLOWLIST. Commit `5a58f70`. Grade 0.793.
- **SLICE-B** (DEC-022): advisory tier — `architect`, `uxdesigner`, `qa-expert`, `performance-engineer` carry Peer dispatch; `scripts/validate-dispatch-graph.ts` (new) detects cycles, BIDIRECTIONAL_ALLOWED catches the qa-expert ↔ performance-engineer pair. DEC-022 records the architect → document-writer edge drop. Commit `b02dd66`. Grade 0.811.
- **SLICE-C + D + E** (DEC-023): implementer + release-engineer tier bundled — `backend-dev`, `frontend-dev`, `fullstack-dev`, `release-engineer` carry Peer dispatch; PEER_DISPATCH_ALLOWLIST extended to 10 in both validators; `.claude/crew/constitution.md` amended with `## Peer dispatch (v0.36+)` subsection; `.claude/crew/deployment.md` `dev.stable` unlocks autonomous `slice-build` flow; `~/.claude/crew/constitution.md` `/crew:build` list updated to include `slice-build`. Inspector found a HIGH regex bug in `validate-dispatch-graph.ts` (inline `## Peer dispatch` references in Tool restrictions matched first); fixed by anchoring to `/^## Peer dispatch/im`. Operator-approved frontmatter fix: removed `disallowedTools: Agent` from `backend-dev`, `frontend-dev`, `fullstack-dev` so their Peer dispatch sections actually take effect at runtime; stale `## Tool restrictions` body sections rewritten to point at Peer dispatch.

## Measurement window (per DEC-023)

Monitor cost-aggregate + pause-rate across the next 5 slices that touch implementer agents. Hard rollback gate: if cost > 2× v0.35.x baseline OR pause-rate exceeds baseline, single coordinated `git revert` reverses SLICE-71 + SLICE-73 + SLICE-75 commits. FEAT-161 Prong A+B (already shipped this session) keeps the stub-on-entry recovery primitive active during the measurement window.

## Out of scope (deferred)

- SLICE-F (later cleanup FEAT): remove `crew:lead` legacy `/crew:build` path
- Loop-side reconciliation of `slice-build` dispatch deny list (per body line 145) — separate cross-plugin FEAT
- FEAT-162 (subscription-billed eval harness) coordination — independent shipping schedule

## Notes

- **DEC-022 (cycle-resolution):** The `architect → document-writer` dispatch edge listed in the original "Gain Agent tool" table was dropped during SLICE-73. SLICE-71 added the `document-writer → architect` edge (document-writer may dispatch architect for source-of-truth context). Adding the reverse would have created an `architect ↔ document-writer` cycle, violating the directed-graph constraint. DEC-022 records the resolution: architect's whitelist excludes document-writer; when an architect-authored ADR needs a docs-quality pass, the lead (or loop walker) dispatches document-writer separately after architect's handoff completes.

- This FEAT is the **inverse** of an earlier draft of FEAT-163 (drafted 2026-06-12 same session, never committed) which proposed adding a "you do NOT dispatch peers" caveat to v0.35.3 Integration sections. User pivoted to the opposite direction after reflecting on lead's failure. The earlier draft is documented here for completeness — the choice was made deliberately, not by oversight.
- Expect this work to land as `v0.36.0` (minor bump, not patch) because it changes the dispatch contract for ~half the agents. v0.35.x stays the lead-orchestrated baseline.
- Paired loop-side concern: loop's `slice-build` dispatch deny list in `dispatch.mts` will need broadening or the builder's new peer-dispatch capability may collide with loop's "Do NOT dispatch crew:inspector or crew:verifier yourself" framing. Reconcile during SLICE-C.
- FEAT-161 (HARD OUTPUT CONTRACT + stub artifact) should ship BEFORE SLICE-C — peer dispatch amplifies the specialist-pause failure mode.
- FEAT-162 (subscription-billed eval harness) should ship in parallel to capture peer-dispatch behavior in regression tests.
- Cost analog: each peer dispatch ≈ $1-5 per LLM session depending on agent + slice size. Five slices under SLICE-C at avg 3 peer dispatches per slice ≈ $45-75 measurement budget. Acceptable.
- Decision boundary with loop: if peer dispatch works well in the BUILDER, can we deprecate loop's `slice-build` post-builder fan-out (inspector + verifier dispatched by loop walker) and let builder also dispatch its inspector + verifier? **No** — review-gate independence rule. Inspector/verifier MUST be dispatched by the orchestrator (loop walker), not by the builder under review. This is a hard architectural line that does not move.
