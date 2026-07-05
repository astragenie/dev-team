# Wave plan — GEPA brain (FEAT-192) for max parallelism

**Date:** 2026-07-05
**FEAT:** FEAT-192 (reflective-rewrite engine)
**Goal:** build the GEPA brain in parallel waves, not the serial A→B→C→D.

## The reframe

The slicing review found A→B→C→D **strictly sequential** — because it sliced along
the *pipeline* (generate → guardrail → score → prove). Pipeline slices chain.

But the work decomposes along **component axes** that are independent, because
FEAT-183 already shipped the interface seams (`CandidateGenerator`, `Scorer`,
`Trial` / `Candidate` Zod types in gepa-core). Each component builds + unit-tests
against a **stable contract**, not against another in-flight slice. That is what
unlocks parallelism: generator, scorer, and ranker never touch the same file and
never need each other to compile.

```
                 gepa-core interfaces (FROZEN — FEAT-183, shipped)
        CandidateGenerator │ Scorer │ Trial/Candidate types
                 │              │            │
   ┌─────────────┼──────────────┼────────────┼──────────────┐
   │  T1 GENERATOR   T2 SCORER      T3 RANKER    (Wave 1 — parallel)
   │  build+test     build+test     build+test
   │  vs fixture     vs fixture     vs mock
   │  trials         candidates     trials
   └─────────────┴──────────────┴────────────┘
                         │ (barrier)
                 T4 INTEGRATION + AC-3 proof  (Wave 2 — serial join)
```

## Wave 1 — three parallel tracks (disjoint files)

Each runs in its own worktree, merges independently. **No file is touched by two
tracks** (conflict-pack proof below).

### T1 — GENERATOR
Everything that turns failing trials into candidate `.md` files.
- Export `runSubprocess` + `parseStreamJson` from `candidate-dispatch.ts` (additive).
- Wire `GEPA_LIVE_GENERATOR`; `dispatchRewriter()` — reflection prompt (champion +
  FULL rationales, varied framing per slot), response-format extraction (AC-7).
- Guardrails that live on the candidate: structural identity-anchor check (AC-5),
  non-trivial / no-op diff rejection (AC-2). Stub fallback.
- **Testable in isolation** against hand-authored fixture failing-trials + a fake
  `claude -p` (or recorded stream) — needs no scorer, no ranker.
- Owner: `crew:aiplugin-dev` (it authors the rewrite prompt + owns the generator).

### T2 — SCORER
The missing judge-backed `Scorer` the review surfaced.
- New `scripts/lib/gepa/judge-scorer.ts` — bridge `candidate-dispatch` + the judge
  (reuse `evals/lib/run-eval.ts` patterns) so a candidate is scored against real
  eval cases and returns a `ScoreResult`.
- Wire `split-train-heldout` to build the `cases` array; wire it into
  `gepa-optimize-cmd.ts` (replace `noopScorer()`).
- **Testable in isolation** against fixture candidate `.md` files + the live Groq
  judge — needs no generator, no ranker.
- Owner: `crew:backend-dev` (TS scoring/bridge logic).

### T3 — RANKER
The per-candidate all-case promotion gate (the highest-risk hunk).
- `optimize-runner.ts::determineWinner` — add the gate: a candidate is eligible
  only if `pass=true` on EVERY eval case (fixes the global-Pareto rank1[0] bug).
- **Testable in isolation** against mock `Trial[]` — needs no LLM, no generator, no
  scorer. Pure ranking logic.
- Owner: `crew:backend-dev` (second track — or `crew:refactor` if two BE owners
  needed to keep tracks truly concurrent).

## Wave 2 — integration join (serial, single owner)

### T4 — INTEGRATION + AC-3 proof
After T1+T2+T3 merge:
- Wire generate → score → rank end-to-end in `optimize-runner` / `gepa-optimize-cmd`.
- **AC-3 money test:** run one live cycle against the `aiplugin-dev
  respects-350-line-cap` failure → candidate flips to PASS, no regression on the
  other 2, non-null winner via the all-case gate; capture the opt artifact.
- Owner: orchestrator-dispatched `crew:integrator` (live wire-up smoke is its role).

## Conflict-pack (touches_files — disjoint proof)

| Track | touches_files | collides with |
|---|---|---|
| T1 GENERATOR | `scripts/lib/gepa/candidate-generator-aiplugin.ts`, `evals/lib/candidate-dispatch.ts` | none |
| T2 SCORER | `scripts/lib/gepa/judge-scorer.ts` (new), `scripts/lib/gepa/gepa-optimize-cmd.ts` | none |
| T3 RANKER | `scripts/lib/gepa/optimize-runner.ts` | none |
| T4 INTEGRATION | integrates (may re-touch `gepa-optimize-cmd.ts` after T2 merges) | Wave-2, post-barrier |

T4 re-touches `gepa-optimize-cmd.ts` (T2's file) — that's why it's Wave 2 (after T2
merges), not a parallel collision. All Wave-1 tracks are disjoint → safe to fan out.

## Parallelism math

- Serial (A→B→C→D): ~3.25 dev-days.
- Wave: Wave 1 wall-clock = slowest track (T1 ≈ 1.0d; T2 ≈ 1.0d; T3 ≈ 0.5d run
  concurrently) + Wave 2 (T4 ≈ 0.75d incl. AC-3) ≈ **~1.75d wall-clock**.
- ~1.85× speedup, 3 builders concurrent in Wave 1.

## The seam that makes it safe

Tracks agree on **nothing at build time except the frozen gepa-core interfaces**
(`CandidateGenerator.generate() → Candidate[]`, `Scorer.score() → ScoreResult`,
`Trial`/`Candidate` shapes). Because those are already shipped + Zod-validated, a
track can't drift the contract out from under another. This is the payoff of
FEAT-183 having built the plumbing first — the waves ride its seams.

## Execution (runner:wave)

1. Pre-flight: register T1/T2/T3 as triaged slices with the `touches_files` above +
   `autonomous_safe: false` (each mutates gepa infra — human review per FEAT-192).
2. `loop.marathonRunner: "wave"`, `wave.size: 3` → planner conflict-packs the 3
   disjoint tracks into 3 sibling worktrees, fans out builders.
3. Each track: `/crew:build` → `crew:reviewer` + `crew:verifier` gate → merge on PASS.
4. Barrier: all 3 merged → dispatch T4 (integration) in the main tree.
5. T4 review + validation gate → FEAT-192 done when AC-1..AC-7 green.

## Risks specific to the wave cut

| Risk | Mitigation |
|---|---|
| T1 & old-SLICE-B guardrails both wanted `candidate-generator-aiplugin.ts` | Resolved — guardrails folded INTO T1 (same owner/file); the all-case gate moved to T3's `optimize-runner.ts`. Disjoint. |
| A track drifts the interface | Interfaces are frozen in gepa-core (published 0.7.0); no track may edit them. |
| Integration surprises (mock ≠ live) | T4 is a real live cycle (integrator), not a mock — surfaces any contract mismatch at the join. |
| `determineWinner` shared by all agents' optimize cycles (T3) | Tightest review gate on T3; behavior-preserving for the no-candidate path (guard already exists). |

## Non-goals (unchanged from FEAT-192)

Option 4 population/crossover; adding aiplugin-dev to the evaluated set; auto-merge
of critical-agent prompts.
