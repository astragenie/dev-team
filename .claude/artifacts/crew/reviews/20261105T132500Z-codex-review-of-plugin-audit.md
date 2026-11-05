# Codex independent review of the 2026-11-05 plugin audit

- Reviewer: OpenAI Codex CLI 0.166.0, model gpt-6.1-sol, sandbox read-only, reasoning high (investigation) then medium (write-up)
- Session: 01a1ad1f-bf48-7dc3-841b-c93582de9af4 (first pass hit the 580 s cap mid-investigation; resumed once to write the verdict)
- Tokens: 355,132 (resume pass)
- Subject: `.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md`
- Output below is verbatim.

---

Read-only review of this repository. Successor-cache claims and reported benchmark runs were not independently reproduced.

| # | Priority | Audit finding | Verdict | Evidence |
|---|---|---|---|---|
| 1 | [P1] | #1: empty-diff light path | **CONFIRMED** | Build classifies before implementation; an empty diff satisfies its size and marker checks. [build.md:13](C:/work/mega/dev-team/commands/build.md:13) |
| 2 | [P1] | #2: nonexistent build agent | **CONFIRMED** | Dispatch explicitly requests `subagent_type: crew:build`; no corresponding agent exists. [parallel.md:38](C:/work/mega/dev-team/commands/parallel.md:38) |
| 3 | [P2] | #3: hook fan-out | **OVERSTATED** | Bash has six Bun launches, but SubagentStop has four Bun launches plus a shell script. The benchmark measures one hook’s cold start. [hooks.json:53](C:/work/mega/dev-team/hooks/hooks.json:53), [benchmark:8](C:/work/mega/dev-team/tests/hook-cold-start-bench.test.ts:8) |
| 4 | [P1] | #4: fake analyzers | **CONFIRMED** | All six scripts contain placeholder analysis returning empty findings and report success. [code_quality_checker.py:52](C:/work/mega/dev-team/skills/workflow/reviewing-code/scripts/code_quality_checker.py:52) |
| 5 | [P2] | #5: eight missing scripts | **WRONG** | There are **nine** missing entry points: three each in backend, fullstack and security advisory. [backend:30](C:/work/mega/dev-team/skills/domain/architecture/backend-advisory/SKILL.md:30), [fullstack:30](C:/work/mega/dev-team/skills/domain/architecture/fullstack-advisory/SKILL.md:30), [security:30](C:/work/mega/dev-team/skills/domain/security-advisory/SKILL.md:30) |
| 6 | [P1] | #6: inert peer-dispatch lint | **CONFIRMED** | The check returns unless explicit `tools:` includes Agent; none of the allowlisted agents declares that. [validate-agents.ts:205](C:/work/mega/dev-team/scripts/validate-agents.ts:205) |
| 7 | [P2] | #7: contradictory reporting | **OVERSTATED** | Contracts conflict, but “nothing reads the PR comment” exceeds the evidence: the builder explicitly says the dispatcher reads PR comments. [fullstack-dev.md:205](C:/work/mega/dev-team/agents/fullstack-dev.md:205), [fullstack-dev.md:227](C:/work/mega/dev-team/agents/fullstack-dev.md:227) |
| 8 | [P1] | #8: missing reviewer procedure | **CONFIRMED** | Mandatory `docs/workflow/reviewing-code/` does not exist. [reviewer.md:100](C:/work/mega/dev-team/agents/reviewer.md:100) |
| 9 | [P1] | #9: unsupported inspected badge | **CONFIRMED** | Fix requests `inspected`; badge lookup rejects unsupported names. [fix.md:34](C:/work/mega/dev-team/commands/fix.md:34), [workflow-state.ts:350](C:/work/mega/dev-team/scripts/lib/workflow-state.ts:350) |
| 10 | [P1] | #10: contradictory validation policy | **CONFIRMED** | Orchestration explicitly skips the verifier by default; routing says “always” and “No skip path.” [orchestrate-slice.md:517](C:/work/mega/dev-team/commands/orchestrate-slice.md:517), [routing-table.md:64](C:/work/mega/dev-team/docs/routing-table.md:64) |
| 11 | [P1] | #11: dead Bash timing correlation | **CONFIRMED** | Separate pre/post processes depend on the same module-local Map. [bash-gate-timer-tap.ts:10](C:/work/mega/dev-team/hooks/lib/bash-gate-timer-tap.ts:10), [hooks.json:103](C:/work/mega/dev-team/hooks/hooks.json:103) |
| 12 | [P2] | #12: missing hook failure settings | **CONFIRMED** | No entries specify `timeout` or `onFailure`. This establishes reliance on platform defaults. [hooks.json:84](C:/work/mega/dev-team/hooks/hooks.json:84) |
| 13 | [P1] | #13: silent jq dependency | **CONFIRMED** | Collision detection invokes jq, suppresses stderr and explicitly treats failure as no collision. jq was unavailable in this shell. [build.md:51](C:/work/mega/dev-team/commands/build.md:51), [build.md:62](C:/work/mega/dev-team/commands/build.md:62) |
| 14 | [P1] | #41: runtime dependency packaging | **CONFIRMED** | Static runtime imports require plugin-std, zod and yaml; the latter two are devDependencies. Fresh-cache execution was not reproduced. [result.ts:16](C:/work/mega/dev-team/scripts/lib/result.ts:16), [telemetry/config.ts:9](C:/work/mega/dev-team/scripts/lib/telemetry/config.ts:9), [package.json:13](C:/work/mega/dev-team/package.json:13) |
| 15 | [P2] | #42: unbounded cost windows | **OVERSTATED** | Current code prefers `run.completedAt`, emits distinct slice/aggregate kinds, but lacks deduplication. The audit’s cited `scripts/lib/cost/…` path is nonexistent. [emit-cost-report.ts:134](C:/work/mega/dev-team/scripts/lib/cost-hygiene/emit-cost-report.ts:134), [emit-cost-report.ts:152](C:/work/mega/dev-team/scripts/lib/cost-hygiene/emit-cost-report.ts:152) |
| 16 | [P1] | #43: silent pricing fallback | **CONFIRMED** | Only three model-family prefixes exist; unmatched models silently use Sonnet-4 pricing. [pricing.json:10](C:/work/mega/dev-team/scripts/lib/pricing.json:10), [session-cost.ts:27](C:/work/mega/dev-team/scripts/lib/session-cost.ts:27) |
| 17 | [P1] | #44: escaped paths and invalid JSON | **CONFIRMED** | URL pathname remains percent-encoded; shell logging inserts Windows paths without JSON escaping. [session-cost.ts:21](C:/work/mega/dev-team/scripts/lib/session-cost.ts:21), [log_event.sh:25](C:/work/mega/dev-team/scripts/log_event.sh:25) |

