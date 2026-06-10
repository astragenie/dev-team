# Slice Pipeline Speedup — Design

- **Date:** 2026-06-10
- **Status:** approved (brainstorm gate passed)
- **Owner:** pm_milashico
- **Approach:** A — staged, ceremony-first, Bun behind a compat gate

## Problem

The full crew/loop workflow per slice is too slow, especially for plugin repos. Measured baseline (FEAT-133, cost telemetry): **~43 min wall-clock, 195 messages, 8 sequential subagent dispatches, ~$80–90/slice.** Tooling profile: full test suite **115.9s** (573 tests / 60 files), lint 1.9s, typecheck 3.9s, crew CLI startup 0.17s. The long pole inside the suite is `tests/cli.test.ts`: 5 tests at 17–23s each, because nearly every assertion spawns `node --experimental-strip-types crew.ts` as a subprocess, re-parsing the 85-file script graph per spawn. Slice wall-clock is ~80% LLM ceremony (sequential dispatches, LLM-authored artifacts), ~15–20% tooling.

## Goals & success criteria

1. Slice wall-clock ~43 min → **≤25 min (-40%)**, verified via cost-report telemetry (`durationMin`, `messages`, `subagentDispatches`) over 3 consecutive slices after full rollout.
2. Full quality-gate tooling: 116s → **<30s** (achieved at 21.1s by WS1 alone; WS3 resolved no-go per ADR-002).
3. Quality floor: review + validation gates remain mandatory; no grade dimension drops more than 0.05 from the recent baseline (architecture_quality 0.76, reliability 0.78, observability 0.756, production_readiness 0.784, security 0.77, test_confidence 0.76, product_completeness 0.81).

## Non-goals

- Reducing scope or rigor of quality gates (review, validation, full-suite run).
- Prompt-slimming workstream (explicitly deferred by user).
- Cost ($/slice) as the primary metric — it improves as a side effect.

## WS1 — Kill the test long-pole (node-only, lands first)

- Export an in-process entry point `runCrew(argv, opts): Promise<{code, stdout}>` from the crew CLI lib. Convert `tests/cli.test.ts` assertions from subprocess spawns to in-process calls.
- Keep **one real spawn smoke test per command family** (claims, approvals, artifacts, synthesis, cost) covering exit codes, stdout hygiene, and process wiring.
- Split `cli.test.ts` into per-command-family files so `node --test` parallelizes across cores.
- Expected: 116s → ~25–35s. Pays off on every validator gate and fix bounce immediately, before Bun.
- Risk: in-process tests can mask process-level bugs. Mitigation: the per-family spawn smokes.

### Acceptance Criteria — WS1

**AC-WS1-1:** In-process entry point is exported.
- Given: crew CLI lib (`scripts/crew.ts` or related export)
- When: a test imports and calls `runCrew(argv, opts)` with valid argv array and options object
- Then: the function returns a Promise resolving to `{code: number, stdout: string}`; exit code is 0 for successful commands

**AC-WS1-2:** Subprocess spawns removed from main assertions.
- Given: `tests/cli.test.ts` and any split per-command files
- When: `npm test` runs
- Then: zero subprocess `execFile` calls remain in core test assertions (only spawn smoke tests retain them; grep for `execFile.*crew.ts` should find ≤5 per command family)

**AC-WS1-3:** Test parallelization confirmed.
- Given: test suite split into per-command-family files (e.g., `tests/cli-claims.test.ts`, `tests/cli-artifacts.test.ts`)
- When: `npm test` runs on a multi-core machine
- Then: test suite wall-clock time drops to ≤40s (interim node-only target; end-state <30s arrives with WS3); cost report `durationMin` field confirms <1 min

**AC-WS1-4:** Process-level regressions caught by smoke tests.
- Given: at least one real spawn smoke test per command family
- When: a smoke test runs (e.g., `claim` command, `write-run-brief`)
- Then: assertions check exit code is 0, stdout is valid JSON or plain text (no garbled output), process does not hang or corrupt state

