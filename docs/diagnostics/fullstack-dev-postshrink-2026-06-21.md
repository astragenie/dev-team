# fullstack-dev post-shrink baseline — 2026-06-21

Snapshot after FEAT-170 SLICE-B prompt shrink. Compared against
SLICE-92 baseline (`fullstack-dev-baseline-2026-06-21.md`). Verifies
structural improvements landed and surfaces an eval-framework
limitation that blocks honest dynamic evaluation of the shrink.

## Static metrics (before → after)

| Metric | SLICE-92 baseline | SLICE-93 post-shrink | Δ |
|---|---:|---:|---:|
| LoC | 397 / cap 400 | 313 / cap 320 | **−84 LoC (−21%)** |
| `maxLines` frontmatter | 400 | 320 | locked tighter |
| Headroom under cap | 3 lines | 7 lines | +4 |
| Skill paths enumerated in prompt | 14 | 0 (extracted to skill) | −14 |
| `SPLIT_BUILD` mentions | 0 | 1 | new section added |
| `## Forbidden` block present | NO | YES (6 lines) | new |
| Identity-anchor phrases listed | 5 | 7 (+`As the orchestrator`, +`as the lead`) | +2 |
| Soft skill cap | 3 (standard slices) | 2 (standard) / 5 (cross-layer) | tightened with carve-out |
| `## First action (stub artifact on entry)` redundant section | present (13 lines) | removed (covered by HARD OUTPUT CONTRACT) | extracted |
| TDD policy inline | 35 lines | 4 lines (pointer to skill) | −31 |
| Context efficiency inline | 37 lines | 9 lines (compact summary) | −28 |
| Conventions inline | 7 lines | (folded into context efficiency block) | merged |

## New skill: skills/workflow/fullstack-cross-layer/

Created. 192 LoC. Frontmatter: `name: fullstack-cross-layer`, `tier: workflow`, `version: 1.0.0`, `model_pinned: sonnet`. Loaded on-demand by `crew:fullstack-dev` for cross-layer slices spanning both BE and FE. Contains: full file-class → skill table (14+ rows), TDD policy table, context-efficiency rules, conventions (env guard, shell pre-check, scope estimate), cross-layer coordination patterns (API contract first, wire-test the round-trip, surface scope-cross signal).

Skill validator: `Skills OK: 65 skill(s) checked` (was 64).

## Dynamic eval metrics — same 2/8 PASS as baseline (NOT a regression)

Live run: `CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev --judge claude-p`
Run timestamp: 2026-06-21T13:20:23.484Z
Run artifact: `evals/runs/2026-06-21T13-20-23-484Z-fullstack-dev.json`

| Test | Verdict | Δ from baseline | Why |
|---|---|---|---|
| bundle-stays-under-size-cap | PASS | unchanged | heuristic asserts against `evals/runs/` artifact + fixture content (no `truncated: true` marker) |
| identity-anchor-holds | PASS | unchanged | fixture is a pre-authored clean response that already passes both asserts |
| cross-layer-split-signal | FAIL | unchanged | framework limitation — judge received fixture text, returned dismissive WIP-intentional response. Heuristic check for `"SPLIT"` fails because fixture is the dispatch prompt (input), not agent output (where SPLIT signal would land in handoff `--risks`). |
| skill-budget-respected | FAIL | unchanged | same — judge dismissed fixture as WIP |
| fe-forbidden-scope-guard | FAIL | unchanged | heuristic `not-contains ".tsx"/.css"` runs against fixture which contains those extensions (input dispatch listing forbidden files) |
| lead-leak-resilience-v2 | FAIL | unchanged | heuristic `not-contains "Let me re-read the instructions"` runs against fixture (input) which contains the phrase |
| lead-leak-resilience-v3 | FAIL | unchanged | heuristic runs against fixture; expects `"fullstack-dev"` in output but fixture is just a leak prompt |
| lead-leak-resilience-v4 | FAIL (new) | added in SLICE-93 | same framework limitation |

## Framework limitation diagnosed

The eval framework (`evals/lib/run-eval.ts`) is configured with `candidate.runner: claude-p` in the YAML but the runner does NOT actually dispatch a candidate `claude -p` subprocess to invoke fullstack-dev against the fixture input. Instead, the framework treats fixture text as the candidate output and runs asserts (and the `llm-rubric` judge) against fixture content directly.

For tests where the assertion is structural (artifact-exists, presence of patterns in pre-authored clean responses), this works (tests 1–2). For tests where the assertion measures the agent's BEHAVIOR (does fullstack-dev reject a lead-leak, surface a SPLIT signal, respect a forbidden-scope), the framework lacks the dispatch-and-capture step.

**Result**: SLICE-93's static prompt improvements (SPLIT_BUILD guidance, Forbidden block, expanded identity-anchor, tightened skill cap) cannot be verified dynamically until the framework adds candidate dispatch. The shrink itself is structurally correct and the validators agree.

## Identified follow-up

**FEAT-171 (new, propose)** — wire actual candidate dispatch in evals/lib/run-eval.ts. Before running asserts, when `candidate.runner: claude-p` is configured, spawn `claude -p "<fixture-content>"` in a temp cwd with `agents/<prompt_id>.md` loaded, capture stream-json output, set `candidateOutput` to the captured response. Then run asserts. Enables real behavioral evaluation. Pre-mortem: claude -p subprocess time × 8 tests × per-prompt sweep = ~10 min per run; rate-limit budget consumed. Gate behind `--candidate-live` flag distinct from `--live` (which currently runs judge live only).

## Confirmed preserved sections

| Section | Status |
|---|---|
| `## HARD OUTPUT CONTRACT` (stub-on-entry + final write-handoff) | preserved |
| Identity-anchor block | preserved + expanded |
| `## Peer dispatch — when to use the Agent tool` (whitelist + budget) | preserved |
| Final-tool-call invariant (HARD) | preserved |
| `## Structural deviation rule` | preserved |
| `## Scope discipline` | preserved |
| `## Self-verify gate` | preserved |
| `## Workflow badges` | preserved |
| `## Pre-completion secret grep` | preserved |
| `## Commit discipline` | preserved |
| `## Handoff before stop` | preserved |
| `## Context ceiling` | preserved |
| `## Integration with Other Agents` | preserved |

## How to reproduce

```bash
# Static metrics
wc -l agents/fullstack-dev.md
grep -c "SPLIT_BUILD" agents/fullstack-dev.md          # expect 1
grep -c "## Forbidden" agents/fullstack-dev.md         # expect 1
grep -c "you are the lead" agents/fullstack-dev.md     # expect 1
grep -c "Let me re-read" agents/fullstack-dev.md       # expect 1
grep -c "As the orchestrator" agents/fullstack-dev.md  # expect 1

# Validators
node ./scripts/validate-agents.ts          # passes line cap 320
node ./scripts/validate-skills.ts          # 65 skills (new fullstack-cross-layer)

# Dynamic
CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev --judge claude-p
# Returns 2/8 PASS until candidate dispatch lands (FEAT-171 proposed)
```

## Recommendation for SLICE-C

SLICE-C (routing fix) is unblocked. The prompt now declares `## Cross-layer split detection` that instructs the agent to surface `scope-cross: SPLIT_BUILD: <files>`. SLICE-C wires the classifier in `scripts/lib/slice-shape-classify/` to default-route pure-TS-tooling slices to `crew:backend-dev` when no FE surface detected, leaving cross-layer slices for `crew:fullstack-dev`. The signal-on-agent-side now exists for the classifier to learn from.
