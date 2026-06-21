---
id: FEAT-170
status: triaged
priority: P1
category: quality
target_release: null
created: 2026-06-21
depends_on: [FEAT-169]
slices: []
derived_from: null
pm_customer_impact: 0.8
pm_effort_estimate: 0.5
pm_strategic_alignment: 0.75
pm_technical_risk: 0.4
pm_dependency_depth: 0.2
composite_score: 0.69
autonomous_safe: false
tags: [agent-prompt, fullstack-dev, regression, eval-gated, routing]
triage_notes: "Derived 2026-06-21 from session diagnostic. fullstack-dev sits at 397/400 line cap (no headroom), undifferentiated routing (eats every default slice that does not classify SPLIT_BUILD), known bundle-truncation pattern (SLICE-79 bundle hit 3404 lines / 75k tokens / size-cap truncation). Original session ask was 'fullstack-dev not working fine'. FEAT-169 just shipped the eval framework — now use it to verify the fix objectively. Customer impact 0.8: broken default builder degrades every slice not split BE/FE. Effort 0.5: 4 slices, mostly prompt + routing + skill extraction, no new infrastructure. Risk 0.4: prompt-authorship work is autonomous_safe=false per FEAT-167 / model_pinned policy; routing changes affect dispatch classifier. Decomposition: SLICE-A diagnostic baseline with new fixtures + claude-p self-judge (free, subscription), SLICE-B prompt shrink + extract per-stack skill, SLICE-C routing fix (SPLIT_BUILD-only fullstack), SLICE-D label-gated CI regression gate using crew-fullstack-dev.yaml."
---

# FEAT-170: Fix fullstack-dev — shrink prompt + split routing + add eval regression gate

## Description

`agents/fullstack-dev.md` sits at 397 / 400 line cap (zero headroom) and is the default builder for every slice that does NOT classify as SPLIT_BUILD. Observed pain:

- SLICE-79 (FEAT-167) bundle hit 3404 lines / 75k tokens, truncated at size-cap. Handoff was lossy. Work succeeded (commit 2284ff4) but evidence trail damaged.
- Cap headroom = 3 lines means any future prompt evolution (added guidance, new skill route, identity-anchor refinement) requires an emergency shrink.
- Undifferentiated routing: backend-dev + frontend-dev fire only on `SPLIT_BUILD` classification; fullstack-dev eats every default slice. Means broken fullstack-dev affects every slice that's not BE-only or FE-only.
- The prompt loads both BE + FE skill sets unconditionally — heavier per-dispatch cost, more identity-bleed surface.

FEAT-169 just shipped the pluggable eval framework. Reference spec `evals/agents/crew-fullstack-dev.yaml` already targets fullstack-dev with 2 tests (`bundle-stays-under-size-cap`, `identity-anchor-holds`). This FEAT extends that spec to capture more failure modes, fixes the prompt, and promotes the eval to a label-gated CI regression gate.

## Acceptance hints

### Diagnostic targets (SLICE-A)

Add fixtures + assertions for:

1. **Bundle size cap** — agent dispatched on a fan-out task with 18+ files writes a handoff bundle ≤2000 lines and does not include `truncated: true` marker. Already in spec, refine with deeper assertions.
2. **Identity anchor under lead-leak** — dispatch prompt body contains `"you are the orchestrator"` / `"I am Claude Code"` / `"Let me re-read the instructions"` — fullstack-dev must NOT echo any of these in its handoff or output. Already in spec, add 2 more leak phrases.
3. **SPLIT_BUILD detection** — when dispatched on a slice that touches both `api/` and `src/components/` (BE + FE), fullstack-dev must NOT silently absorb the work; must surface the SPLIT signal via handoff `--risks` field for lead routing.
4. **Skill load count** — fullstack-dev must NOT load more than 4 skills per dispatch (current prompt has no cap, loads up to 8). Verify via grep against trace output.
5. **Cross-layer guard** — when slice scope explicitly forbids FE work, fullstack-dev's bundle must NOT include `*.tsx` or `*.css` writes.

### Prompt shrink targets (SLICE-B)

- Cap: 397 → ≤300 lines (97 line reduction, 25% shrink)
- Extract per-stack guidance to `skills/workflow/fullstack-cross-layer/SKILL.md` (loaded on demand, not unconditionally)
- Remove duplicated content already in `skills/domain/backend-advisory/` + `skills/domain/frontend-advisory/`
- Preserve identity-anchor block, peer dispatch whitelist, final-tool-call invariant
- Reduce skill consult cap from current to 3 (per FEAT-153 architect precedent)

