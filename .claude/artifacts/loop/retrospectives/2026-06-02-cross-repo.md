# Cross-Repo Retrospective — 2026-06-02 (30-day window, since 2026-05-03)

Aggregate of `/loop:retrospective` runs across the four consumer repos
of the `crew` plugin that have non-zero grade data.

## Headline

| Repo | Slices | Decisions | Features done | Cadence (slices/wk) | Avg grade |
|---|---|---|---|---|---|
| **cortex** | 76 | 35 | 109 | 17.7 | 0.79 |
| **authentic** | 49 | 44 | 0 | 11.4 | 0.78 |
| **loopobserver** | 15 | 12 | 20 | 3.5 | **0.49 ⚠** |
| **citylive** | 3 | 0 | 12 | 0.7 | 0.86 |
| **hero-crew** (this repo) | 6 | 6 | 5 | 6.0 | 0.87 |

`featuresDoneInWindow: 0` on authentic + hero-crew suggests retro is
reading a different field shape than those repos use (likely missing
or differently-named `done_at` frontmatter). Cosmetic — git history
shows real movement.

## Per-dimension averages

| Dimension | cortex | authentic | loopobserver | citylive | hero-crew |
|---|---|---|---|---|---|
| architecture_quality | 0.842 | 0.849 | **0.507 ⚠** | 0.907 | 0.858 |
| reliability | 0.811 | 0.811 | **0.543 ⚠** | 0.84 | 0.85 |
| observability | **0.68 ⚠** | **0.72 ⚠** | **0.39 ⚠** | **0.667 ⚠** | 0.842 |
| production_readiness | **0.789 ⚠** | **0.676 ⚠** | **0.463 ⚠** | 0.87 | 0.875 |
| security | 0.877 | 0.846 | **0.509 ⚠** | 0.933 | 0.875 |
| test_confidence | **0.721 ⚠** | **0.787 ⚠** | **0.497 ⚠** | 0.877 | 0.867 |
| product_completeness | 0.81 | **0.72 ⚠** | **0.513 ⚠** | 0.907 | 0.9 |

⚠ marks dimensions below the 0.80 threshold per repo.

## Cross-repo patterns

### Pattern 1: observability is universally weak

4 of 4 active consumer repos flag `observability` below 0.80. Only
hero-crew (the plugin repo) is clean. Hypothesis: consumer repos
implement features; they don't routinely instrument what they ship.
Worth shipping an observability-quality skill or routing-table row
that triggers an "are you logging this" prompt on net-new feature
review.

### Pattern 2: test_confidence weak in mid-cadence repos

cortex (17.7/wk) and authentic (11.4/wk) both flag test_confidence.
loopobserver (3.5/wk) is in worse shape across the board. Only
citylive (0.7/wk) and hero-crew (6/wk) are clean on tests.

Hypothesis: velocity past ~10 slices/week starts shedding test
discipline. The FEAT-030 builder-self-verify rule (shipped today in
v0.5.0) is designed exactly for this — should land in cortex +
authentic as the next consumer bump.

### Pattern 3: production_readiness weak in 3 of 4 consumer repos

Only citylive + hero-crew flag green. cortex / authentic / loopobserver
all under threshold. Hypothesis: post-ship validation isn't being
captured in grades. The new validate-agents.mjs + deployer.md
deployment-check CLI block (v0.6.0) addresses part of this.

### Pattern 4: loopobserver is in distress

All 7 dimensions below 0.80, scores in the 0.39-0.55 band. Worst
case is observability at 0.39. This is materially different from
the other consumer repos — looks like grade-rubric drift or a
sustained quality emergency, not stable execution. Recommend a
focused review session there before continuing implementation.

### Pattern 5: cadence vs quality has a sweet spot

- citylive 0.7/wk → 0.86 avg (clean but possibly under-sampled)
- hero-crew 6/wk → 0.87 avg (focused arc)
- authentic 11.4/wk → 0.78 avg (degrading)
- cortex 17.7/wk → 0.79 avg (degrading)
- loopobserver 3.5/wk → 0.49 avg (different problem)

Quality holds up to ~6-10 slices/week. Past that, the speed-quality
trade visibly bites. cortex's 109 features-done figure shows real
productivity at high cadence, but the test_confidence + observability
costs are accumulating.

## Recommendations (per-repo)

### loopobserver — quality emergency

- Open a dedicated quality slice before further feature work.
- Audit the recent low-scoring slices for what's driving the 0.4-0.5
  band; either rubric drift (consistent low scoring without justification)
  or a real test/observability backlog.
- Apply the FEAT-030 builder-self-verify rule.

### cortex — high cadence, observability drift

- Bump consumer pin to crew@0.6.0 (v0.6.0) for the agent quality bar
  + validate-agents CI gate.
- After v0.6.0 lands, bump to v0.7.0 for the Sonnet-default model
  gate — high-cadence repo benefits most from the cost lever.
- Open a slice for observability instrumentation on the top-3
  weakest-graded recent features.

### authentic — features-done shape issue + observability/prod-readiness

- Investigate the `featuresDoneInWindow: 0` discrepancy — frontmatter
  shape mismatch with the retro reader.
- Bump to crew@0.7.0 to pick up the perf-stabilization bundle.

### citylive — healthy except observability

- Small sample (3 slices). Continue current pattern; address
  observability when convenient.

### hero-crew (this repo)

- Already at v0.7.0. No bumps to take.
- Consider FEAT-029 dogfood when fresh sessions are available.

## Open questions

- Is `featuresDoneInWindow: 0` a retro-reader bug or a frontmatter
  convention drift in 2 of 5 repos?
- Should the `crew` plugin ship an "observability" routing-table row
  / skill given 4-of-4 consumer adoption flag it?
- How honest is loopobserver's grade rubric — is the 0.4-0.5 band
  real signal or rubric drift?

## Per-repo artifacts

Each consumer repo now has a `.claude/artifacts/loop/retrospectives/2026-06-02.md`
file with the local detail. Two repos (cortex, authentic) had pre-existing
uncommitted changes — the new retro file is uncommitted in those repos
and the user should decide whether to commit, discard, or leave WIP.

| Repo | Retro file | Working tree |
|---|---|---|
| cortex | `C:\work\mega\cortex\.claude\artifacts\loop\retrospectives\2026-06-02.md` | 7 uncommitted changes (pre-existing) |
| authentic | `C:\work\mega\authentic\.claude\artifacts\loop\retrospectives\2026-06-02.md` | 55 uncommitted changes (pre-existing) |
| loopobserver | `C:\work\mega\loopobserver\.claude\artifacts\loop\retrospectives\2026-06-02.md` | clean before retro write |
| citylive | `C:\work\mega\citylive\.claude\artifacts\loop\retrospectives\2026-06-02.md` | clean before retro write |
