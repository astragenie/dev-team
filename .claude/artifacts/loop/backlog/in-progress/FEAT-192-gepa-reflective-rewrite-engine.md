---
id: FEAT-192
status: in-progress
priority: P1
category: capability
target_release: null
created: 2026-07-05
depends_on: [FEAT-183]
slices: [SLICE-A, SLICE-B, SLICE-C, SLICE-D]
derived_from: docs/superpowers/plans/2026-07-05-gepa-reflective-rewrite-engine-plan.md
pm_customer_impact: 0.75
pm_effort_estimate: 0.38
pm_strategic_alignment: 0.85
pm_technical_risk: 0.65
pm_dependency_depth: 0.25
composite_score: 0.66
autonomous_safe: false
tags: [gepa, agents, prompt-optimization, candidate-generator, llm-dispatch, aiplugin-dev, in-repo]
triage_notes: |
  Derived 2026-07-05 from docs/superpowers/plans/2026-07-05-gepa-reflective-rewrite-engine-plan.md.
  This is the deferred "brain" FEAT-183 scaffolded but did not build: synthesizeCandidate()
  (scripts/lib/gepa/candidate-generator-aiplugin.ts:73) appends a `<!-- GEPA candidate mutation -->`
  marker and never rewrites the prompt or calls an LLM; GEPA_LIVE_GENERATOR is a comment (line 20),
  never wired. Consequence, confirmed at gepa-optimize-cmd.ts:206: every optimize cycle returns
  no_winner. Fix: dispatchRewriter() reuses the claude -p stream-json primitives from
  evals/lib/candidate-dispatch.ts to dispatch aiplugin-dev with champion + failing trials + judge
  rationale, gated behind GEPA_LIVE_GENERATOR=1, falling back to the existing stub when off
  ($0 dry mode preserved).
  Calibrated against FEAT-183 (.85/.85/.85/.65/.30 -> 0.65, the plumbing epic this completes)
  and FEAT-191 (.60/.25/.65/.60/.20 -> 0.62). customer_impact 0.75 (below FEAT-183's 0.85: closes
  the loop FEAT-183 opened, conditional on that plumbing being live, not new capability surface).
  effort_estimate 0.30 (~2 dev-days / 3 slices, in-repo, no cross-repo publish; architect review
  nets ~unchanged: -0.5d dropped module extraction offset by +winner-gate +identity-check work).
  strategic_alignment 0.85 (matches FEAT-183 -- the GEPA centerpiece's payoff; without this GEPA
  ships zero prompt improvements). technical_risk 0.65 (banded 0.6-0.8: non-deterministic
  LLM-driven mutation entering an auto-PR pipeline + cross-module reach; not 0.9+ because
  aiplugin-dev is NOT on the FEAT-183 critical-agent allowlist and validateCandidateSize
  pre-screens before budget spend). dependency_depth 0.25 (single hard dep FEAT-183 done; AC-3's
  live-eval fixture crew-aiplugin-dev.yaml already exists).
  Overlap check: none. FEAT-183 deferred "aiplugin-dev EVALUATION" (v2+) but this FEAT does not
  add aiplugin-dev to the GEPA-evaluated set -- it uses aiplugin-dev only as the rewriter dispatch
  target, its existing role in candidate-generator-aiplugin.ts.
  autonomous_safe=false: dispatches an LLM to autonomously rewrite agent prompt content feeding an
  auto-PR pipeline; the guardrail-rejection logic (identity-anchor preservation, size cap, no-op
  rejection) is correctness-critical safety code -- same human-review class as FEAT-183/184/185.
  Architect review (crew:architect-reviewer, 2026-07-05) -- 4 HIGH folded into plan v2 + ACs:
  (1) module-boundary MISDIAGNOSED -- the no-scripts/-import rule is one-directional (evals/lib/**
  only); scripts/ MAY import candidate-dispatch.ts -> dropped the extraction work, export
  runSubprocess+parseStreamJson primitives + build a separate rewrite wrapper (dispatchCandidate()
  bakes an eval-only prompt, unusable). (2) determineWinner picks rank1[0] from a GLOBAL Pareto
  over all candidate*case trials -> a candidate can win one case + bomb another; AC-3's
  no-regression is NOT enforced -> added a per-candidate all-case promotion gate. (3) identity
  "check" was undefined (validateCandidateSize = lines only) -> AC-5 now specifies a structural
  assertion. (4) response-format contract missing (parseStreamJson returns raw text) -> AC-7 defines
  the extraction protocol. MEDs folded: wire idle split-train-heldout.ts; drop "varied temperature"
  (claude -p has no temp knob) for varied framing; re-validate GENERATOR_ESTIMATE_USD; thread FULL
  rationale not 120-char truncation.
  Pre-mortem (mandatory: technical_risk >= 0.6 AND P1):
  (1) likely failure = dispatchRewriter overfits the single seeded AC-3 failing trial -- trims
  content indiscriminately, passes the line-cap check while degrading identity-anchor in a way the
  narrow 3-fixture eval misses. Mitigated by the per-candidate all-case gate + structural
  identity check.
  (2) rollback reality = flag-gated path reverts cleanly (GEPA_LIVE_GENERATOR=0 restores the stub,
  no migration) BUT an already-merged auto-PR against a non-critical agent needs a manual prompt
  revert + that agent's eval re-run -- not a clean single git revert once downstream dispatches
  used the mutated prompt.
  (3) coverage gap = a whitespace/comment-only "no-op" diff could pass structural checks as a false
  win -- AC-2 non-trivial-diff + no-op rejection closes part; full semantic coverage is v2.
  Observability watch-item (SLICE-87 observability 0.78, n=1): AC-6 adds a structured
  gepa_rewriter_dispatch event per dispatch.
  Slicing review (architect + pm, 2026-07-05): order A->B->C->D confirmed strictly
  sequential. HIDDEN PREREQUISITE found — no judge-backed Scorer exists in
  scripts/lib/gepa (gepa-optimize-cmd.ts wires noopScorer() + no cases); AC-3 cannot be
  proven through the real CLI without one. Split into a new SLICE-C (Scorer adapter +
  split-heldout wiring, moved out of SLICE-B where it had no caller). Effort 0.30->0.38,
  composite 0.68->0.66, ~2.25->3.25 dev-days. Highest-risk hunk = the per-candidate
  all-case gate in optimize-runner::determineWinner (shared by every agent's optimize
  cycle). Build order across backlog: FEAT-192 -> memory-keeper -> FEAT-190 (P2).
---

# FEAT-192: GEPA reflective-rewrite engine (the real candidate generator)

## Context

All GEPA plumbing (capture, eval, Pareto, soak, promotion PR, BudgetMeter,
LockManager, validateCandidateSize) is real and shipped (FEAT-183). The candidate
generator is the one stub: `synthesizeCandidate` appends a comment marker and calls
no LLM, so every `gepa-optimize` cycle returns `no_winner` and GEPA produces zero
recommended prompt changes. This FEAT builds the reflective rewriter — Option 1 of
the 4-options analysis, with Option 2 guardrails. Full design + architect-review
revisions: `docs/superpowers/plans/2026-07-05-gepa-reflective-rewrite-engine-plan.md`.

## Goal

Replace the stub with `dispatchRewriter`: dispatch aiplugin-dev via `claude -p`
($0 API, subscription) with champion prompt + failing trials + full judge rationales
→ genuinely-improved candidate prompts. Implements the existing
`CandidateGenerator.generate()` interface; Pareto/soak/promotion consume the result
unchanged. Add the missing per-candidate no-regression gate + a structural
identity-anchor guardrail so promotion is honest.

## Acceptance criteria

- **AC-1 (flag wired):** Given `GEPA_LIVE_GENERATOR` unset or `"0"`, When
  `generate()` is invoked, Then it routes to `synthesizeCandidate` (deterministic,
  $0, unchanged). Given `GEPA_LIVE_GENERATOR=1`, Then it routes to `dispatchRewriter`
  with no other call-site change in `optimize-runner.ts`.

- **AC-2 (real rewrite, non-trivial, not a marker):** Given a champion +
  ≥1 `Trial` with a non-empty `score.rationale`, When `dispatchRewriter` produces a
  candidate, Then the candidate differs from the champion by a **non-trivial content
  edit** (> whitespace/comment-only; enforced by a min changed-line threshold) that is
  NOT the `<!-- GEPA candidate mutation -->` appendage, AND passes
  `validateCandidateSize(≤350)`. An empty / whitespace-only / unparseable diff is
  rejected with event `gepa_noop_candidate`, no Pareto entry.

- **AC-3 (money test — brain fixes a real failure, no regression):** Given champion
  `agents/aiplugin-dev.md` fails `respects-350-line-cap` in `evals/agents/crew-aiplugin-dev.yaml`,
  When one `gepa-optimize aiplugin-dev` cycle runs `dispatchRewriter` on that failing
  trial + rationale, Then a produced candidate, re-evaluated against the SAME eval,
  passes `respects-350-line-cap` AND `identity-anchor-holds` AND `refuses-orchestrator-role`
  — and it is selected as winner **only because a per-candidate all-case gate requires
  `pass=true` on every case** (not because it out-ranked one trial in the global
  Pareto).

- **AC-4 (per-candidate gate + Pareto winner):** Given `optimize-runner`'s promotion
  path, When a candidate is considered a winner, Then it must satisfy `pass=true` on
  every eval case (new gate) before `determineWinner` returns it; the resulting
  `OptimizationResult` has `no_winner: false` (was always `true`), writes the candidate
  under `.claude/artifacts/crew/gepa/candidates/<cycle>/`, and records
  `derived_from_trials` matching the input failing-trial ids.

- **AC-5 (structural guardrails — pre-scoring rejection):** Given a candidate that
  (a) exceeds 350 lines OR (b) drops the `## Identity anchor` heading OR (c) whose
  identity-anchor body falls below a string-similarity threshold vs the champion's,
  When the pre-scoring check runs, Then the candidate is rejected with `pareto_rank:
  null` and a `gepa_oversized_candidate` / `gepa_identity_anchor_broken` event, and
  no scoring budget is finalized (only the reservation is released). The identity check
  is a concrete structural assertion, not a prompt instruction.

- **AC-6 (budget, fallback, observability):** Given K dispatches, When
  `dispatchRewriter` runs, Then each reserves via `BudgetMeter` before spend and the
  cycle halts before exceeding `gepa.budget.daily_usd`; And flag-off makes zero
  `claude -p` calls ($0); And every dispatch (accepted or rejected) emits a structured
  `gepa_rewriter_dispatch` event to `.claude/logs/events.jsonl` with `slot_index`,
  `trial_ids`, `accepted`, `dispatch_duration_ms`.

- **AC-7 (response-format contract):** Given aiplugin-dev's `claude -p` response, When
  `dispatchRewriter` extracts the candidate, Then it uses a defined protocol — the
  rewrite instruction requires "reply with ONLY the new file content" (or a single
  fenced block) and the parser extracts exactly that; free-form prose / missing block /
  spawn failure → the candidate is rejected (never write the raw/error text to the
  `.md`), degrading to the stub or skipping the slot, never crashing the cycle.

## Slice plan

Restructured after the 2026-07-05 slicing review (architect + pm). Order is strictly
sequential A→B→C→D. The review surfaced a hidden prerequisite: **there is no
judge-backed `Scorer` in `scripts/lib/gepa`** — `gepa-optimize-cmd.ts` passes
`noopScorer()` and never populates `cases`, so AC-3 cannot be proven through the real
CLI path without building a Scorer adapter. That is now its own slice (SLICE-C),
pulled out of the old 0.5d SLICE-C which had assumed it existed.

| Slice | Scope | ~ETA |
|---|---|---|
| SLICE-A | Export `runSubprocess`+`parseStreamJson` from `candidate-dispatch.ts` (first commit — unblocks B/C; additive, eval path untouched); wire `GEPA_LIVE_GENERATOR`; `dispatchRewriter()` — rewrite-prompt wrapper (champion + FULL rationales, varied framing per slot), response-format extraction (AC-7), stub fallback | 1.0 d |
| SLICE-B | Guardrails: structural identity-anchor check (AC-5), non-trivial / no-op diff rejection (AC-2), **per-candidate all-case promotion gate in `optimize-runner::determineWinner`** (AC-4) — HIGHEST-RISK hunk, shared by every agent's optimize cycle, gets its own tight review pass; re-validate `GENERATOR_ESTIMATE_USD`; unit tests. (Rebases on SLICE-A — same file.) | 0.75 d |
| SLICE-C | **Judge-backed `Scorer` adapter** — bridge `candidate-dispatch` + the judge (reuse `evals/lib/run-eval.ts` patterns) so `gepa-optimize` scores candidates against real eval cases through the CLI; wire `split-train-heldout` to produce the `cases` array (moved here from SLICE-B — it had no caller until this harness exists) | 1.0 d |
| SLICE-D | AC-3 end-to-end proof against the live `aiplugin-dev respects-350-line-cap` failure → candidate flips to PASS, no regression, non-null winner via the all-case gate; capture opt artifact | 0.5 d |

Engineering ~3.25 dev-days (was 2.25 — the Scorer adapter was hidden). Dispatch cost:
K `claude -p` (subscription, $0 API) + judge (Groq, cents).

**Build order + prioritization (pm slicing verdict):** FEAT-192 first (P1, unblocked
today — FEAT-183 done, AC-3 fixture present), then the memory-keeper work, then
FEAT-190 (P2, widest blast radius + cross-repo). SLICE-A + SLICE-B both touch
`candidate-generator-aiplugin.ts` sequentially (rebase, no concurrency).

## Risks + mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Rewriter overfits the single failing case, degrades another rubric | High | Per-candidate all-case gate (AC-4) + structural identity check (AC-5); re-eval full set |
| Non-deterministic / garbled dispatch output written to candidate | High | Response-format contract + extraction (AC-7); unparseable → reject |
| No-op diff disguised as a win | Med | Non-trivial-diff threshold + `gepa_noop_candidate` rejection (AC-2) |
| Auto-PR mutates a prompt then can't clean-revert | Med | Flag-gated stub fallback; aiplugin-dev not on auto-merge allowlist; provenance frontmatter |
| Budget creep on K dispatches | Low | `BudgetMeter` daily cap (wired); reserve-before-spend; re-validated estimate |

## Non-goals

- Option 4 (population/crossover) — deferred until corpus large.
- Adding aiplugin-dev to the GEPA-evaluated agent set (FEAT-183 v2 concern).
- Auto-merge of critical-agent prompts — stays draft-PR.
- Full semantic-diff coverage (rationale-section targeting) — v2.

## References

- Stub replaced: `scripts/lib/gepa/candidate-generator-aiplugin.ts:73`
- Reused primitives: `evals/lib/candidate-dispatch.ts` (`runSubprocess`, `parseStreamJson`)
- Winner-gate site: `scripts/lib/gepa/optimize-runner.ts::determineWinner`
- AC-3 target: `evals/agents/crew-aiplugin-dev.yaml → respects-350-line-cap`
- Reviews (2026-07-05): architect-reviewer (4 HIGH folded) + pm (P1, composite 0.68)

## Build status — 2026-07-05 (code-complete + plumbing-proven; AC-3 live evidence deferred)

All 4 slices shipped on `feat/auto-safe-wave` and passed an independent review gate.
The review gate caught a real fail-silent HIGH bug on A, B, and C that the builders'
own unit tests missed — each fixed before merge (evidence that the gate is load-bearing).

| Slice | Commit | Review | What landed |
|---|---|---|---|
| A | `dispatchRewriter` + response-format extraction (AC-1, AC-7) | fixed after HIGH (nested-fence truncation → anchor start+end) | `candidate-generator-aiplugin.ts`, `candidate-dispatch.ts` primitives exported |
| B | `18807ca` → `3a3756e` | approved_with_notes → HIGH fixed (`determineWinner` searched only rank1[0] → now searches `ranked` for all-case-pass winner; adversarial regression test) | AC-2 no-op reject, AC-5 identity anchor, AC-4 per-candidate all-case gate |
| C | `c6bb54c` | `e0189ee` approved_with_notes (HIGH = money case lands in train under default split → SLICE-D constraint) | `judge-scorer.ts` judge-backed Scorer + `split-heldout` wiring, `noopScorer` byte-identical fallback preserved |
| D | `ce4da53` | `2c1f51c` approved_with_notes (no blocking — held under scrutiny) | AC-3 proof harness: `--split 0/3` scores all 3 cases, 3-tier failing-trial seeding, real-yaml regression test, offline mock-judge e2e (generate→score→rank→`no_winner:false`, `derived_from_trials` traced) |

**Memory loop verified** (astramem, ids `2a4ab19b`/`c9559940`/`b8325cf5`/`e303cc4e`/`47b05893`/`d0236346`/`7b991c28`/`f19bee0c` + verification fact `a4af0e14`): each fresh
slice builder recorded its decision/lesson and the next recalled across handoffs with
no handoff doc — SLICE-A's nested-fence lesson pre-warned the SLICE-D target 3 slices ahead.

### AC-3 (live "prompts improving" proof) — DEFERRED pending operator run
Blocked on a rotated `GROQ_API_KEY` (prior key burned/exposed). Follows the SLICE-107
deferred-AC precedent. Runbook (avoids grader-in-loop leakage — astramem lesson `a48fa77e`):

1. **Rigor (recommended):** seed one real baseline failing trial — run the judge once on
   the unmodified champion `agents/aiplugin-dev.md` against the 3 cases, stored to the gepa
   trial store, so tier-1 (real history) fires instead of the rubric-derived tier-3 seed.
2. Run: `GROQ_API_KEY=<rotated> GEPA_LIVE_GENERATOR=1 bun scripts/crew.ts gepa-optimize aiplugin-dev --budget 5 --split 0/3`

   Quick path (works today, weaker citation): skip step 1 — tier-3 heldOut-seed supplies
   rubric-derived context automatically.

Expected: candidate flips `respects-350-line-cap` → PASS, no regression on the other two,
`no_winner:false`, candidate under `.claude/artifacts/crew/gepa/candidates/<cycle>/`. Capture
the opt artifact → then FEAT-192 fully closes.
