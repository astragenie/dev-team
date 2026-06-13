---
id: SLICE-75
title: "qa-expert test-quality lens: flaky-test detection + anti-pattern scan + mutation-testing quality bar"
status: completed
feature: FEAT-139
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-13
updated: 2026-06-13
developer_type: mixed
estimated_complexity: medium
languages: [markdown, typescript]
autonomous_safe: false
completed_at: 2026-06-13
badges: [serial-reviewer-warning]
---
# SLICE-75: qa-expert test-quality lens — flaky-test detection + anti-pattern scan + mutation-testing quality bar

Implements **all 3 lenses** from FEAT-139. See [feature file](../../../../backlog/in-progress/FEAT-139.md) for product context.

`autonomous_safe: false` per FEAT-139 frontmatter — skill authorship + qa-expert agent prompt edit require human-in-loop review before merge. The new workflow skill body, the routing-table row, the executable analyzer script, and the test fixtures are agent-appropriate; the `agents/qa-expert.md` prompt edit (skill-consultation rows + trigger conditions) is the human-gated portion. Calibration evidence (AC-6) gates merge: a lens that fires noise gets ignored, which is the exact failure mode the FEAT-139 pre-mortem warns against.

## Objective

Targets the weakest grade dimension (`test_confidence`, FEAT body cites avg 0.72; current 5-grade snapshot avg = 0.806 per FEAT-139 triage_notes — softened but still worth investing). Add a `qa-expert` review-time lens that goes beyond line coverage by detecting (1) **flaky-test heuristics** (shared state, unawaited async, time/order dependence, retry-masking), (2) **test anti-patterns** (assertion-free tests, over-mocking, tautological asserts), and (3) **mutation-testing quality-bar advisory** (survival analysis cited as evidence; gate stays advisory, NOT blocking).

The lens is invoked by the qa-expert agent when its existing routing fires AND when the new routing-table signal "test suite quality questioned / coverage adequate but confidence low" matches. Findings emitted as `[SEVERITY] file:line — short description` blocks parallel to security-sweep (SLICE-69) so the qa-expert handoff format stays uniform.

**DEC-025 judgment (per spec-writer directive):** Lens 1 (flaky-test heuristics) and Lens 2 (anti-pattern scan) ship as an **executable canonical entry** — `skills/workflow/test-quality/scripts/analyze.ts` invoked by SKILL.md and the integration test. Lens 3 (mutation-testing) ships as **procedural advisory** in SKILL.md prose only because Stryker/PIT/etc. configuration is project-specific and the v1 deliverable is "lens definition + when to ask for mutation-testing evidence", not a mutation runner. Mixed posture is explicit in the SKILL.md `## When to use` section.

**DEC-024 observability ceiling:** This is a review-time advisory lens, not a service. If `analyze.ts` emits any observability signal, it is exactly ONE grep-able stderr line — `TEST-QUALITY analyze complete: <N> findings (H=<n> M=<n> L=<n> A=<n>)` where `A` = advisory (mutation-test recommendations). No JSON, no ULID, no events.jsonl. The line is OPTIONAL on the `analyze.ts` path — emit only when the script is invoked with `--emit-observability` to keep CI noise zero. (Spec leans "emit by default" per security-sweep parity; builder confirms in handoff.)

**DEC-026 preserved-section floor for qa-expert.md:** Current `agents/qa-expert.md` is **118 lines** (no `maxLines:` frontmatter — default cap is 350). Adding ~25-35 lines for new skill-consultation rows + trigger conditions lands at ~143-153 lines. No floor concern — well under cap.

## In scope

### Deliverable 1 — New workflow skill `skills/workflow/test-quality/SKILL.md`

