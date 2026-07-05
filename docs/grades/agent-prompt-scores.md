# Agent prompt benchmark — audit log

Grading per `docs/prompts/agent-prompt-optimization.md`. Scores are
descriptive, not targets. Rubric categories (weight): role clarity (2),
scope boundaries (2), safety (2), determinism (1.5), evidence (1.5),
duplication (1), skill/infra parity (1), realism (1). Overall = weighted
mean. Internal contradiction caps overall at 8. Keep superseded rows —
this file is the history.

## Baseline — 2026-07-05, reviewer: grader subagents 1–4 (Fable 5), fleet mean ≈ 8.2

Sorted ascending = attack order.

| Agent | Ver | role | scope | safety | det | evid | dup | parity | real | **Overall** | Top gaps (terse) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cloud-architect | 1.0.0 | 8 | 5 | 6 | 8 | 7 | 8 | 4 | 6 | **6.5** | no Write boundary despite Edit/Write tools; no write-handoff report contract (invisible to brief-me); thin budget (20 turns, no maxMinutes/maxLines) |
| uxdesigner | 1.0.0 | 8 | 8 | 6 | 7 | 6 | 5 | 7 | 7 | **6.9** | stale-ref "(dispatcher role removed)" :193; Edit/Write without Write-boundary section (architect.md has model); dispatch-purity block duplicated verbatim with architect.md |
| document-writer | 1.0.0 | 7.5 | 8 | 8.5 | 6 | 9 | 6 | 5 | 3 | **7.0** | no `capabilities:` frontmatter at all (breaks routing parity); zero budget fields; stale-ref :175 |
| release-engineer | 1.3.0 | 6.5 | 8 | 9 | 8.5 | 9 | 5 | 8 | 6.5 | **7.7** | stale-ref :276; stub CLI relative + no --repo :47 vs canonical elsewhere; dual role + very broad owned-scope; maxLines 380 > 350 default (verify override honored) |
| architect-reviewer | 1.0.0 | 9 | 7.5 | 6.5 | 9.5 | 9 | 7 | 5 | 8 | **7.8** | no stub-on-entry (FEAT-161 risk siblings fixed); zero skill loads (restates architecture-advisory rules inline); no mis-dispatch refusal path |
| qa-expert | 1.0.0 | 8.5 | 8 | 6.5 | 8.5 | 8.5 | 7 | 8 | 8 | **7.9** | stale-ref :95; peer-dispatch boilerplate duplicated fleet-wide; no single FORBIDDEN-scope statement |
| reviewer | 1.0.0 | 9 | 8 | 6 | 9 | 10 | 8 | 8 | 8 | **8.0** ⚠capped | CONTRADICTION: prose "read-only unless dispatch overrides" :80 vs disallowedTools :18 (override impossible); no explicit never-commit/tag/push despite full Bash; maxLines 360 no justification |
| verifier | 1.0.0 | 9 | 9.5 | 9 | 9.5 | 9 | 3.5 | 8 | 7.5 | **8.0** ⚠capped | CONTRADICTION: two competing "FIRST tool call" mandates with different flags (:75-79 vs :93-97); relative CLI + undefined `$REPO` :78; else best-in-class determinism |
| test-automator | 2.2.0 | 9 | 9 | 8 | 9 | 9 | 6 | 6 | 8 | **8.0** | stale `--to lead` :130 + "Flag to lead" :84 (fleet uses dispatcher); no builder-ceremony/self-verify-gate skill loads (reinvents checklist inline); no mark-badge mechanism |
| architect | 1.0.0 | 8.5 | 9.5 | 9 | 9 | 8.5 | 4.5 | 5.5 | 6 | **8.0** | MUST-NOT-dispatch stated twice (:135 vs :302-318, drift risk); 344/350 lines, zero headroom, no maxLines override; dispatch-purity boilerplate duplicated with uxdesigner |
| integrator | 1.0.0 | 9 | 8.5 | 7 | 9 | 8.5 | 7.5 | 7 | 7.5 | **8.1** | stub CLI relative, no ${CLAUDE_PLUGIN_ROOT}/--repo :51 vs canonical :124-125; no maxMinutes despite boots-live-processes hang risk; contract boilerplate duplicates reviewer.md |
| performance-engineer | 1.2.0 | 9 | 8 | 8 | 9 | 10 | 8 | 6 | 8 | **8.3** | stale ref `reviewer-verifier` :137 (agent doesn't exist post-v0.49 rename; also in dispatcher-routing SKILL.md:41); Integration vs Peer-dispatch sections overlap |
| researcher | 1.0.0 | 10 | 9 | 6 | 9 | 10 | 8 | 6 | 8 | **8.3** | has Agent tool but NO ## Peer dispatch section (FEAT-163 hard-rule gap, discusses delegating at :180); no maxMinutes |
| fullstack-dev | 2.1.1 | 9 | 9.5 | 8.5 | 8 | 7.5 | 6 | 9 | 10 | **8.5** | platform-principles block restates engineering-standards inline :54-81 (skill already routed :142); "no hard cap, stay focused" vibes :115; dispatch-purity duplicated |
| investigator | 1.0.0 | 10 | 9.5 | 7 | 9 | 8.5 | 9 | 7 | 9 | **8.7** | Bash restricted by prose only, no disallowedTools enforcement :18,65 |
| frontend-dev | 2.1.1 | 9 | 9.5 | 8.5 | 9 | 8 | 7 | 9 | 10 | **8.8** | platform-pattern triggers duplicate fullstack-dev's block :52-60 (share via skill); dispatch-purity duplicated |
| backend-dev | 2.4.1 | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | **8.8** | peer MAY-list mixes Agent-tool targets with skill/indirect items :261-262 |
| dev-lite | 1.3.0 | 9.5 | 10 | 9 | 9.5 | 8 | 8.5 | 6 | 8.5 | **8.85** | no reuse-first mandate; no maxMinutes (minor at tiny scope) |
| aiplugin-dev | 1.2.1 | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | **8.9** | missing `evals:` frontmatter (sibling parity); confirm no-backlog-IDs validator carve-out intentional |
| reviewer-lite | 1.1.0 | 9.5 | 9.5 | 9 | 9.5 | 8.5 | 7.5 | 8.5 | 8.5 | **8.96** | light-tier trigger list drifts vs dev-lite's PRECHECK (same boundary defined twice); maxLines 140 vs 120 undocumented |
| csharp-reviewer | 1.0.0 | 10 | 9 | 9 | 10 | 9 | 7 | 7 | 9 | **9.0** | contract+boundaries boilerplate duplicated verbatim with typescript-reviewer; Agent tool without Peer-dispatch section (fleet-wide) |
| typescript-reviewer | 1.0.0 | 10 | 9 | 9 | 10 | 9 | 7 | 7 | 9 | **9.0** | twin of csharp-reviewer, same duplication + Peer-dispatch-section gaps |
| refactor | 3.0.0 | 10 | 10 | 10 | 10 | 9 | 9 | 9 | 6 | **9.2** | maxTurns 30, no maxMinutes, no rationale vs fleet baseline; "~90% confidence" trigger is soft |

## Pass 1 — 2026-07-05, cross-fleet mechanical reds (fixed)

- Systemic #1 stale-ref "(dispatcher role removed)" removed from qa-expert 1.0.1, document-writer 1.0.1, uxdesigner 1.0.1, release-engineer 1.3.1.
- Systemic #2 CLI canonicalized (`${CLAUDE_PLUGIN_ROOT}` + `--repo "$PWD"`): integrator 1.0.1 stub, release-engineer 1.3.1 stub, verifier 1.0.1 (also resolved verifier's dual FIRST-call contradiction — HARD OUTPUT CONTRACT now sole owner of the scaffold command; verifier's ⚠cap lifts on regrade).
- Systemic #4 reviewer-verifier: escalated needs-human (see below), NOT swept.
- validate-agents: PASS fleet-wide after pass.

## Cross-fleet systemic findings (fix once, propagate)

1. **stale-ref "(dispatcher role removed),"** — qa-expert:95, document-writer:175, release-engineer:276, uxdesigner:193 (architect + refactor + performance-engineer already cleaned). One search-replace pass.
2. **CLI style split** — stub-on-entry calls use relative `node scripts/crew.ts` without `--repo` in integrator:51, release-engineer:47, verifier:78 (verifier also uses undefined `$REPO`). Canonical: `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" ... --repo "$PWD"`.
3. **Peer-dispatch boilerplate** (dispatch purity + final-tool-call invariant, ~20 lines) duplicated near-verbatim across ≥8 agents — extract to shared skill (governance decision: which skill owns it).
4. **`reviewer-verifier` ghost** — named in 9 agent files + skills/workflow/dispatcher-routing/SKILL.md but no such agent exists. **needs-human**: commit 0c07e69 (v0.49 rename) deliberately mapped `inspector-verifier` refs → `reviewer-verifier` per "approved open question 3" — either a future combined agent is planned (keep refs) or the intent was reviewer-lite (sweep + fix dispatcher-routing's "combined review+validate" row, which reviewer-lite does NOT satisfy). Governance decision, not mechanical.
5. **Agent tool granted without `## Peer dispatch` section** — researcher (worst: discusses delegating), csharp-reviewer, typescript-reviewer.
6. **Budget-field inconsistency** — document-writer has none; integrator/researcher/refactor/dev-lite lack maxMinutes; release-engineer 380 + reviewer 360 exceed 350 default without inline justification.
7. **Light-tier trigger taxonomy** defined independently in dev-lite + reviewer-lite — already drifting.
8. **Platform-principles content** duplicated across fullstack-dev + frontend-dev instead of `skills/universal/engineering-standards/`.