18. **[P1] MISSING — CI skips the actual product.** The `.md$` exemption includes agents, commands and skills, bypassing their validators and prompt tests. Fix this before adding validators. [test.yml:36](C:/work/mega/dev-team/.github/workflows/test.yml:36)

19. **[P1] MISSING — required CI gate fails open.** If change detection fails or supplies no output, `code != true` passes. Require successful detection and explicit `code=false` for the exemption. [test.yml:118](C:/work/mega/dev-team/.github/workflows/test.yml:118)

20. **[P1] MISSING — omitted verdict means approval.** CLI normalization accepts a missing decision; workflow state then marks review or validation passed. Omitting review decision also avoids the test-summary requirement. [crew.ts:634](C:/work/mega/dev-team/scripts/crew.ts:634), [crew.ts:667](C:/work/mega/dev-team/scripts/crew.ts:667), [workflow-state.ts:428](C:/work/mega/dev-team/scripts/lib/workflow-state.ts:428), [workflow-state.ts:467](C:/work/mega/dev-team/scripts/lib/workflow-state.ts:467)

21. **[P1] MISSING — parallel reviews use last-writer-wins state.** Both reviewers overwrite one `reviewResult` and one status. An approval arriving after rejection turns the gate green. Aggregate required reviewers explicitly. [workflow-state.ts:425](C:/work/mega/dev-team/scripts/lib/workflow-state.ts:425)