- File path: `skills/workflow/test-quality/SKILL.md` (directory name MUST equal frontmatter `name: test-quality` per `scripts/validate-skills.ts:checkDirectoryName`).
- **Tier: `workflow`** (review-time lens consumed during the review phase, not a domain knowledge base).
- Required frontmatter: `name: test-quality`, `tier: workflow`, `description` (one sentence describing the 3 lenses + when to load).
- Recommended frontmatter: `owner: hero-crew`, `last_reviewed: 2026-06-13`, `triggers: test-quality, flaky-test, flakiness, test-anti-pattern, assertion-free, over-mocking, tautological-assert, mutation-testing, mutation-score, test-confidence`.
- Body MUST include `## When to use` heading AND `## Done` (or `## Acceptance`) heading per `validate-skills.ts:checkSectionHeadings` warnings.
- **≤ 200 lines hard cap** per `scripts/validate-skills.ts:MAX_LINES`.
- Required sections:
  1. **When to use** — invoked by `qa-expert` when (a) the routing signal "test suite quality questioned / coverage adequate but confidence low" matches, OR (b) qa-expert's existing test-coverage analysis returns `coverage_adequate` but `test_confidence` grade has been below 0.80 in the last 5 grades.
  2. **Lens 1 — Flaky-test detection (executable).** Canonical entry: `bun skills/workflow/test-quality/scripts/analyze.ts --target <repo-path> [--changed-only]`. Heuristic pattern set (apply per test-file):
     - `setTimeout\(.*,\s*0\)` — zero-delay timer often used to defer assertions; flaky on slow CI.
     - `\bsleep\(\s*\d+\s*\)` or `await new Promise\(.*setTimeout.*\)` — hard-coded sleep.
     - `await Promise\.resolve\(\)` mid-test — micro-task hop, fragile under runner concurrency.
     - `\bDate\.now\(\)\b` or `new Date\(\)` in test body without mock — wall-clock dependence.
     - `\bMath\.random\(\)` in test body without seed — non-deterministic.
     - Test name regex `/\b(eventually|sometimes|flak|timing|async)\b/i` — soft signal; flag as advisory.
     - Shared module-scope variable declared OUTSIDE `describe`/`beforeEach` and mutated inside `test(...)` — shared state.
     - `process\.env\.[A-Z_]+` read inside test body without `beforeEach`/`afterEach` reset — env leak.
     - Each match emits `[HIGH] file:line — Flaky heuristic: <pattern label>` (the seven hard signals). Soft signals (test-name regex, shared module state) emit `[MEDIUM]`.
  3. **Lens 2 — Test anti-pattern scan (executable).** Same analyzer, additional patterns:
     - Assertion-free test: a `test(...)` or `it(...)` body containing NO call matching `(expect|assert|should|toBe|toEqual|toHave|toBeTruthy|toBeFalsy|toThrow|resolves|rejects)\(` — emits `[HIGH] file:line — Assertion-free test: <test name>`.
     - Tautological assert: `expect\(true\)\.toBe\(true\)` / `expect\(1\)\.toBe\(1\)` / `expect\(x\)\.toBe\(x\)` literal-equals-literal — emits `[HIGH]`.
     - Over-mocking: a single `test(...)` body containing ≥ 5 `(jest|vi|mock)\.(mock|fn|spyOn)\(` calls — emits `[MEDIUM]`.
     - The 3 anti-patterns above are the v1 set. Out-of-scope: detecting "tests that never fail because they catch their own throw" (judgment-heavy).
  4. **Lens 3 — Mutation-testing quality bar (procedural).** No script execution. Skill prose only:
     - When qa-expert is reviewing a critical-path module (auth, payment, state mutation, security primitives), recommend that the builder produce a mutation-testing survival report (Stryker for TS/JS, mutmut for Python, PIT for JVM). Advisory only — qa-expert MUST NOT block merge for missing mutation report.
     - If a mutation report is provided, qa-expert reports surviving mutants as `[ADVISORY] mutation-survival: <count> mutants survived in <module>` and recommends targeted assertions.
     - Document "mutation runners are NOT shipped by this slice" explicitly. The lens is a vocabulary for asking-for-evidence, not a runner.
  5. **Severity tiering**
     - **HIGH** — Hard flaky-test heuristic (sleep/timer/wall-clock/non-seed-random/shared-state) OR assertion-free test OR tautological assert. Blocks merge if confirmed by reviewer (qa-expert applies judgment — heuristic ≠ confirmed).
     - **MEDIUM** — Soft flaky signal (test name regex, env-leak), over-mocking (≥5 mocks per test). Advisory — recommend fix but not blocking.
     - **ADVISORY** — Mutation-testing recommendation (lens 3 only). Never blocking.
  6. **Output format (parallel to security-sweep)**: `[SEVERITY] file:line — short description` per finding to stdout, one finding per line. The qa-expert handoff's `--findings` count merges these with existing coverage findings.
  7. **Observability emit** — exactly ONE stderr line at scan end (when `--emit-observability` is passed): `TEST-QUALITY analyze complete: <N> findings (H=<n> M=<n> L=<n> A=<n>)` (DEC-024). No JSON, no ULID, no timestamps.
  8. **Done / Acceptance** — exit conditions for a clean run: zero unconfirmed HIGH findings on critical-path modules, all MEDIUM findings either fixed or carry an accepted-risk note in the qa-expert handoff's `--risks` field, mutation-testing advisory acknowledged when the slice touches a critical-path module.

