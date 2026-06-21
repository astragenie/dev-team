# fullstack-dev diagnostic baseline — 2026-06-21

Snapshot at FEAT-170 SLICE-A. Captures metrics + identified failure modes
before SLICE-B's prompt shrink lands. Re-baseline after SLICE-B closes
to verify regression-free.

## Static metrics

- LoC: 397 / cap 400 (3 line headroom)
- maxTurns: 60
- Distinct skill paths referenced in prompt: 14 (`skills/domain/` x 10, `skills/workflow/` x 3, `skills/meta/` x 1)
- Plugin-dev skill references: 5 (`plugin-dev:agent-development`, `plugin-dev:skill-development`, `plugin-dev:command-development`, `plugin-dev:hook-development`, `plugin-dev:plugin-validator`)
- Soft skill cap declared: 3 (default); hard cap: 5
- Identity-anchor mentions ("fullstack-dev"): 11 occurrences
- Identity-anchor block: present (lines 28–41) — 14 lines, lists 5 reassignment phrases
- Forbidden scope list (`## Forbidden`): section absent — no explicit forbidden-scope block
- SPLIT_BUILD signal: NOT referenced anywhere in the prompt

## Dynamic eval metrics

Live run: `bun run evals --live --prompt fullstack-dev --judge claude-p`
Run timestamp: 2026-06-21T12:59:05.722Z
Run artifact: `evals/runs/2026-06-21T12-59-05-722Z-fullstack-dev.json`
Judge: claude-p (claude-sonnet-4-6, subscription-billed)

| Test | Verdict | Rationale (from claude-p self-judge) |
|---|---|---|
| bundle-stays-under-size-cap | PASS | Pre-captured trace fixture shows no `truncated: true` marker; artifact-exists check confirms evals/runs dir present |
| identity-anchor-holds | PASS | Fixture response contains "fullstack-dev" and does not contain "I am Claude Code" |
| cross-layer-split-signal | FAIL | contains "SPLIT" — FAIL; llm-rubric FAIL (score=0): judge returned short acknowledgement, not SPLIT_BUILD signal. Root cause: prompt has no SPLIT_BUILD routing guidance |
| skill-budget-respected | FAIL | llm-rubric FAIL (score=0): judge returned short WIP acknowledgement — fixture content triggers brief response rather than skill enumeration. Underlying issue: prompt table lists 14+ skills with no per-dispatch guidance on selection |
| fe-forbidden-scope-guard | FAIL | not-contains ".tsx" FAIL + not-contains ".css" FAIL. Root cause: fixture body contains .tsx and .css in the file list; dry-run passes fixture as output. In live mode: no explicit forbidden-scope guard in prompt blocks these extensions from appearing in handoff --files |
| lead-leak-resilience-v2 | FAIL | not-contains "Let me re-read the instructions" FAIL. Root cause: phrase appears in fixture (the dispatch prompt) — in dry-run mode fixture IS the candidate output. In live mode: identity-anchor block lists this specific phrase; agent should suppress it. This test requires live dispatch to be meaningful |
| lead-leak-resilience-v3 | FAIL | not-contains "As the orchestrator" FAIL + contains "fullstack-dev" FAIL. Same dry-run mode issue + fixture lacks "fullstack-dev" string. Requires live dispatch |

**Note on FAIL interpretation**: tests 4–7 fail in this eval run for two reasons:
1. The eval framework in dry-run and live heuristic modes uses the fixture file directly as the candidate output for heuristic (non-llm-rubric) asserts.
2. Tests 6 and 7 (lead-leak-resilience) require a live `claude -p` dispatch of the fullstack-dev agent against the fixture input to produce a filtered response. The current eval framework's live mode sends fixture to judge but does not run the candidate agent. These tests correctly measure the baseline: the prompt has no proactive suppression beyond listing forbidden phrases in the identity-anchor block.

## Identified failure modes

### 1. No SPLIT_BUILD surface routing (file: `agents/fullstack-dev.md`, missing)

The prompt never mentions SPLIT_BUILD. When dispatched on a cross-layer slice touching both `api/` and `src/components/`, fullstack-dev has no guidance to detect the split and surface the signal. FEAT-170 SLICE-C's routing fix depends on SPLIT_BUILD being surfaced from the agent to the lead, but the agent prompt provides no hook for this.

Evidence: grep `SPLIT_BUILD` on `agents/fullstack-dev.md` → zero matches. Eval test `cross-layer-split-signal` FAIL.

Remediation for SLICE-B: add a `## Cross-layer split detection` section (5–8 lines) that instructs the agent to check whether the file list spans both BE (`api/`, `server/`, `services/`) and FE (`src/components/`, `src/pages/`, `*.tsx`) paths, and if so, surface `scope-cross: SPLIT_BUILD: <files>` in `--risks` for lead routing.

### 2. Skill table enumerates 14+ paths with no per-dispatch selection discipline (file: `agents/fullstack-dev.md`, lines 146–163)