## WS2 — Ceremony (the big lever)

### 2a. Parallel gates

After builder PASS, lead/orchestrate-slice dispatches reviewer and validator **concurrently** instead of sequentially. Conflict rule: if reviewer returns `needs_fix`, the validation result is marked stale and the fix bounce reruns the validator. Saves one dispatch round-trip (~5–10 min/slice). Touches `agents/lead.md`, `commands/orchestrate-slice.md`, loop dispatch instructions. Workflow-state gate-badge writes must be merge-safe under concurrent writers.

### 2b. Templated artifacts

New `--scaffold` mode on the `crew.ts write-*` commands: emits the complete artifact skeleton (frontmatter, section headers, gate fields, file lists pulled from git) deterministically; the agent fills only judgment fields via the existing idempotent `--update` path (direct extension of the front-loaded stub-artifact machinery). Cuts artifact-authoring messages per dispatch.

### 2c. Skip-tier

Lead classifies each slice at start: `tier: full | light` via deterministic rules (docs-only diff, or ≤50 changed lines (initial value, tunable via loop.json), and no hook/runtime/manifest files touched → light). Light ladder = builder → **one combined review+validate dispatch** (single agent performs lens review and runs the full gate). The full-suite gate itself is never skipped — it runs inside the combined dispatch. Misclassification guard: any `needs_fix` on a light slice promotes the fix bounce to the full ladder. Tier recorded in the run brief.

### Acceptance Criteria — WS2

**AC-WS2-1:** Parallel gate dispatch invokes reviewer and validator concurrently.
- Given: a slice reaches builder PASS state (review_decision not yet set)
- When: `lead.md` or `orchestrate-slice.md` triggers the review + validation phase
- Then: both reviewer and validator agents are dispatched simultaneously (same lead turn or via Promise.all equivalent); cost report shows 2 concurrent subagentDispatches in the same timeframe (not sequential)

**AC-WS2-2:** Validator re-runs if reviewer returns `needs_fix`.
- Given: reviewer marks slice NEEDS_FIX while validator is in-flight
- When: reviewer result is committed and validation result is read
- Then: validation result is marked stale in workflow-state; fix bounce reruns validator after builder re-passes (full ladder, not combined)

**AC-WS2-3:** Scaffold mode emits deterministic artifact templates.
- Given: `crew.ts write-review-result --scaffold --repo <path>` is invoked for a slice
- When: the command completes
- Then: artifact file created at the expected path contains frontmatter (slice, feature, decision fields empty/null), section headers (verdict, test summary, notes), and file lists from git (no agent-written prose)

**AC-WS2-4:** Light-tier slice combined review+validate dispatch completes.
- Given: a slice is classified as `tier: light` (docs-only or ≤50 lines, no hooks/manifests touched)
- When: builder PASS is reached
- Then: a single combined review+validate agent is dispatched (not two separate); the agent runs the full gate suite internally and returns both review_decision and validation_decision in one result

**AC-WS2-5:** Misclassification escalates light slice to full ladder on `needs_fix`.
- Given: a slice initially classified as `tier: light` returns `needs_fix` in the combined gate
- When: the builder's fix bounce is triggered
- Then: the fix bounce uses the full ladder (separate reviewer and validator), not the combined dispatch

**AC-WS2-6:** Workflow-state badge writes are merge-safe under concurrency.
- Given: reviewer and validator write to `.claude/state/crew/` concurrently (both updating gate-badge fields)
- When: both writes complete without explicit locking
- Then: the final state reflects both results correctly (no lost updates; last-write-wins per field is acceptable if documented, or a per-gate field lock is used)

## WS3 — Bun runtime swap (gated by spike)