### Deliverable 2 — Bun helper script `skills/workflow/test-quality/scripts/analyze.ts`

Canonical entry that SKILL.md cites for Lens 1 + Lens 2. Owns the executable behavior so test fixtures + skill prose share one source of truth (DEC-025 — avoids the `security-advisory/SKILL.md` orphan anti-pattern called out in SLICE-69 grade).

- Path: `skills/workflow/test-quality/scripts/analyze.ts` (Bun + TypeScript per repo standard; mirror security-sweep `scan.ts` shape).
- CLI surface: `bun analyze.ts --target <path> [--changed-only] [--diff-base <ref>] [--emit-observability]`. No interactive prompts. No network. No `process.exit()` from library functions — use `process.exitCode = N; return;` per SLICE-69 ban.
- Responsibilities:
  1. Resolve target file set: when `--changed-only` + `--diff-base` are passed, scope to `git diff --name-only <ref>` filtered to `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx`, `*.spec.ts`, `*.spec.tsx`, `*.spec.js`, `*.spec.jsx`, `*_test.py`, `test_*.py`. Otherwise scan ALL test files under `--target`.
  2. Apply Lens 1 (flaky-test) and Lens 2 (anti-pattern) regex set to each test file body; emit `[SEVERITY] file:line — description` blocks per finding to stdout.
  3. (Optional, when `--emit-observability` is set) emit exactly ONE stderr line at scan end matching `/^TEST-QUALITY analyze complete: \d+ findings \(H=\d+ M=\d+ L=\d+ A=\d+\)$/`.
  4. Exit codes: `0` = zero HIGH findings, `1` = at least one HIGH finding, `2` = scan tooling failure (e.g. unreadable target). Set via `process.exitCode`, NOT `process.exit()`.
- Hard cap: **≤ 200 lines TS**. No `any` casts, no floating Promises, no `as` casts on caught errors (use `unknown` narrowing per SLICE-69 reviewer feedback).
- SKILL.md MUST cite this script as the canonical entry, not just "write one yourself".

### Deliverable 3 — qa-expert agent prompt edit in `agents/qa-expert.md`

- Add ONE row to the `## Skills you consult` section table (currently lines 31-35 in qa-expert.md): `Test quality lens (flaky / anti-pattern / mutation advisory) — when coverage looks adequate but test_confidence grade < 0.80 OR routing signal "test suite quality questioned" fires → \`skills/workflow/test-quality/\``.
- Add ONE bullet to the `## Focus areas` section (currently lines 21-29): `Test quality lens — flaky-test heuristics (timer/sleep/wall-clock/non-seed-random/shared-state), anti-pattern scan (assertion-free, tautological assert, over-mocking), mutation-testing advisory for critical-path modules` (extend the existing "Anti-flakiness review" bullet OR add a new bullet — builder judgment).
- Update `## Output` verdict enum (currently lines 39-42): add `quality_concerns` to the verdict set, between `gaps_found` and `blocking_gaps`. Definition: `quality_concerns` = lens fired HIGH findings on test-quality dimensions even when coverage is adequate. Document that `quality_concerns` is NOT auto-blocking; qa-expert applies judgment whether to escalate.
- Stay under default 350-line `maxLines` cap. Current is **118 lines**; budget allows +30 lines comfortably. Validator: `scripts/validate-agents.ts`.