22. **[P1] MISSING — builders publish before review.** Fullstack-dev mandates pushing and opening a draft PR before reporting. This bypasses the dispatcher’s explicit-approval ship boundary and lacks a branch precondition there. [fullstack-dev.md:213](C:/work/mega/dev-team/agents/fullstack-dev.md:213), [build.md:118](C:/work/mega/dev-team/commands/build.md:118)

23. **[P1] MISSING — consumer validation assumes this repository’s CI.** The default verifier exemption relies on `.github/workflows/test.yml` without establishing that a consumer has an equivalent workflow or awaiting its result. [orchestrate-slice.md:517](C:/work/mega/dev-team/commands/orchestrate-slice.md:517)

24. **[P1] PLAN — fix enforcement before optimizing architecture.** Move the CI defects, explicit verdict requirements, reviewer aggregation and consumer-install checks ahead of the consolidated hook dispatcher. A faster false-green workflow is still broken.

25. **[P1] PLAN — H1 bundling promises too much.** Externalizing OTel/AWS leaves dependencies for enabled features. Removing `docs/` breaks existing shipped references. “Under 2 MB” and “permanently” are unproven; validate the complete installed artifact from an unrelated consumer directory. [audit:158](C:/work/mega/dev-team/.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md:158), [build.md:78](C:/work/mega/dev-team/commands/build.md:78)

26. **[P1] PLAN — deleting model enforcement as a “no-op” is wrong.** It implements model injection when routing is configured and enabled. Disabled configuration is not dead implementation. [model-routing-enforce.ts:119](C:/work/mega/dev-team/hooks/lib/model-routing-enforce.ts:119), [model-routing-enforce.ts:135](C:/work/mega/dev-team/hooks/lib/model-routing-enforce.ts:135)

27. **[P1] PLAN — Workflow is a bounded bet; wholesale re-platforming is a trap.** Prototype read-only review first. The runtime cannot directly access shell/files or import modules, lacks mid-run sign-off, and can restart agents while retaining their file changes. Schema-valid output does not prove successful work. Require explicit failure aggregation, replay tests and idempotent side effects before migrating builds. [Official Workflow documentation](https://code.claude.com/docs/en/workflows#behavior-and-limits)

28. **[P2] PLAN — arbitrary reduction targets and generated prompts are premature.** “23→14 agents,” “71→35 skills,” and “contradictions impossible by construction” lack behavioral evidence. Zero internal references do not establish zero interactive users. Measure usage and failures before merging roles or adding a mandatory superpowers dependency. [audit:167](C:/work/mega/dev-team/.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md:167)

29. **[P2] PLAN — telemetry cleanup needs better semantics.** Reject missing observations, not legitimate zero costs or genuinely failed grades. Separate performance benchmarks from correctness checks, but diagnose e2e retries before deleting them. [audit:162](C:/work/mega/dev-team/.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md:162)

30. **[P2] ADOPTIONS — mostly fashion without workload evidence.** Defer learned suppressions, memory usefulness counters, an emphasis-budget lint, cross-harness bundles and a merge queue with bisection. Safe-outputs architecture addresses privileged automation; applying it to every local builder adds ceremony without a demonstrated threat boundary.

31. **[P2] ADOPTIONS — prioritize observable outcomes.** Adopt deterministic checks before reviewers, bounded repairs, evidence per acceptance criterion and consumer-install tests. Missing priorities: reject→approve ordering tests, absent-decision tests, cancellation/replay tests, and a single-agent baseline measuring accepted changes, escaped defects, cost and maintainer intervention.

Verdict: sufficient to open specific defect tickets; insufficient to adopt the roadmap wholesale.  
Scope: repository checks only; successor behavior and reported measurements remain unverified.  
This week, 1: repair CI filtering and require explicit, aggregated gate verdicts.  
This week, 2: produce a self-contained package and smoke-test it from a clean consumer repository.  
This week, 3: fix routing/reporting references and remove mandatory pre-review publishing; defer re-platforming.