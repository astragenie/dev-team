# Plan — GEPA reflective-rewrite engine (the real candidate generator, Option 1)

**Date:** 2026-07-05
**Status:** draft — awaiting architect-review + pm scope
**Relates:** FEAT-183 (GEPA plumbing, done), FEAT-189 (eval specs), the 4-options analysis (this is Option 1 + Option 2 guardrails)

## Problem — the GEPA brain is a stub

All GEPA plumbing is real (capture, eval, Pareto, soak, promotion PR, kill-switches,
budget meter, lock manager). The **candidate generator is a placeholder**:
`scripts/lib/gepa/candidate-generator-aiplugin.ts → synthesizeCandidate()` takes the
champion prompt and appends a comment marker + the failing-trials text. It does not
rewrite the prompt and calls no LLM. `GEPA_LIVE_GENERATOR` is a comment, never wired.

Consequence: every `gepa-optimize` run returns `no_winner` — the synthetic candidates
can never beat the champion. GEPA produces **no recommended prompt change**. The whole
point of GEPA (reflective prompt evolution) is unbuilt.

## Goal

Replace the stub with a real **reflective rewrite engine**: dispatch `aiplugin-dev`
(the prompt-author agent) with the champion prompt + failing trials + the judge's
rationales, and get back genuinely-improved candidate prompts that fix the named
failures. Implements the existing `CandidateGenerator.generate(champion, failingTrials,
k)` interface — no plumbing change downstream (Pareto, soak, promotion all consume the
result unchanged).

## The reflective loop (Option 1 + Option 2 guardrails)

```
failing trials (input + output + JUDGE RATIONALE)   ← the reflection signal
        +
champion prompt (agents/<name>.md)
        ↓  dispatch aiplugin-dev via `claude -p` (reuse evals/lib/candidate-dispatch.ts)
        ↓  instruction: "rewrite/patch the prompt to fix these specific failures,
                         preserve identity anchor, stay under 350 lines,
                         change as little as possible (Option 2 guardrail)"
        ↓
K candidate prompts → validateCandidateSize (≤350, already enforced) → Pareto → soak → PR
```

Key: the **judge rationale** ("set maxLines to 400, inlined detail instead of a skill")
is the fuel — the rewriter reflects on *why* it failed, not just *that* it failed.

## Design detail

1. **New `dispatchRewriter()`** in `candidate-generator-aiplugin.ts` (or a sibling
   module), gated behind `GEPA_LIVE_GENERATOR=1` (wire the flag that's currently a
   comment). Falls back to `synthesizeCandidate` when the flag is off (keeps
   artifact-only dry cycles $0 + deterministic).
2. **Reuse the live-dispatch path** — `evals/lib/candidate-dispatch.ts` already spawns
   `claude -p --output-format stream-json`, parses the assistant response, subscription-
   billed ($0 API). The generator dispatches `aiplugin-dev` with a rewrite instruction
   built from `formatFailingTrialsSample()` (already exists) + the champion.
   NOTE module-boundary rule: `candidate-dispatch.ts` MUST NOT import from `scripts/` —
   so the shared dispatch helper is extracted to a boundary-safe location or duplicated.