### Deliverable 4 — New routing-table row in `docs/routing-table.md`

ONE new row, placed under the **Review + quality gates** section table (between current "Diff under review (any code-bearing change)" row at line 51 and the next section header). Format must match the existing 3-column `| Signal | Route to | Notes |` shape.

- **Signal:** `**Test suite quality questioned** (coverage looks adequate but test_confidence grade < 0.80 across recent slices, or reviewer suspects flaky / anti-pattern / weak-assertion tests)`
- **Route to:** `qa-expert via **\`skills/workflow/test-quality/\`**`
- **Notes:** `Loads the test-quality lens — flaky-test regex set (timer/sleep/wall-clock/non-seed-random/shared-state), anti-pattern scan (assertion-free, tautological assert, over-mocking), and mutation-testing advisory for critical-path modules. Findings emitted as \`[SEVERITY] file:line\` blocks parallel to security-sweep. Advisory tier — does NOT auto-block merge; qa-expert applies judgment via the \`quality_concerns\` verdict.`

Row must pass routing-table lint (`CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts`) — advisory, but should not introduce new failures (baseline: 46 pre-existing failures per SLICE-69 grade; new row must not bump that count).

### Deliverable 5 — Test fixtures + integration test

Three small fixtures + ONE integration test that exercises Lens 1 and Lens 2 against them. (Lens 3 is procedural — no fixture needed.)

- **Fixture A — Planted flaky test:** `tests/fixtures/test-quality/planted-flaky.test.ts`. Contents:
  ```ts
  import { test, expect } from "bun:test";
  let sharedCounter = 0; // shared module-scope mutation — HIGH
  test("eventually completes", async () => {       // soft signal in name — MEDIUM
    await new Promise((r) => setTimeout(r, 100));   // hard-coded sleep — HIGH
    sharedCounter += 1;
    expect(sharedCounter).toBeGreaterThan(0);
  });
  ```
  Expected findings on this fixture: 1 HIGH (sleep) + 1 HIGH (shared module-scope mutation) + 1 MEDIUM (test name regex). Builder may tune fixture to exactly hit these counts.
- **Fixture B — Planted assertion-free test:** `tests/fixtures/test-quality/planted-no-assert.test.ts`. Contents:
  ```ts
  import { test } from "bun:test";
  test("does the thing", () => {
    const x = 1 + 1;
    console.log(x); // no expect/assert call — HIGH
  });
  ```
  Expected findings: 1 HIGH (assertion-free test).
- **Fixture C — Planted tautological assert + over-mocking:** `tests/fixtures/test-quality/planted-tautology.test.ts`. Contents:
  ```ts
  import { test, expect, mock } from "bun:test";
  test("trivially true", () => {
    expect(true).toBe(true); // tautological — HIGH
    mock(() => 1); mock(() => 2); mock(() => 3); mock(() => 4); mock(() => 5); // over-mocking ≥5 — MEDIUM
  });
  ```
  Expected findings: 1 HIGH (tautology) + 1 MEDIUM (over-mocking).
- **Integration test:** `tests/test-quality-integration.test.ts` — Bun test that:
  1. Invokes `bun skills/workflow/test-quality/scripts/analyze.ts --target tests/fixtures/test-quality --emit-observability` via `spawnSync`.
  2. Asserts stdout contains exactly the expected counts of `[HIGH]` and `[MEDIUM]` findings per fixture above (use `stdout.split("\n").filter(l => l.startsWith("[HIGH]")).length` style assertions).
  3. Asserts stderr contains exactly one line matching `/^TEST-QUALITY analyze complete: \d+ findings \(H=\d+ M=\d+ L=\d+ A=\d+\)$/`.
  4. Asserts the script exited with code `1` (because HIGH findings present).