### Routing fix (SLICE-C)

- Update SPLIT_BUILD classifier (`scripts/lib/slice-shape-classify/` or equivalent) to default-route to `backend-dev` for pure-TS-tooling slices when no FE surface detected
- `crew:fullstack-dev` reserved for genuinely cross-layer slices (touches both BE and FE within same slice)
- Document new routing rules in `docs/routing-table.md`
- Update CLAUDE.md routing guidance

### CI regression gate (SLICE-D)

- Promote `evals/agents/crew-fullstack-dev.yaml` to `.github/workflows/agent-eval-regression.yml`
- Label-gated `run-evals` (does not run by default on every PR)
- Advisory-first (does not block merge), promote to blocking after 2-week stability baseline
- Cross-references FEAT-169 SLICE-B4 (deferred until OAuth-in-CI viable) — this gate runs heuristic asserts only initially (no live judge), upgrade when OAuth-in-CI lands

### Components

- `evals/agents/crew-fullstack-dev.yaml` — extend with 5 new fixtures + assertions
- `evals/fixtures/fullstack-dev-*.{diff,txt,json}` — new fixture inputs (4-5 files)
- `docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` — SLICE-A diagnostic report
- `agents/fullstack-dev.md` — shrink to ≤300 lines
- `skills/workflow/fullstack-cross-layer/SKILL.md` — extracted guidance (new)
- `scripts/lib/slice-shape-classify/` — routing logic edit
- `docs/routing-table.md` — routing rules update
- `CLAUDE.md` — routing note refresh
- `.github/workflows/agent-eval-regression.yml` — CI workflow
- `tests/agent-prompt-content.test.ts` — extend line-cap assertion to enforce ≤300

### Design constraints

- **Eval-gated.** Every prompt edit in SLICE-B + SLICE-C must verify against the extended `crew-fullstack-dev.yaml` spec — diagnose first (SLICE-A), then change.
- **Subscription-billed judge.** Default judge = `claude-p` (FEAT-162). Free path. No API spend.
- **Backward routing compatibility.** Existing slices in flight must not break — SPLIT_BUILD classifier change is additive (new default, not removal of fullstack-dev for genuinely cross-layer cases).
- **No new npm dependencies.** Framework already complete.

### Per-slice decomposition

| Slice | Scope | autonomous_safe |
|---|---|---|
| **SLICE-A** (SLICE-92) | Extend crew-fullstack-dev.yaml with 5 new fixtures + assertions, run baseline eval with claude-p self-judge, write `docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` with metrics + identified failure modes. NO prompt edit. | Yes (read-only against prompt; only writes fixtures + docs) |
| **SLICE-B** (SLICE-93) | Shrink `agents/fullstack-dev.md` from 397 → ≤300 lines. Extract per-stack guidance to `skills/workflow/fullstack-cross-layer/SKILL.md`. Re-run eval, confirm regression-free + improvements. | No (prompt authorship per FEAT-167 model_pinned policy) |
| **SLICE-C** (SLICE-94) | Update SPLIT_BUILD classifier to default-route pure-TS-tooling slices to backend-dev. Update routing-table.md + CLAUDE.md. | No (routing surface affects all builders) |
| **SLICE-D** (SLICE-95) | Label-gated `.github/workflows/agent-eval-regression.yml`, heuristic-asserts-only initially. Extend `tests/agent-prompt-content.test.ts` to enforce ≤300 line cap. | No (CI workflow + cap enforcement) |

### Out of scope

- Live cloud-judge integration in CI (waits on FEAT-169 SLICE-B4 / OAuth-in-CI).
- Frontend-dev parallel fix (different FEAT — surface as FEAT-171 if observed).
- Architect / lead prompt shrink (separate FEATs only if line-cap pressure observed).
- Auto-mutation of prompts based on eval signal — read-only quality measurement.

## Notes

- Sister FEAT: 169 (eval framework, just shipped). This FEAT consumes the framework.
- Trigger: 2026-06-21 session diagnostic by user — "fullstack-dev not working fine" + line-count audit + bundle-truncation evidence.
- Memory pattern reused: `feedback_line_budgets_in_spec_frontmatter` (each slice declares per-file caps).
- Post-completion: re-baseline ALL 18 agents via similar pattern (new FEAT) once one full eval pipeline lands. Surfaces hidden problems beyond fullstack-dev.
