---
id: SLICE-190
parent: FEAT-189
status: triaged
priority: P1
created: 2026-07-04
title: "FEAT-189 S1 — verifier eval spec + 5 fixtures (critical-allowlist agent, n=0 today)"
stack: yaml + markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - evals/agents/crew-verifier.yaml
  - evals/fixtures/verifier-false-pass.txt
  - evals/fixtures/verifier-false-fail.txt
  - evals/fixtures/verifier-missing-evidence.txt
  - evals/fixtures/verifier-allowlist-misclass.txt
  - evals/fixtures/verifier-held-out.txt
  - agents/verifier.md
---

# SLICE-190: verifier eval spec (FEAT-189 S1)

## Scope

Author `evals/agents/crew-verifier.yaml` following `evals/agents/crew-fullstack-dev.yaml`
precedent. Flip `agents/verifier.md` frontmatter `evals: planned:evals/agents/verifier.yaml`
→ `evals: evals/agents/verifier.yaml` (single line; note precedent files are named
`crew-<agent>.yaml` — match whichever pattern `validate-agents.ts` resolves, verify by
reading the validator). ≥5 hand-seeded fixtures, ≥1 `held_out: true`.

## Acceptance criteria

- AC-1: `evals/agents/crew-verifier.yaml` exists with `candidate` (claude-p / claude-sonnet-4-6 / subscription:true), `judge` (groq primary + gemini fallback), `validate_with` (gemini), and `budget.daily_cap_usd` blocks.
- AC-2: ≥5 fixtures, each covering a distinct verifier failure mode — false-PASS on a failing scenario, false-FAIL on a passing scenario, missing evidence citation, critical-allowlist misclassification — each asserted via `llm-rubric`.
- AC-3: `node ./scripts/validate-agents.ts` no longer emits the planned-eval warning for `verifier`.
- AC-4: `bun run evals --dry-run --prompt verifier` executes clean, no schema errors.

## Notes
- Verifier scores OTHER agents' output → each fixture is a fake builder handoff + the ask "produce a verdict". Do not conflate the verifier's meta-rubric with the underlying inspector rubric (design concern C1 — no scorer circularity).
- Live judge run deferred (needs operator GROQ_API_KEY + GEMINI key). Dry-run only for this slice.