- **MUST exclude the fixtures from the regular test suite run** — they are inputs to the analyzer, not real tests. Add `tests/fixtures/**` to `bunfig.toml` test exclude (or rename to `.fixture.ts` extension if exclude is awkward). Confirm `bun test --parallel` does NOT execute them as real tests after the change.

### Deliverable 6 — Calibration evidence artifact (gates AC-6)

Counters the FEAT-139 silent-failure pre-mortem ("lens fires false positives, reviewer learns to ignore"). REQUIRED for merge.

- Path: `.claude/artifacts/loop/calibration/20260613T-test-quality-calibration.md` (date stamp at build time; builder may use the actual UTC at calibration).
- Procedure: run `bun skills/workflow/test-quality/scripts/analyze.ts --target tests/` (the WHOLE hero-crew test tree, NOT just fixtures) and document:
  1. Total findings emitted: `<N>` by severity.
  2. For each finding, mark `true_positive` | `false_positive` | `accepted_advisory` by inspection of the cited `file:line`. (Builder applies judgment; document the reasoning in one sentence per finding.)
  3. **False-positive rate** = `false_positive_count / total_findings_excluding_fixtures`. (Exclude `tests/fixtures/test-quality/**` from the denominator since those are planted to trigger.)
  4. **Acceptance threshold: false-positive rate < 20%.** If above 20%, the slice MUST tune the regex set BEFORE merge (cut over-eager patterns, demote false-positive-heavy heuristics from HIGH to MEDIUM, OR scope `--changed-only` as the default mode). Re-run calibration after tuning; document both rounds.
  5. Cross-reference: run the analyzer against the 5 most-recently completed slices' touched test files (SLICE-69, SLICE-71, SLICE-72, SLICE-73, SLICE-74 per `git log --name-only`). Document what the lens would have said. Threshold: zero finding on a slice that landed cleanly = good; > 2 findings on a clean slice = noise risk, tune before merge.
- Artifact body: include the raw analyzer output + the inspection table + the calculated rate + the merge verdict (`calibrated: pass` / `calibrated: tuned-then-pass` / `calibrated: blocked`).

## Out of scope

- **Live mutation-testing runtime** — no Stryker / mutmut / PIT installation, no mutation-survival reports generated by this slice. Lens 3 ships as prose vocabulary only; the runner is a follow-up FEAT if usage demonstrates value.
- **Replacing existing tests** — the lens reports; it does not auto-fix. Builders fix flagged tests in follow-up slices.
- **Auto-fixing detected issues** — no codemods, no rewrites. Findings are advisory output that humans/builders act on.
- **Heavyweight observability** — single stderr line at most per DEC-024. No JSON, no ULID, no events.jsonl wiring. No new entries to `.claude/logs/`.
- **Replacing qa-expert's existing coverage-gap analysis** — the test-quality lens is ADDITIVE. Coverage analysis (`gaps_found` / `blocking_gaps` / `coverage_adequate` verdict) stays. New `quality_concerns` verdict is parallel.
- **A separate `agents/test-quality-reviewer.md` agent** — no new agent. qa-expert loads the skill; that is sufficient.
- **Pattern tuning beyond the v1 regex set** — accepted-risk per FEAT-139 pre-mortem. Tuning lands in a follow-up SLICE if calibration shows specific patterns are noisy in the field after first week of usage.
- **Python test-quality patterns beyond pytest naming** — Lens 1 + Lens 2 are TS-first. Python tests are matched by filename glob, but the regex set is TS-shaped (the over-mocking patterns target `jest`/`vi`/`mock` not `unittest.mock`). Python-specific patterns are a follow-up SLICE.
- **The `crew:verifier` full-gate** — verifier still runs the standard suite. Test-quality is a qa-expert review-time concern, not a verifier concern. (Verifier may pick up the lens in a later slice when it grows out of advisory.)
- **Any change to `agents/verifier.md`, `agents/inspector.md`, `agents/fullstack-dev.md`** — only `agents/qa-expert.md` is in scope.

## Acceptance criteria

