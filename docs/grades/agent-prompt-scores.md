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

## Rescore v2 — 2026-07-05, reviewer: rescore subagents 1–4 (Fable 5), graded post-pass-2 disk

Fleet mean ≈ 8.5 (baseline 8.2). Scores are descriptive of disk at grading
time; passes 3–4 fixed most cited gaps AFTER these grades (noted per row).
Caps: dev-lite, typescript-reviewer, architect-reviewer (fresh contradictions
found by deeper verification — all three fixed in passes 3–4).

| Agent | v1 | v2 | Δ | v2 headline gap → disposition |
|---|---|---|---|---|
| verifier | 8.0⚠ | **9.33** | +1.3 | FIRST-call contradiction fixed in pass 1 (cap lifted) |
| researcher | 8.3 | **9.3** | +1.0 | peer-dispatch section added pass 2; none material |
| reviewer-lite | 8.96 | **9.25** | +0.3 | none material |
| csharp-reviewer | 9.0 | **9.1** | +0.1 | twin boilerplate (governance) |
| reviewer | 8.0⚠ | **9.1** | +1.1 | contradiction fixed pass 2 (cap lifted); dup sentence :105-106 open |
| refactor | 9.2 | 9.1 | −0.1 | grader noise; dead-code rule ×3 (minor dup) open |
| investigator | 8.7 | **9.0** | +0.3 | none material |
| frontend-dev | 8.8 | **9.0** | +0.2 | UX-spec drift procedure softer than OpenAPI's (open, minor) |
| architect | 8.0 | **8.96** | +1.0 | 343/350 headroom (open); MUST-NOT dedup landed pass 2 |
| fullstack-dev | 8.5 | **8.9** | +0.4 | ~15-reads soft cap lacks escalation trigger (minor) |
| performance-engineer | 8.3 | **8.9** | +0.6 | dup skill row → fixed pass 4 |
| test-automator | 8.0 | **8.8** | +0.8 | maxMinutes deviation comment → fixed pass 4 |
| backend-dev | 8.8 | 8.75 | −0.1 | peer-list mixing fixed pass 2; maxLines override removed pass 3; inline EF-detail-vs-skill drift risk (open, governance) |
| aiplugin-dev | 8.9 | 8.7 | −0.2 | maxLines override removed pass 3 |
| cloud-architect | 6.5 | **8.1** | +1.6 | zero skill loads → fixed pass 4 (cloud-architecture skill wired + Bash read-only note); routing-table row gap open |
| release-engineer | 7.7 | **8.08** | +0.4 | maxLines override removed pass 3; no maxMinutes (open); dual-role breadth (needs-human, governance three-test) |
| typescript-reviewer | 9.0 | 8.0⚠ | −1.0 | REAL: ts-conventions path nonexistent + wrong node-ts-patterns path → both fixed pass 4 (cap lifts on regrade) |
| qa-expert | 7.9 | 7.9 | 0 | boilerplate share ~38% of file (governance extraction) |
| uxdesigner | 6.9 | **7.6** | +0.7 | top HARD contract added pass 3; boilerplate dup (governance) |
| integrator | 8.1 | 7.4⚠ | −0.7 | REAL: no tools field (ALL tools incl. Agent) + --run-title bug → both fixed pass 3 (cap lifts on regrade) |
| dev-lite | 8.85 | 7.2⚠ | −1.7 | REAL: Bash granted vs "No Bash available" LIMITS contradiction → fixed pass 3 (cap lifts on regrade) |
| document-writer | 7.0 | 7.2 | +0.2 | CLI prefix fixed pass 3; open: dup HARD contract, dup delegation lists, 0.0–1.0 confidence scale vs fleet h/m/l (needs-human), role breadth |

## Pass 4 — 2026-07-05, rescore fresh defects (fixed)

- typescript-reviewer 1.0.1: nonexistent `typescript/ts-conventions` → `typescript-pro` (absorbed 2026-06-21); `typescript/node-ts-patterns` → `backend/node-ts-patterns`.
- performance-engineer 1.2.1: duplicate react-engineering skill row merged.
- test-automator 2.3.1: maxMinutes 25 deviation now justified inline.
- cloud-architect 1.2.0: `skills/domain/infra/cloud-architecture/` wired as always-load; Bash scoped read-only.

## Open items (not chased — low-impact or governance)

- **Governance decisions**: peer-dispatch boilerplate → shared skill; stack-reviewer twin contract → shared skill; reviewer-verifier ghost (0c07e69); light-tier taxonomy unification (dev-lite vs reviewer-lite); document-writer confidence scale + role breadth; release-engineer dual-role vs three-test; platform-principles extraction (fullstack/frontend); backend-dev inline-EF-detail vs skill drift.
- **Minor open**: reviewer dup sentence; refactor dead-code rule ×3; architect 343/350 headroom; frontend-dev UX-drift procedure; fullstack-dev soft-cap trigger; release-engineer maxMinutes; cloud-architect routing-table row.

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
