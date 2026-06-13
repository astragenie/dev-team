---
name: test-quality
tier: workflow
description: Three-lens test-quality review for qa-expert — flaky-test heuristics (executable), anti-pattern scan (executable), and mutation-testing advisory (procedural). Load when coverage looks adequate but test_confidence grade is below 0.80 or the routing signal "test suite quality questioned" fires.
owner: hero-crew
last_reviewed: 2026-06-13
triggers: test-quality, flaky-test, flakiness, test-anti-pattern, assertion-free, over-mocking, tautological-assert, mutation-testing, mutation-score, test-confidence
---

# Test-Quality Lens

Review-time advisory skill for `qa-expert`. Adds three lenses on top of the existing coverage-gap analysis.
Findings are emitted as `[SEVERITY] file:line — description` blocks so they merge cleanly with the
qa-expert handoff `--findings` count.

**DEC-025 posture:** Lens 1 + Lens 2 ship as an executable canonical entry (`scripts/analyze.ts`).
Lens 3 ships as procedural prose because mutation-runner config is project-specific; the v1 deliverable
is vocabulary for asking for evidence, not a runner.

## When to use

Invoke this skill (and run `scripts/analyze.ts`) when **either** condition is true:

1. The routing signal **"test suite quality questioned"** fires — coverage looks adequate but
   `test_confidence` grade has been below 0.80 across the last 5 grades in the qa-expert session context.
2. The existing qa-expert coverage analysis returns `coverage_adequate` but the reviewer suspects
   flakiness, assertion-free placeholders, or tautological checks in the diff.

**Do not load** for routine coverage-gap checks — use the existing `coverage_adequate` / `gaps_found`
analysis path instead. This lens is additive.

## Canonical entry (Lens 1 + Lens 2)

```bash
# Default mode: scope to changed test files only (PR-review mode).
# --diff-base defaults to HEAD~1; pass an explicit ref for slice-base diffs.
bun skills/workflow/test-quality/scripts/analyze.ts --target <repo-path> \
  --diff-base <ref>

# Bulk audit mode: full-tree scan. Noisier — use only when a maintainer asks
# for a full sweep, NOT during routine PR review.
bun skills/workflow/test-quality/scripts/analyze.ts --target <repo-path> --bulk

# With observability line on stderr (CI / loop integration)
bun skills/workflow/test-quality/scripts/analyze.ts --target <repo-path> --emit-observability
```

Default behavior is `--changed-only` (PR-review mode) per the SLICE-75
calibration: bulk-mode produces advisory-grade noise, PR-review mode produces
zero false positives on real diffs. Use `--bulk` only when intentionally
sweeping the full tree.

Exit codes: `0` = zero HIGH findings; `1` = at least one HIGH finding; `2` = scan tooling failure.

## Lens 1 — Flaky-test detection (executable)

The analyzer applies these patterns to every matched test file. Hard signals emit `[HIGH]`; soft signals
emit `[MEDIUM]`.

| Pattern | Label | Severity |
|---------|-------|----------|
| `setTimeout\(.*,\s*0\)` | Zero-delay timer (deferred assertion) | HIGH |
| `await new Promise\(.*setTimeout` or `\bsleep\(` | Hard-coded sleep | HIGH |
| `await Promise\.resolve\(\)` mid-test | Micro-task hop (fragile under concurrency) | HIGH |
| `\bDate\.now\(\)\b` or `new Date\(\)` in test body without mock | Wall-clock dependence | HIGH |
| `\bMath\.random\(\)` in test body without seed | Non-deterministic | HIGH |
| Shared module-scope variable mutated inside `test(...)` | Shared state | HIGH |
| `process.env.X` read inside test body, allowlisting `CI`/`NODE_ENV`/`TEST_*`/`BUN_*`/`DEBUG` (legitimate test config) | Env leak | HIGH |
| Test name matches `/\b(eventually|sometimes|flak|timing|async)\b/i` | Flaky-sounding name | MEDIUM |

## Lens 2 — Test anti-pattern scan (executable)

Applied by the same `analyze.ts` run.

| Anti-pattern | Detection | Severity |
|--------------|-----------|----------|
| Assertion-free test | `test(...)` / `it(...)` body with no call matching `expect\|assert\|should\|toBe\|toEqual\|toHave\|toBeTruthy\|toBeFalsy\|toThrow\|resolves\|rejects` | HIGH |
| Tautological assert | `expect(true).toBe(true)` / `expect(1).toBe(1)` / literal-equals-literal | HIGH |
| Over-mocking | ≥ 5 `(jest\|vi\|mock)\.(mock\|fn\|spyOn)\(` calls in a single test body | MEDIUM |

v1 scope: these three patterns only. Detecting "tests that never fail because they catch their own throw"
requires AST-level judgment and is deferred.

## Lens 3 — Mutation-testing quality bar (procedural)

**No script execution for this lens.** Mutation-runner configuration is project-specific; this lens
provides vocabulary for asking for evidence.

When qa-expert is reviewing a **critical-path module** (auth, payment, state mutation, security
primitives), recommend that the builder produce a mutation-testing survival report:

- TypeScript / JavaScript → [Stryker](https://stryker-mutator.io/)
- Python → [mutmut](https://github.com/boxed/mutmut)
- JVM → [PIT](https://pitest.org/)

**Advisory only — qa-expert MUST NOT block merge for a missing mutation report.** The gate is
informational: surface it, document the recommendation in the handoff `--risks` field, move on.

If a mutation report is provided, qa-expert reports surviving mutants as:

```
[ADVISORY] mutation-survival: <count> mutants survived in <module>
```

and recommends targeted assertions for the surviving mutants.

**Mutation runners are NOT shipped by this slice.** Follow-up FEAT if usage demonstrates value.

## Severity tiering

| Severity | Meaning | Gate |
|----------|---------|------|
| HIGH | Hard flaky heuristic OR assertion-free OR tautological assert | Advisory — qa-expert applies judgment; confirmed findings should block merge |
| MEDIUM | Soft flaky signal, over-mocking | Recommend fix; not blocking |
| ADVISORY | Mutation-testing recommendation | Never blocking |

## Output format

Parallel to `skills/domain/security-sweep/`:

```
[HIGH] tests/foo.test.ts:12 — Flaky heuristic: hard-coded sleep
[MEDIUM] tests/bar.test.ts:7 — Soft flaky signal: test name contains "async"
[HIGH] tests/baz.test.ts:3 — Assertion-free test: "does the thing"
```

One finding per line to stdout. No trailing blank lines. The qa-expert handoff `--findings` count
should add these to the coverage-gap count.

Observability line (stderr, only when `--emit-observability` is passed):

```
TEST-QUALITY analyze complete: 5 findings (H=3 M=2 L=0 A=0)
```

## Done / Acceptance

A qa-expert run using this lens is complete when:

- Zero **unconfirmed** HIGH findings remain on critical-path modules (either confirmed+fixed or
  confirmed+accepted-risk documented in handoff `--risks`).
- All MEDIUM findings either fixed or carry an accepted-risk note.
- Mutation-testing advisory acknowledged when the slice touches a critical-path module.
- Verdict set to `quality_concerns` when any HIGH finding fires (even if advisory-only after judgment).