- [ ] **AC-1: Skill file + analyzer script exist and validate.** Given the repo at HEAD, When `node ./scripts/validate-skills.ts` runs, Then exit code is `0` AND the skill count is exactly ONE greater than the pre-slice baseline. Pass-fail: `test -f skills/workflow/test-quality/SKILL.md && test -f skills/workflow/test-quality/scripts/analyze.ts && [ $(wc -l < skills/workflow/test-quality/SKILL.md) -le 200 ] && [ $(wc -l < skills/workflow/test-quality/scripts/analyze.ts) -le 200 ] && node ./scripts/validate-skills.ts; echo $?` returns `0`.

- [ ] **AC-2: Skill frontmatter shape.** Given `skills/workflow/test-quality/SKILL.md`, When parsed as YAML frontmatter, Then `name == "test-quality"`, `tier == "workflow"`, `description` non-empty, `triggers` field contains at minimum the strings `flaky-test`, `test-anti-pattern`, `mutation-testing`. Pass-fail: `grep -E "^name: test-quality$" skills/workflow/test-quality/SKILL.md` returns 1 match AND `grep -E "^tier: workflow$"` returns 1 match AND `grep -E "^triggers:.*flaky-test"`, `grep -E "^triggers:.*test-anti-pattern"`, `grep -E "^triggers:.*mutation-testing"` each match.

- [ ] **AC-3: qa-expert prompt edited — skill row + verdict enum + line cap respected.** Given `agents/qa-expert.md` after the slice, When grepped, Then it cites the new skill, mentions the test-quality trigger condition, AND adds the `quality_concerns` verdict to the output section. Pass-fail: `grep -c "skills/workflow/test-quality/" agents/qa-expert.md` ≥ 1 AND `grep -c "quality_concerns" agents/qa-expert.md` ≥ 1 AND `[ $(wc -l < agents/qa-expert.md) -le 350 ]` AND `node ./scripts/validate-agents.ts` exits `0`. Post-edit floor measurement: builder MUST run `wc -l agents/qa-expert.md` BEFORE and AFTER the edit and include both numbers in the handoff per DEC-026.

- [ ] **AC-4: Routing-table row added with concrete signal phrase + skill path + advisory framing.** Given `docs/routing-table.md`, When grepped, Then the new signal phrase, the skill path, and the advisory framing are all present. Pass-fail: `grep -c "Test suite quality questioned" docs/routing-table.md` ≥ 1 AND `grep -c "skills/workflow/test-quality/" docs/routing-table.md` ≥ 1 AND `grep -c "quality_concerns" docs/routing-table.md` ≥ 1 AND `CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts` does not introduce NEW failures beyond the pre-slice baseline (46 pre-existing per SLICE-69 grade — confirm via `git stash && node ./scripts/validate-routing-table.ts | grep -c ERROR && git stash pop`).

- [ ] **AC-5: Integration test green — fixtures produce expected findings.** Given the three planted fixtures (`tests/fixtures/test-quality/planted-{flaky,no-assert,tautology}.test.ts`), When `bun test tests/test-quality-integration.test.ts --parallel --timeout 30000` runs, Then exit code is `0` AND the test assertions confirm: (a) Fixture A produces at least 2 `[HIGH]` findings + at least 1 `[MEDIUM]` finding; (b) Fixture B produces exactly 1 `[HIGH]` (assertion-free); (c) Fixture C produces 1 `[HIGH]` (tautology) + 1 `[MEDIUM]` (over-mocking); (d) `analyze.ts` exited with code `1` because HIGH findings present. Pass-fail: `bun test tests/test-quality-integration.test.ts; echo $?` returns `0`. ALSO: `bun test --parallel` whole-suite does NOT execute the fixtures as real tests (verify via test count diff or fixture-exclude config — fixture filename pattern OR `bunfig.toml` exclude).