3. **Guardrails baked in (Option 2):**
   - Prompt instruction pins: preserve the identity-anchor block, keep ≤350 lines,
     minimal diff. Oversized candidates already rejected pre-scoring by
     `validateCandidateSize` (no budget spend).
   - Each candidate diffed against champion; reject empty/no-op diffs (the current
     stub's failure mode).
4. **K variants** = K dispatches at varied temperature / framing, each reserving budget
   via the existing `BudgetMeter` (already wired in `generate()`).
5. **Provenance** — each candidate records `derived_from_trials` (already in the
   `Candidate` shape) so a promoted prompt traces back to the failures it fixed.

## Acceptance criteria (concrete, reproducible)

The live `aiplugin-dev` eval already produces a real failing case — use it as the gate.

- **AC-1 (flag wired):** `GEPA_LIVE_GENERATOR=1` routes `generate()` to
  `dispatchRewriter`; unset keeps `synthesizeCandidate` (dry, deterministic, $0).
- **AC-2 (real rewrite, not a marker):** Given a champion + ≥1 failing trial with a
  judge rationale, When `dispatchRewriter` runs, Then each candidate `.md` differs from
  the champion by an actual content edit addressing the rationale — NOT a `<!-- GEPA
  candidate mutation -->` appendage — and passes `validateCandidateSize` (≤350).
- **AC-3 (the money test — brain fixes a real failure):** Given the champion
  `agents/aiplugin-dev.md` fails `respects-350-line-cap` in the live-agent eval
  (`crew-aiplugin-dev.yaml`), When one optimize cycle runs the reflective rewriter on
  that failing trial, Then a produced candidate, re-evaluated against the SAME eval,
  flips `respects-350-line-cap` to PASS **without regressing** `identity-anchor-holds`
  or `refuses-orchestrator-role`.
- **AC-4 (Pareto emits a winner):** With AC-3's candidate, `gepa-optimize aiplugin-dev`
  returns a non-null winner (was always `no_winner`), and writes the candidate under
  `.claude/artifacts/crew/gepa/candidates/<cycle>/` + an opt artifact with the winner.
- **AC-5 (guardrails hold):** A candidate that drops the identity-anchor block or
  exceeds 350 lines is rejected (identity check + `validateCandidateSize`), logged, and
  excluded from Pareto — no budget spent scoring it.
- **AC-6 (budget + fallback):** K dispatches respect the `BudgetMeter` daily cap;
  flag-off path stays synthetic + $0; live path is subscription-billed via `claude -p`
  (no API key required beyond the judge).

## Slice plan

| Slice | Scope | ~ETA |
|---|---|---|
| SLICE-A | Extract boundary-safe `claude -p` rewrite-dispatch helper; wire `GEPA_LIVE_GENERATOR`; `dispatchRewriter()` with the reflection prompt (champion + trials + rationales) + fallback to stub | 1.0 d |
| SLICE-B | Option-2 guardrails: identity-anchor-preservation check, no-op/empty-diff rejection, minimal-diff instruction; unit tests | 0.5 d |
| SLICE-C | AC-3 end-to-end proof: run the reflective cycle against the live `aiplugin-dev` `respects-350-line-cap` failure → candidate flips it to PASS, no regression; capture the opt artifact | 0.5 d |

Engineering ~2 dev-days. Dispatch cost: K `claude -p` calls/cycle (subscription, $0 API) + judge calls (Groq, ~cents).

## Risks + mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Rewriter drifts identity / breaks contract while "fixing" a case | High | Identity-anchor-preservation check + minimal-diff instruction (Option 2); Pareto scores ALL rubrics so a regression elsewhere blocks the win |
| Non-determinism → flaky candidates | Med | Fallback stub stays deterministic; live path gated by flag; K>1 variants + Pareto absorb variance |
| `candidate-dispatch.ts` module-boundary rule (no `scripts/` import) | Med | Extract dispatch helper to a boundary-safe location shared by evals + generator |
| Rewriter games the single failing case, overfits | Med | Re-eval against the FULL eval set (all fixtures), not just the failing one (AC-3 checks no-regression); held-out split later |
| Cost creep on K dispatches | Low | `BudgetMeter` daily cap already wired; each dispatch reserves before spend |

## Non-goals

- Option 4 (population/crossover) — deferred until corpus is large.
- Multi-agent simultaneous optimization.
- Auto-merge of critical-agent prompts — stays draft-PR (existing allowlist).
- Changing the judge / eval framework.

## Design revisions (architect review, 2026-07-05 — folded)

- **Module boundary was misdiagnosed (HIGH).** The `candidate-dispatch.ts` "no
  `scripts/` import" rule is **one-directional** (scoped to `evals/lib/**` +
  `biome.json noRestrictedImports`). `scripts/lib/gepa/*` importing
  `evals/lib/candidate-dispatch.ts` is allowed. **Drop the "extract boundary-safe
  helper" work (saves ~0.5d).** Instead: export the low-level primitives
  (`runSubprocess` + `parseStreamJson`, currently private) from
  `candidate-dispatch.ts` and build a **separate rewrite-prompt wrapper** in the
  generator — do NOT call `dispatchCandidate()` (it bakes in an eval-only
  "you are being evaluated… end with [end of response]" wrapper, nonsensical for
  rewrite). Note: if `evals/` is later extracted to `@astragenie/crew-eval`, this
  import becomes a package dep — known future migration, not a violation today.
- **No-regression is NOT enforced by current plumbing (HIGH).**
  `optimize-runner.ts::determineWinner` takes `rank1[0]` from a **global** Pareto
  over all (candidate × case) trials — a candidate can win one case and bomb
  another without blocking promotion. **Add a per-candidate all-case gate:** a
  candidate is eligible only if `pass=true` on EVERY eval case. Without this,
  AC-3's "without regressing" proves nothing.
- **Identity-anchor guardrail must be structural (HIGH).** No checker exists
  (`validateCandidateSize` = line count only). Add a concrete pre-scoring check:
  assert the candidate still contains a `## Identity anchor` heading AND its body
  has ≥ threshold string-similarity to the champion's; reject (like
  `validateCandidateSize`) on fail. A prompt instruction is not a guardrail.
- **Response-format contract must be defined (HIGH).** `parseStreamJson` returns
  raw assistant text. `dispatchRewriter` MUST instruct "reply with ONLY the new
  file content" (or a single fenced block) + extract it; unparseable/empty output
  → reject as a candidate (not write the error string to the `.md`).
- **Wire `split-train-heldout.ts` now (MED)** — it already exists (SLICE-98),
  idle. With 3 fixtures, full set ≈ held-out today; wire it rather than defer.
- **Drop "varied temperature" (MED)** — `claude -p` exposes no temperature knob
  here. K-diversification = varied **framing** (different rewrite instructions per
  slot) only.
- **Re-validate `GENERATOR_ESTIMATE_USD` (MED)** — 0.05 was calibrated for the
  near-zero stub, not a real `claude -p` dispatch.
- **Full rationale, not 120-char truncation (MED)** — `formatFailingTrialsSample`
  truncates to 120 chars (fine for eval diagnostics, too short as rewrite fuel).
  Thread the full judge rationale into the rewrite prompt.
- **`dispatchRewriter` throw handling (LOW)** — subprocess/CLI failure → reject
  the candidate / degrade to stub, never hard-crash the cycle.

Net effort: ~unchanged (−0.5d extraction dropped, +the winner-gate + identity
check + extraction-format work).

## References

- Stub being replaced: `scripts/lib/gepa/candidate-generator-aiplugin.ts:73` (`synthesizeCandidate`)
- Reusable dispatch: `evals/lib/candidate-dispatch.ts` (`claude -p` stream-json, $0)
- Live failing case (AC-3 target): `evals/agents/crew-aiplugin-dev.yaml` → `respects-350-line-cap`
- Interface: `CandidateGenerator.generate()` (gepa-core), consumed by `optimize-runner.ts`