**Resolved 2026-06-10 — HYBRID (ADR-002 as amended).** Spike on Bun 1.3.14/Windows: initial run criterion 1 red (402/611 tests, 33.9s). Parallel-mode re-run (`bun test --parallel --timeout 30000`) green: 611/611 discovered and passing, 16.5s vs 21.1s on node (~22% faster). Criteria 2–4 green throughout. Amended decision: ADOPT hybrid — `npm test` runs `bun test --parallel --timeout 30000` for dev/CI (Bun 1.3+ required for contributors/CI; `test:node` escape hatch retained); consumer surfaces (hooks, crew.ts CLI on user machines) stay on Node — no measured win there and real blast radius. Greenfield status (few consumers) noted but not load-bearing. See docs/architecture/decisions/ADR-002-bun-runtime-no-go.md.

Compat spike timeboxed to one slice; ALL exit criteria must be green **on Windows**:

1. Test suite under Bun (either `bun test` migration cost assessed, or Bun's `node:test` compat proven) — 573 tests green.
2. `crew.ts` CLI under Bun: `child_process` spawns, fs semantics, stdout hygiene, exit codes.
3. Hooks invoked via Bun end-to-end in a sample repo (`e2e-smoke`).
4. TS execution parity — Bun runs TS natively; `--experimental-strip-types` flags dropped.

If green: swap in order **dev scripts → CI → consumer hooks/CLI**, with a `runtime: node|bun` fallback flag in crew config for one release; README + marketplace gain Bun install instructions; ships as a minor release. If any criterion is red: stay hybrid (Bun for dev/CI, node for consumers), record a DEC, revisit on the next Bun release.

### Acceptance Criteria — WS3

**AC-WS3-1:** Test suite runs under Bun on Windows.
- Given: 573 tests in the crew suite
- When: `bun test` (or `bun run test` equivalent) is invoked on Windows
- Then: all 573 tests pass with the same exit code 0 as node's `npm test`; pass count and assertion count match or exceed node baseline

**AC-WS3-2:** Bun CLI respects process contracts (child_process, fs, stdout, exit codes).
- Given: key CLI commands (`init`, `bootstrap`, `claim`, `write-run-brief`)
- When: each is invoked via Bun (e.g., `bun scripts/crew.ts init --repo <path>`)
- Then: child_process spawns succeed (subprocesses exit cleanly); fs operations (read, write, mkdir) complete correctly; stdout contains expected JSON or plaintext; exit codes are 0 for success, nonzero for errors; no hangs or corrupted artifacts

**AC-WS3-3:** End-to-end Bun hook invocation succeeds.
- Given: `e2e-smoke.ts` scenario that chains `crew.ts` commands (e.g., init → claim → write-run-brief)
- When: the entire scenario is run via Bun (e.g., `bun scripts/e2e-smoke.ts`)
- Then: all commands in the chain complete successfully (exit 0); artifacts are created at expected paths; console output is clean (no TS parse errors, no deprecation warnings)

**AC-WS3-4:** TS execution is native under Bun (no `--experimental-strip-types` needed).
- Given: crew scripts using modern TS syntax (imports, generics, decorators if any)
- When: invoked via Bun without the `--experimental-strip-types` flag
- Then: scripts execute and complete with exit 0; all type annotations are stripped at runtime (no type errors at runtime)

**AC-WS3-5:** Performance improvement measured on Windows.
- Given: post-WS1 test suite baseline on node (≤40s)
- When: same test suite runs under Bun on the same Windows machine
- Then: test suite under Bun completes in <30s; if not achieved, compat spike records a DEC to stay hybrid

**AC-WS3-6:** Fallback flag is documented and functional (if green).
- Given: crew config and package.json have a `runtime: node|bun` field
- When: a consumer installs crew and has Bun available
- Then: the config respects the fallback flag; README and marketplace docs explain when to use each runtime

## Verification & rollout

- Re-baseline cost telemetry after each workstream; per-lever impact recorded in cost reports.
- Release sequencing: WS1 = patch; WS2 = minor (behavior change); WS3 = minor with migration notes. Each workstream runs as its own slice(s) through the loop.
- Rollback: parallel gates and skip-tier are prompt/command changes — revertible per release; Bun has the runtime fallback flag.

## Verification Commands

### WS1 — Test suite speed

```bash
# Baseline (before WS1)
time npm test 2>&1 | tail -20
# Expected: ~115.9s wall-clock, 573 tests pass

# After WS1 implementation
time npm test 2>&1 | tail -20
# Expected: ≤40s wall-clock, 573 tests pass

# Confirm no subprocess spawns in main assertions
grep -rn "execFile.*crew.ts" tests/ | grep -v "smoke\|spawn" | wc -l
# Expected: 0 (only per-family smoke tests retain execFile)

# Check per-command test files exist and parallelize
ls tests/cli-*.test.ts 2>&1
# Expected: at least 5 files (claims, approvals, artifacts, synthesis, cost)
```

### WS2 — Parallel gates and templated artifacts

```bash
# Verify --scaffold mode works on a write command
node scripts/crew.ts write-review-result --repo /tmp/test-repo --scaffold \
  --title "Test Review" --decision approved 2>&1
# Expected: artifact file created with empty decision fields; frontmatter present; no prose output

# Verify concurrent gate dispatch by checking cost report after a full light-tier slice
# (after WS2 is deployed and a slice is run)
cat .claude/artifacts/crew/cost/TIMESTAMP-cost-report*.md | grep "subagent_dispatches"
# Expected: subagent_dispatches count is lower than sequential baseline (~15–18 vs ~20+)
# AND reviewer + validator appear in same time window in the artifact body

# Verify workflow-state badge merge safety (requires concurrent writer test in e2e-smoke)
npm run e2e:smoke 2>&1 | grep -A5 "parallel-gate-scenario"
# Expected: scenario passes; no "merge conflict" or "lost update" in output
```

### WS3 — Bun runtime

```bash
# Test suite under Bun (if Bun is installed; Windows-only for this spike)
bun run test 2>&1 | tail -20
# Expected: 573 tests pass, wall-clock <30s (post-WS1 baseline ≤40s)

# CLI under Bun (sample commands)
bun scripts/crew.ts init --repo /tmp/bun-test-repo --json 2>&1 | head -5
# Expected: JSON output, exit 0, no TS parse errors

# E2E smoke under Bun
bun scripts/e2e-smoke.ts 2>&1 | tail -10
# Expected: all scenarios pass; "PASS" count ≥4; no deprecation warnings

# Verify native TS execution (no --experimental-strip-types needed)
cat > /tmp/test-ts.ts << 'EOF'
const x: string = "test";
export const y = x;
EOF
bun run /tmp/test-ts.ts 2>&1
# Expected: exit 0; no type errors at runtime
```

### Integration target (end of all three workstreams)

```bash
# Slice wall-clock metric (requires 3 consecutive slices after full rollout)
# Check cost reports from 3 slices:
for file in $(ls -t .claude/artifacts/crew/cost/*cost-report*.md | head -3); do
  echo "=== $(basename $file) ==="
  grep "^- Duration:" "$file"
done
# Expected: all three show ≤25 min (baseline ~43 min)

# Grade floor (no dimension drops >0.05 from baseline)
cat .claude/artifacts/loop/grades/LATEST-grade.md | grep -A8 "## Scores"
# Expected: each dimension ≥ (baseline - 0.05):
#   architecture_quality: ≥0.71  (baseline 0.76)
#   reliability: ≥0.73           (baseline 0.78)
#   observability: ≥0.706        (baseline 0.756)
#   production_readiness: ≥0.734 (baseline 0.784)
#   security: ≥0.72              (baseline 0.77)
#   test_confidence: ≥0.71       (baseline 0.76)
```

## Testing strategy

- WS1: full suite stays green; spawn smokes guard process-level regressions.
- WS2: `e2e-smoke` extended with a parallel-gate scenario and a light-tier scenario; a test covers two simultaneous workflow-state badge writes.
- WS3: CI runs a node+Bun matrix during the transition release.