- [ ] **AC-6: Calibration evidence artifact gates merge.** Given `analyze.ts` is run against the whole hero-crew `tests/` tree (excluding `tests/fixtures/test-quality/**`), When the false-positive rate is calculated by builder inspection, Then the rate is **strictly less than 20%** AND the artifact at `.claude/artifacts/loop/calibration/<UTC-stamp>-test-quality-calibration.md` exists with the raw analyzer output, the per-finding `true_positive` / `false_positive` / `accepted_advisory` tag, the rate calculation, and the merge verdict `calibrated: pass` (or `calibrated: tuned-then-pass` if the regex set was tuned during calibration). Pass-fail: `test -f .claude/artifacts/loop/calibration/*-test-quality-calibration.md` AND `grep -E "^calibrated: (pass|tuned-then-pass)$" .claude/artifacts/loop/calibration/*-test-quality-calibration.md` matches AND the artifact body cites a false-positive rate < 0.20. Cross-reference: the artifact MUST document the analyzer's verdict on the last 5 completed slices' touched test files (SLICE-69 / SLICE-71 / SLICE-72 / SLICE-73 / SLICE-74) and confirm `> 2 findings on a clean slice` did NOT occur OR the noisy patterns were tuned out.

- [ ] **AC-7: Observability emit shape — one grep-able stderr line per scan invocation.** Given the integration test in AC-5, When `analyze.ts` is invoked with `--emit-observability`, Then exactly one line is emitted to stderr matching `/^TEST-QUALITY analyze complete: \d+ findings \(H=\d+ M=\d+ L=\d+ A=\d+\)$/`. Plugin context: no JSON, no timestamps, no event-stream wiring (DEC-024). Pass-fail: the integration test asserts `stderr.split("\n").filter(l => /^TEST-QUALITY analyze complete:/.test(l)).length === 1`. When `--emit-observability` is NOT passed, stderr is empty for a clean run (no noise on default invocation).

- [ ] **AC-8: Full local gate green — no regressions in unrelated suites.** Given the post-slice tree, When `bun run lint && bun run format:check && bun run typecheck && bun test --parallel --timeout 30000 && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && node ./scripts/validate-manifests.ts` runs, Then exit code is `0` for each step. Pass-fail: the chained command returns `0`. ALSO confirm `process.exit()` is NOT used anywhere in `analyze.ts` (per SLICE-69 ban from DEC carry-over) — use `process.exitCode = N; return;` pattern.

## Done When

- all 8 acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass (`bun test --parallel`, `bun run lint`, `bun run typecheck`, `node ./scripts/validate-skills.ts`, `node ./scripts/validate-agents.ts`)
- feature FEAT-139 moved from `in-progress/` to `done/` (single-slice FEAT — no `--keep-feature-open` needed per DEC-020)
- Crew `final-synthesis` artifact written
- Calibration artifact at `.claude/artifacts/loop/calibration/*-test-quality-calibration.md` committed with `calibrated: pass` or `calibrated: tuned-then-pass` verdict
- `requires_validation: true` retained — AC-5 integration test + AC-6 calibration evidence are behavior verification and MUST be executed by the verifier independently of the inspector pre-flight (NOT a refactor slice — do NOT waive)

## Reviewer ladder

- **Reviewer A (`crew:inspector`):** false-positive risk + structural compliance focus. Do the heuristic regex patterns in `analyze.ts` actually catch the patterns described in SKILL.md prose, or over-generalize (e.g. `Date.now()` in test SETUP being fine vs in test BODY being flaky — does the analyzer distinguish?)? Are the routing-table row and qa-expert prompt edit factually correct against the skill body (no signal/route drift)? Are all line caps respected (SKILL.md ≤ 200, analyze.ts ≤ 200, qa-expert.md ≤ 350)? Does `analyze.ts` avoid the SLICE-69 banned patterns (`process.exit()`, `as` casts on caught errors, `any`, floating Promises)? Are the three planted fixtures EXCLUDED from the real test suite so they don't pollute `bun test --parallel`? Is the calibration artifact's false-positive rate calculation honest (denominator excludes fixtures correctly)? Skills to consult: `skills/workflow/reviewing-code/`, `plugin-dev:skill-reviewer` (skill shape changed), `plugin-dev:agent-development` (qa-expert prompt changed).

