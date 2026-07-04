# GEPA promotion — statistical bar (honesty note)

Source: `docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md`
Section 6 "Promotion policy — statistical honesty at current corpus size".
This doc makes that finding durable outside the one-time review artifact.

## The gap

The GEPA promotion gate (`scripts/lib/gepa/auto-merge-gate.ts` +
`evaluateGate`/`evaluateSoak` from `@astragenie/gepa-core`) is configured
in `gepa.config.json` with:

```json
"policy": {
  "min_pass_delta": 0.05,
  "min_case_score_floor": 0.6,
  "soak_percent": 0.10,
  "soak_days": 7,
  "min_soak_trials": 20,
  "max_soak_days": 21,
  "soak_epsilon": 0.02
}
```

The headline framing — "promote when the candidate beats champion by
≥5 percentage points" — reads as a well-powered statistical test. It
is not, at `min_soak_trials: 20`.

**Binomial-proportion reasoning:** at n=20 trials, the standard error
of a pass-rate estimate near p=0.7–0.8 is roughly
√(p(1-p)/n) ≈ 0.09–0.10 (9–10 percentage points) — a full standard
deviation *larger* than the 5pp effect size the gate claims to detect.
A well-powered 5pp detection at typical pass rates needs roughly
n≈150–300 trials per arm. This is a known, previously-acknowledged
tension (Resolved Concern C13 in the original design doc already
flagged "n=3 over 7 days is statistical theatre" and raised the floor
to 20) — but 20 is still under-powered for the stated 5pp target, just
less theatrical than 3.

## What the gate actually is

Read `min_soak_trials: 20` + `soak_days: 7`/`max_soak_days: 21` as a
**coarse regression screen**, not a precision instrument. At n=20 it
reliably catches swings in the ≥12–15 percentage-point range (roughly
one-and-a-half standard errors) and the `min_case_score_floor: 0.6`
tail-risk gate provides real protection against catastrophic
per-case regressions independent of sample size. It does not reliably
resolve a genuine 5pp improvement from noise. Both readings matter:
this is a real guard against `worse` prompts, it is not proof of a
`+5%` improvement.

## Per-agent corpus sizes (confirmed, 2026-07-04)

| Agent | Eval corpus | Auto-merge eligible? |
|---|---|---|
| `architect` | `agents/architect/.gepa/eval/*.jsonl` — 8 cases | No — `CRITICAL_AGENT_ALLOWLIST` |
| `reviewer` | `agents/reviewer/.gepa/eval/*.jsonl` — 10 cases | No — `CRITICAL_AGENT_ALLOWLIST` |
| `verifier` | none yet | No — `CRITICAL_AGENT_ALLOWLIST` |

`scripts/lib/gepa/critical-agent-allowlist.ts` names `reviewer`,
`verifier`, `architect` as the critical-agent set. Per
`scripts/lib/gepa/auto-merge-gate.ts`'s `evaluateAutoMergeGate`, the
critical-agent check fires **first**, before any of the 5-condition
statistical gate — these three agents never reach `gh pr merge
--auto`. Every promotion cycle for them ends in a **draft PR for
human review**, regardless of pass-rate delta.

This means the n=8/n=10 corpus for `architect`/`reviewer` is not
inadequate for its *actual* use (a plausibility signal feeding a
human-reviewed draft PR) even though it would be inadequate for the
*stated* auto-merge bar (which these two agents structurally never
reach). Do not read "only 8 cases" as a defect for these agents
without also reading the critical-agent gate that makes the
distinction moot.

## Enforcement today (already blocking, no new code needed)

`min_soak_trials` is a hard AND-condition inside `evaluateSoak`
(`@astragenie/gepa-core`, external package — not editable from this
repo). A soak only reaches `verdict.status === "passed"` when **both**
the day-clock (`soak_days`/`max_soak_days`) and the sample-clock
(`min_soak_trials`) clear — this is the "dual clock-AND-sample" gate
named in the original design doc. `evaluateAutoMergeGate` then blocks
on `soak_not_passed` whenever soak hasn't reached `"passed"`. There is
no path today where a candidate is promoted with fewer than
`min_soak_trials` trials recorded — the value in `gepa.config.json`
(currently `20`, matching the code default in
`buildAutoMergePolicy`) is the single source of truth for both the
gate's blocking behavior and this document's honesty claim above.
If that value is ever lowered, re-run the binomial-proportion math
above before assuming any pass-rate delta is signal rather than noise.

## Options (not implemented — pick one later if the imprecision matters)

1. **Reframe honestly, keep the mechanism.** Relabel the gate's
   detectable effect size as "≥12–15pp regressions, 80% power at
   n=20" and keep 5pp as an aspirational target for high-volume
   agents where soak naturally accumulates more trials over the
   7–21 day window. Zero code change — a documentation-only fix.
2. **Sequential test (SPRT).** Replace the fixed dual-clock-AND-sample
   gate with a Sequential Probability Ratio Test against
   H0: no improvement vs H1: ≥5pp improvement. Lets low-volume agents
   run longer (up to `max_soak_days`) while still stopping early on a
   clear signal, and yields a real likelihood-ratio instead of a
   point-in-time percentage comparison. Fits the existing
   `soakMonitor` interface (same inputs: rolling trial stream, two
   rates to compare) as an additive change — but this requires a
   change inside `@astragenie/gepa-core` (external package), not this
   repo, since `evaluateSoak` lives there. Flagging as a **future
   gepa-core enhancement**, not a crew-repo change.
3. **Explicit lower bar for critical agents** (already effectively
   true per the section above — this option formalizes it). Since
   `architect`/`reviewer`/`verifier` never auto-merge, their
   promotion decision could adopt a lower, human-reviewed bar
   explicitly (e.g. skip the soak-trial-count question below some
   agent-tier threshold) rather than nominally inheriting the
   auto-merge-grade bar they never actually need to clear.

No option above is implemented by this document — it is the "document
+ config" half of the decision. Automated relabeling of copy in
`scripts/lib/gepa/*` and the design doc is out of scope here (would
touch files owned by the concurrent GEPA slice work); this doc is the
durable, discoverable statement of the gap so the next person touching
the promotion gate doesn't have to rediscover it.