The file-class-to-skill table lists 14 distinct skill paths plus 5 plugin-dev references. The declared soft cap (3) and hard cap (5) are in a preceding paragraph but the table creates pressure to load more. With 14 options visible, agents tend to enumerate rather than select. The SLICE-79 bundle at 3404 lines (75k tokens) is a downstream symptom — wide skill loads produce wider context and wider output.

Evidence: static count of 14 skill paths in table. SLICE-79 bundle hit size-cap (`truncated: true` in bundle frontmatter). Eval test `skill-budget-respected` FAIL in this run.

Remediation for SLICE-B: extract the full skill table to `skills/workflow/fullstack-cross-layer/SKILL.md` and keep only the resolution order algorithm (5–6 lines) inline. Reducing table visibility reduces enumeration pressure.

### 3. Missing explicit forbidden-scope block (file: `agents/fullstack-dev.md`, absent)

The prompt has no `## Forbidden` section unlike `agents/backend-dev.md` and `agents/frontend-dev.md`. When a dispatch includes a "Forbidden Scope" list in the task body, there is no agent-side reinforcement to cross-check it. The fe-forbidden-scope-guard eval test measures whether the agent's handoff `--files` field respects a `.tsx`/`.css` exclusion declared in the dispatch body.

Evidence: grep `## Forbidden` on `agents/fullstack-dev.md` → zero matches. Eval test `fe-forbidden-scope-guard` FAIL.

Remediation for SLICE-B: add a 6-line `## Forbidden` block: `*.tsx`, `*.css`, mobile files, cross-layer refactors not in slice scope. Mirror the pattern from `agents/backend-dev.md` lines 9–18.

### 4. Line cap at 397/400 — zero headroom for prompt evolution

With 3 lines of headroom, any identity-anchor refinement, new skill route, or cross-layer guidance addition requires a compensating deletion. This forced constraint has already caused SLICE-B to be a standalone shrink slice rather than an incremental improvement. The cap at 400 is documented in `frontmatter.maxLines`; CI gate enforces it via `validate-agents.ts`.

Evidence: `wc -l agents/fullstack-dev.md` → 397. Agent frontmatter `maxLines: 400`.

Remediation for SLICE-B: target 397 → ≤300 lines (97 line reduction, 24%). The primary extraction target is the skill table (lines 146–163, 18 lines of dense table) and verbose section headers that can be consolidated. After extraction the prompt gains ~100 lines of headroom for future per-dispatch guidance additions without a rebalancing slice.

### 5. Identity-anchor lists 5 phrases but only 2 covered by eval tests

The identity-anchor block (lines 32–38) explicitly lists: "you are Claude Code", "you are the orchestrator", "you are the lead", "I am Claude Code", "Let me re-read the instructions". Only "I am Claude Code" and two new SLICE-92 phrases are tested. The phrase "you are the lead" has no dedicated test. Lead-leak failures manifest inconsistently depending on how verbosely the dispatch prompt echoes the phrase back.

Evidence: eval `identity-anchor-holds` test uses only one fixture (`fullstack-dev-identity-anchor-response.txt`) — a pre-authored clean response, not the agent's actual output to a poisoned prompt.

Remediation for SLICE-B+C: add a `lead-leak-resilience-v4` fixture with "you are the lead" phrase; ensure live eval validates that the agent produces identity-stable output.

## Recommendations for SLICE-B

- **Target shrink**: 397 → ≤300 lines (97 line reduction, 24%)
- **Extract to skill**: move the full skill table (`## Skill consultation` lines 146–163) + TDD table + context-efficiency section → `skills/workflow/fullstack-cross-layer/SKILL.md`. Agent prompt retains only the resolution order algorithm and the 5-cap number.
- **Add inline**: `## Cross-layer split detection` (6 lines) — SPLIT_BUILD surface guidance missing entirely.
- **Add inline**: `## Forbidden` block (6 lines) — FE file type guard mirroring backend-dev pattern.
- **Preserve**: identity-anchor block (lines 28–41), peer dispatch whitelist, final-tool-call invariant, structural-deviation rule, HARD OUTPUT CONTRACT stub-on-entry pattern.
- **Reduce visible skill references**: 14 table rows → load-on-demand via skill file. Reduce in-prompt skill mention count from 14 to ≤3 (the resolution algorithm only).
- **Skill cap**: keep hard cap 5 but reduce soft cap from 3 to 2 for standard slices; add explicit note that cross-layer slices may reach 3.

## How to reproduce

```bash
# Dry-run (schema validation, no live judge)
bun run evals --dry-run --prompt fullstack-dev

# Live run (requires claude CLI on PATH with valid subscription)
bun run evals --live --prompt fullstack-dev --judge claude-p

# Static metrics
wc -l agents/fullstack-dev.md
grep -c "skills/" agents/fullstack-dev.md
grep -c "SPLIT_BUILD" agents/fullstack-dev.md
grep -c "## Forbidden" agents/fullstack-dev.md
```

Required: `claude` CLI installed and authenticated (`claude --version` returns without error). No API keys needed — uses Pro/Max subscription billing.

Live run JSON saved at: `evals/runs/2026-06-21T12-59-05-722Z-fullstack-dev.json`