- **Reviewer B (`crew:qa-expert`):** domain reviewer for test-quality lens semantics. Open question flagged for human gate: this is a self-review (qa-expert reviewing edits to its own prompt). Inspector should escalate to human if Reviewer B output looks rubber-stamped. Concerns: (1) are the 3 heuristic categories (flaky / anti-pattern / mutation) well-defined and non-overlapping with existing coverage-analysis output? (2) is mutation-testing positioned correctly as advisory NOT blocking — does the SKILL.md prose unambiguously say "qa-expert MUST NOT block merge for missing mutation report"? (3) will the lens produce signal vs noise on real PRs — does the calibration evidence in AC-6 actually demonstrate < 20% false-positive rate on the live `tests/` tree, not just the planted fixtures? (4) is the `quality_concerns` verdict definition unambiguous so future qa-expert sessions know when to use it vs `gaps_found`? (5) does the `--changed-only` flag default to ON or OFF, and is that the right default for review-time invocation (lean toward `--changed-only` ON to scope noise)? Skills to consult: `skills/domain/backend-advisory/` test-pyramid section, `skills/domain/react-engineering/` Testing Library patterns for non-TS-specific noise.

---

## Spec-writer notes (informational — not for builder)

**developer_type verdict: `mixed`** — analogous to SLICE-69. The skill body + analyzer script + routing-table row + test fixtures + calibration artifact are agent-appropriate. The qa-expert agent prompt edit is the autonomous_safe = false portion (per CLAUDE.md governance + FEAT-139 frontmatter). Human gate at inspector phase.

**Lenses shipped (per FEAT-139 deliverables):**
1. Flaky-test detection — EXECUTABLE (`analyze.ts` regex set).
2. Test anti-pattern scan — EXECUTABLE (`analyze.ts` regex set, additional patterns).
3. Mutation-testing quality bar — PROCEDURAL (SKILL.md prose only; no runner).

**DEC-025 judgment:** Mixed posture. Lenses 1 + 2 ship executable per DEC-025 because the heuristics are regex-scannable. Lens 3 ships procedural because mutation-runner config is project-specific and the v1 deliverable is vocabulary, not infrastructure. Both decisions documented in SKILL.md `## When to use`.

**DEC-024 posture:** Single optional stderr line via `--emit-observability` flag. Default invocation is silent (zero CI noise). DEC-024 ceiling respected.

**DEC-026 floor check:** qa-expert.md is 118 lines currently; cap is 350; adding ~30 lines lands at ~150. No floor risk. AC-3 still requires builder to measure pre/post line count to document the actual delta.

**Open questions / risks for human reviewer at merge gate:**
1. **Self-review concern (Reviewer B):** qa-expert reviewing its own prompt edits creates rubber-stamp risk. The inspector (Reviewer A) is the actual independent gate; if both reviewers approve and the calibration evidence is honest, the slice is mergeable. Consider for v2: route Reviewer B to `crew:3rdparty:test-automator` instead, since test-automator is the implementer pair for qa-expert and applies the patterns from a different angle (per `agents/3rdparty/test-automator.md` line 16 — "scenarios from a qa-expert handoff").
2. **Fixture exclusion mechanism uncertain:** the slice asks the builder to either (a) add `tests/fixtures/**` to `bunfig.toml` test exclude or (b) rename fixtures to a non-`.test.ts` extension. Builder picks; reviewer confirms `bun test --parallel` doesn't count fixtures as tests post-change.
3. **Calibration target tree size unknown:** if `tests/` tree is small (analyzer finds 0-1 findings), the false-positive rate calculation is statistically weak. Acceptable for v1 — the threshold is a guardrail, not a statistical proof.
4. **Regex set is TS-first.** Python test patterns get matched by glob but the over-mocking regex (`jest|vi|mock`) won't fire on `unittest.mock`. Flagged in Out-of-scope; follow-up SLICE if Python coverage matters.
5. **Pre-existing routing-table validator failures (46 baseline).** AC-4 only asks for "no NEW failures introduced" — does NOT ask to fix the baseline. That is FEAT scope drift if attempted in this slice.
