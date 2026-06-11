# Slice Perf 2-3x — Telemetry-Gated Cuts — Design

- **Date:** 2026-06-11
- **Status:** approved (brainstorm gate passed)
- **Owner:** pm_milashico
- **Approach:** A + C — telemetry baseline first, then safe data-justified cuts
- **Builds on:** [2026-06-10-slice-pipeline-speedup-design.md](./2026-06-10-slice-pipeline-speedup-design.md)
  (WS1 in-process tests landed in SLICE-67 → suite 115.9s → 21.1s; WS2 parallel
  reviewer+validator dispatch + scaffolds partially landed; WS3 Bun hybrid live)

## Problem

Slice wall-clock still subjectively slow and agents hang mid-execution despite
the active hang-fix campaign (commits 765c53c, 0a8acb4, cfe26e7, ebc4c1e
Jun 10–11). User-reported hang loci: builder mid-edit AND
reviewer/validator gates. Operational shape: silent freeze >60s AND long bash
gates (lint / test / build) AND repeated Read/Edit thrashing AND skill-load +
context swell. All four hang modes co-occur — compounding problem, not a single
root cause.

Prior speedup spec (2026-06-10) shrank the test suite long pole and rebalanced
gates, but did NOT address: per-dispatch timing observability, parallel
execution of bash gates *within* a single agent's gate call, skill auto-load
context bloat, or harness-level Read thrash dedup. This spec covers those four.

Hard floors confirmed by user 2026-06-11 brainstorming session:
- Independent review (crew:reviewer): cannot weaken.
- Slice ceremony (start/complete/grade): cannot weaken.

Soft floors weakenable per-slice if telemetry justifies:
- Full test suite green pre-merge (already moved to validator-owned final gate).
- Lint + format:check + typecheck zero-warning (can degrade if hot path).

Model assignment per role is already correct in agent frontmatter (opus on
architect/lead/parallel-runner, sonnet on builders/reviewer/validator/researcher/
refactor/uxdesigner/perf/qa/integrator/deployer, haiku on investigator). Model
cascade is NOT a lever for this spec.

## Goals & success criteria

1. **Slice wall-clock 2-3x faster** vs current baseline measured by Phase 1
   telemetry. Floor: ≥2x median wall-clock improvement over 3 consecutive
   post-Phase-2 slices.
2. **Zero quality regression**: no grade dimension drops more than 0.05 from
   the Phase 1 baseline mean across architecture_quality, reliability,
   observability, production_readiness, security, test_confidence,
   product_completeness.
3. **Hang frequency** (silent freeze >60s events) drops by ≥50% — measured by
   bash-gate timer entries where the recorded duration exceeded the hard cap.

## Non-goals

- Reducing scope of independent review or slice ceremony (hard floors).
- Reviewer fan-out lens parallelism — deferred unless telemetry shows reviewer
  wall-clock > 30% of slice total.
- Affected-only test selection pre-merge — deferred, same reason.
- Silent-freeze API-layer root cause — addressed via bash hard caps, not
  Anthropic API debug.
- Model cascade — already done.

## Phase 1 — Telemetry baseline (additive, autonomous_safe)

Three additive pieces feeding into the existing cost-report writer. Zero
behavior change to slice ceremony.

### 1a. Per-dispatch timing wrapper (FEAT-149)

**New file:** `scripts/lib/dispatch-timing.ts`

Exports `recordDispatchStart(meta)` and `recordDispatchEnd(meta)`. Hooks into
the existing `hooks/lib/check-subagent-return.ts` (already extracted in
SLICE-67) to tap subagent return events. Writes one JSONL line per dispatch to
`.claude/logs/dispatch-timing.jsonl` (gitignored — machine-local working data).

**JSONL row v1 (example shape, not literal lock):**
```json
{"runId":"...","sliceId":"SLICE-NN","agent":"crew:builder","model":"claude-opus-4-7","startMs":1234,"wallMs":45200,"toolCalls":{"Read":12,"Edit":4,"Bash":3},"bashDurationMs":18000,"skillLoadCount":2,"tokenIn":48000,"tokenOut":12000}
```

Fields are additive — row schema can grow without breaking downstream readers.
Per-worktree log path (`$CLAUDE_PLUGIN_ROOT/.claude/logs/dispatch-timing.jsonl`)
keeps parallel worktree dispatches from racing on a shared file.

### 1b. Bash gate timer helper (FEAT-150)

**New file:** `scripts/lib/bash-gate-timer.ts`

Tiny PreToolUse/PostToolUse hook tap on Bash tool. Logs
`{gate, durationMs, exitCode}` per bash invocation that matches a known gate
pattern (`bun run lint`, `bun run format:check`, `bun run typecheck`, `bun
run test`, `bun audit`, `bun run validate:all`, `npm ci`). Writes to
`.claude/logs/bash-gates.jsonl` (gitignored).

Surfaces in cost report under "Bash gate breakdown" section (added by FEAT-151).

### 1c. Cost-report per-dispatch breakdown section (FEAT-151)

**Touches:** `scripts/crew.ts` (`write-cost-report` command), tests.

New section appended below existing cost-report sections — backward compatible.
Reads `dispatch-timing.jsonl` and `bash-gates.jsonl` for the current `runId`,
aggregates:

- Total wall-clock per slice (sum of dispatch `wallMs`).
- Top-3 slowest dispatches by `wallMs`.
- Top-3 most-token agents by `tokenIn + tokenOut`.
- Bash gate cumulative time + per-gate breakdown (lint X s, typecheck Y s, …).
- Skill-load count per agent.

Toggle via env `CREW_COST_REPORT_DISPATCH_DETAIL=0` if section becomes noisy.

### Phase 1 gate (3-slice baseline)

After FEAT-149/150/151 land, run 3 normal slices to collect baseline. Aggregate
written to `.claude/artifacts/loop/baselines/phase-1-perf-baseline.md` with
median + p95 per agent role + bash gate.

**Phase 2 promotion criterion:** top-3 slowest dispatches + total bash gate
time account for ≥50% of slice wall-clock → Phase 2 justified. Otherwise
re-design.

## Phase 2 — Cuts (gated on Phase 1, autonomous_safe: false)

### 2a. Parallel bash gates (FEAT-152)

**Problem:** Validator currently runs `lint`, `format:check`, `typecheck`,
`audit`, `validate:all` serially. Sum is ~33s wall-clock. Parallel max is
~12s (typecheck dominates).

**New file:** `scripts/lib/parallel-gates.ts` — emits a parallel bash block
with per-gate temp logs via `mktemp`, runs all gates in background, `wait`s,
aggregates exit codes (OR across all), prints per-gate header + tail of any
failed log. Per-gate `timeout 60` hard cap to prevent silent freeze on a hung
process.

**Touches:** `agents/validator.md`, `agents/reviewer.md`,
`agents/reviewer-validator.md` — gate-run section calls helper instead of
inline serial.

Expected savings: ~21s per gate run × 3-4 gate runs per slice = ~80s
wall-clock per slice. Different lever from 2026-06-10 spec's WS2-2a
(parallel *subagent* dispatch); this is parallel *bash* execution within a
single subagent.

### 2b. Skill auto-load cap + pre-rendered universals (FEAT-153)

**Problem:** Each Skill invocation loads ~200 lines. Multiple skills per
dispatch compound context bloat → Opus stalls (silent freeze), Sonnet slows.

Two-part fix:

**(b1) Cap = 3 per dispatch.** Drop from existing 4-skill cap (per recent
agent prompt refactors 765c53c, 0a8acb4, cfe26e7) to 3. Always-on counts as 1.
Touches all agent prompts with skill-table sections.

**(b2) Pre-render top universals inline.**

**New file:** `scripts/render-universal-skills.ts` — reads the three nearly-
universal skills, inlines a compressed essentials version (~30 lines total)
into each agent prompt under a `## Pre-loaded universals` section. The full
Skill tool still works if an agent needs full body.

Pre-render targets:
- `superpowers:using-superpowers`
- `superpowers:verification-before-completion`
- `loop:loop-discipline`

CI gate via `scripts/validate-agents.ts`: fails if rendered hash != source
hash. Keeps pre-render synced.

Expected savings: ~3 Skill round trips × ~600ms × 4-5 agents per slice
= ~8-9s per slice. Plus context savings → faster Opus inference + fewer
silent freezes.

### 2c. Bash hard caps everywhere (FEAT-154)

**Problem:** Builder, validator, architect already have 60s typecheck cap
(commits 765c53c, cfe26e7). Reviewer + reviewer-validator do not.

**Touches:** `agents/reviewer.md`, `agents/reviewer-validator.md`. Pattern:
`timeout 60 <cmd> || echo "TIMEOUT"`. Cap configurable via env
`CREW_BASH_GATE_TIMEOUT_S=60`.

Expected savings: kills silent-freeze tail without affecting median.

### 2d. TaskUpdate batching (FEAT-155)

**Problem:** SLICE-67 cost report shows 20 TaskUpdate calls burning 791K
cache_create tokens — **1750.62× cache-prime ratio per call**, the worst of
any tool. Anomaly: each tiny TaskUpdate (~452B result) forces ~40K tokens of
cache re-key on the next turn. 20 calls × 40K = ~$60+ in pure overhead.

**Fix:**

(d1) **Agent prompt rule:** "batch task status changes. Mark multiple tasks
`completed` in one TaskUpdate call when sequence finished. Send
`in_progress` for the *current* task only, not the next planned one.
Avoid rapid-fire TaskUpdate sequences across consecutive turns."

(d2) **Hook flag:** extend `hooks/lib/check-subagent-return.ts` (or new
`hooks/lib/check-task-update-burst.ts`) to detect ≥3 TaskUpdate calls in a
single turn without intervening other tool calls → log warning row in
`.claude/logs/task-update-bursts.jsonl` (machine-local, for telemetry —
non-blocking).

**Touches:** all agent prompts with TaskUpdate guidance (builder, lead,
reviewer, validator, architect, doc-writer), `hooks/lib/`, tests,
`scripts/validate-agents.ts` (add lint that flags missing batching rule in
TaskUpdate sections).

**Risk:** less granular progress visibility for the user watching the live
session. **Mitigation:** keep `in_progress` updates immediate (1-task lookahead
unchanged); only batch `completed` markers at logical sequence boundaries.

**Expected savings:** ~600K cache_create tokens per slice — roughly 10% of
slice-67's total cache burn.

### 2e. Edit verify-loop dedup hook (FEAT-156)

**Problem:** SLICE-67 shows 191 Edit calls with **19 failures (9.9% rate)**
plus 73 redundant_read_count (top offenders are agent prompt files repeatedly
re-read). Pattern (per memory `feedback_stale_ide_diagnostic.md`): Edit fails
→ agent re-reads file to "verify state" → retries Edit. Each re-Read after
Edit is wasted cache prime (46.06× per Edit call already; the verify Read
doubles it).

**Fix:** extend `hooks/lib/check-redundant-read.ts` to track recent successful
Edit/Write operations per file path. On `Read(file)` within N=5 tool calls of
a successful `Edit(file)` or `Write(file)`, block with a structured response:

```json
{"action":"deny","reason":"file X was just Edit/Write'd successfully — current state is in your context. Harness errors on failed Edit; success means file matches new_string. Re-Read is wasted cache prime. Override via {force:true} or explicit reason in tool call."}
```

Bypass mechanism: agent passes `force: true` in Read args, OR more than N tool
calls have elapsed since the Edit, OR the file was modified by an external
process (detected via mtime check before block).

**Touches:** `hooks/lib/check-redundant-read.ts` (extend), tests,
`hooks/check-redundant-read.ts` shim (unchanged — core change only).

**Risk:** legitimate re-Read after external process changed file (e.g., git
rebase, sub-agent edit) gets blocked. **Mitigation:** mtime check before
block — if mtime > Edit timestamp, allow Read. Plus `force: true` escape.

**autonomous_safe:** true (additive hook extension, no agent prompt edits).
Mirrors the SLICE-67 hook-core extraction pattern.

**Expected savings:** ~30-50% of redundant_read_count = ~20-35 fewer Reads per
slice = ~300-500K cache_create tokens.

### 2f. Bash call coalescing rule (FEAT-157)

**Problem:** SLICE-67 shows 305 Bash calls per slice. Each call carries a
~4.86× cache-prime ratio. Many calls are tiny one-shots (`git status`, `ls`,
single `grep`) that could be chained.

**Fix:** agent prompt rule under conventions section: "prefer chained commands
(`cmd1 && cmd2 && cmd3`) over sequential separate Bash invocations when
commands are related and don't need intermediate model reasoning. Example:
combine `git status && git diff --stat && git log --oneline -5` into one Bash
call, not three."

Add `scripts/validate-agents.ts` lint: flag agent prompts missing a Bash
coalescing rule under Conventions.

**Touches:** all primary agent prompts (builder, builder-be, builder-fe, lead,
reviewer, validator, architect, deployer, integrator, researcher),
`scripts/validate-agents.ts`, tests.

**Risk:** chained commands harder to diagnose when one fails mid-chain.
**Mitigation:** rule explicitly carves out: "use separate Bash calls when each
result drives the next decision; chain only when commands are pure data
collection or all-or-nothing."

**Expected savings:** target 305 → ~180 Bash calls per slice (~40% reduction)
= ~470K cache_create tokens.

## FEAT decomposition

| FEAT | Phase | Title | Risk | autonomous_safe |
|------|-------|-------|------|-----------------|
| FEAT-149 | 1 | Dispatch-timing wrapper + JSONL writer | low (additive) | true |
| FEAT-150 | 1 | Bash gate timer helper | low (additive) | true |
| FEAT-151 | 1 | Cost-report per-dispatch breakdown section | low (additive) | true |
| FEAT-152 | 2 | Parallel bash gates helper + validator/reviewer wiring | medium (concurrency) | false |
| FEAT-153 | 2 | Skill cap=3 + pre-rendered universals | medium (touches every agent prompt) | false |
| FEAT-154 | 2 | Bash hard caps everywhere | low (mirrors existing pattern) | false |
| FEAT-155 | 2 | TaskUpdate batching rule + burst-detector hook | medium (touches every agent prompt + new hook) | false |
| FEAT-156 | 2 | Edit verify-loop dedup hook extension | low (additive hook + mtime escape) | true |
| FEAT-157 | 2 | Bash call coalescing rule + lint | medium (touches every agent prompt) | false |

**Phase 1 parallel-safe** in worktrees. **Phase 2 parallel-safe** in worktrees.
Phase gate (3-slice baseline) between phases is non-negotiable.

**Slice mapping:** one slice per FEAT. Next slice id depends on slice
ceremony state; rough mapping: SLICE-68/69/70 (Phase 1), SLICE-71 through
SLICE-76 (Phase 2 — only after baseline gate passes; six Phase 2 FEATs
parallel-safe in worktrees).

**Phase 2 cumulative expected savings (vs SLICE-67 baseline):**

| Lever | Cache_create saved (tok) | Slice wall-clock impact |
|-------|--------------------------|--------------------------|
| 2a parallel bash gates | ~0 (tokens unchanged) | -80s |
| 2b skill cap + pre-render | ~300K (cuts re-reads) | -8s |
| 2c bash hard caps | ~0 (tail latency only) | hang freq -50% |
| 2d TaskUpdate batching | ~600K | implicit (less context bloat) |
| 2e Edit verify-loop dedup | ~300-500K | implicit |
| 2f Bash coalescing | ~470K | implicit |
| **Total** | **~1.7M-1.9M tok** | **-90s + hang tail killed** |

~30% of SLICE-67's cache_create burn eliminated. Combined with parallel
gates' wall-clock savings, target 2-3x slice speedup achievable.

## Risks + rollback

### Phase 1 risks (low)

- JSONL write contention under parallel worktree dispatch — mitigated by
  per-worktree log path (already worktree-scoped via `$CLAUDE_PLUGIN_ROOT`)
  and append-only writes.
- Hook tap adds latency to subagent return path — bench in unit test;
  fire-and-forget background write if >10ms wall-clock cost.
- Cost report becomes harder to read — appended section, no removals;
  toggleable via env var.

**Rollback Phase 1:** delete the two `scripts/lib/` files + revert hook taps
+ revert cost-report section. JSONL files orphaned but ignored. Zero data
loss for slice ceremony.

### Phase 2 risks (medium)

- Parallel gates race on shared `.gate-*.log` files — per-gate `mktemp`;
  aggregator reads exit codes via `wait $pid` per process.
- Parallel gates mask *which* gate failed — aggregator prints per-gate header
  + tail of failed log; exit code = OR of all.
- Pre-rendered universals drift from skill source — CI gate via
  `validate-agents.ts` fails if rendered hash != source hash.
- Skill cap=3 starves agent of needed skill — agent prompt explicit fallback:
  "if 4th skill needed, write `escalated_to_lead` badge with reason"; lead
  routes via expanded cap on re-dispatch.
- Bash hard cap kills legitimately long test run — cap configurable per gate
  via env override.

**Rollback Phase 2 per lever:**
- FEAT-152 rollback: revert `parallel-gates.ts` + agent prompt blocks → serial
  gates restored.
- FEAT-153 rollback: revert pre-loaded universals section in each agent +
  revert skill cap → auto-load restored.
- FEAT-154 rollback: revert bash cap pattern from reviewer/reviewer-validator.
- FEAT-155 rollback: revert TaskUpdate batching rule from agent prompts +
  delete burst-detector hook. Reverts to per-task updates.
- FEAT-156 rollback: revert hook extension in
  `hooks/lib/check-redundant-read.ts`. Edit verify-loop re-Reads allowed again.
- FEAT-157 rollback: revert coalescing rule from agent prompts + revert lint.
  Sequential Bash calls allowed again.

Each FEAT lands in own commit + slice — rollback is `git revert <slice-commit>`.
No cross-lever coupling.

**Additional Phase 2 risks (2d/2e/2f):**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TaskUpdate batching reduces live progress visibility | medium | user can't see in-flight task state | keep `in_progress` immediate; only batch `completed` markers |
| Edit-dedup hook blocks legitimate re-Read after external modification | low | agent acts on stale context | mtime check before block + `force: true` escape |
| Bash coalescing chains hide which command failed | medium | longer triage when chain fails | rule carves out: separate calls when each result drives next decision |
| Coalescing tempts agent to combine unrelated commands | low | logic errors from over-coalescing | lint rule + agent prompt example specifies "related, all-or-nothing" only |

## Quality regression detector

Phase 1 baseline grade scores written to
`.claude/artifacts/loop/baselines/phase-1-perf-baseline.md` (3-slice mean per
dimension). Post-Phase 2 grades compared against baseline.

**Trigger:** any score dimension drops >0.05 from baseline mean → write
`escalated_to_lead` badge with affected lever id, halt next Phase 2 FEAT
promotion until user reviews.

## Hard floors restated

- Independent review (crew:reviewer): unchanged — still dispatched on every
  code slice.
- Slice ceremony: unchanged — start/complete/grade required.
- Both gates protected from any Phase 2 lever.

## Verification commands

### Phase 1 — Telemetry wiring

```bash
# Confirm JSONL writer fires on subagent dispatch
ls .claude/logs/dispatch-timing.jsonl
wc -l .claude/logs/dispatch-timing.jsonl
# Expected: ≥1 row per subagent dispatched in current run

# Confirm bash gate timer fires
ls .claude/logs/bash-gates.jsonl
grep '"gate":"bun run typecheck"' .claude/logs/bash-gates.jsonl | tail -3
# Expected: typecheck rows with durationMs and exitCode

# Confirm cost report appends breakdown
bun run scripts/crew.ts write-cost-report --slice SLICE-68 --repo "$PWD"
ls -t .claude/artifacts/crew/cost/ | head -1 | xargs -I{} cat .claude/artifacts/crew/cost/{} | grep -A20 "Per-dispatch breakdown"
# Expected: section present with Top-3 slowest dispatches table
```

### Phase 1 — Baseline gate

```bash
# After 3 slices, check baseline was written
cat .claude/artifacts/loop/baselines/phase-1-perf-baseline.md
# Expected: median + p95 wall-clock per agent role; bash gate breakdown;
# top-3 slowest dispatches identified
```

### Phase 2 — Parallel bash gates

```bash
# Confirm parallel helper exists + emits parallel block
bun run scripts/lib/parallel-gates.ts --print
# Expected: bash block with ( ... ) & per gate + wait + exit aggregation

# Run validator gate via helper, measure wall-clock
time bash -c "$(bun run scripts/lib/parallel-gates.ts --emit)"
# Expected: <15s on a slice that previously took ~33s serial
```

### Phase 2 — Skill cap + pre-render

```bash
# Confirm pre-rendered universals injected
grep -l "## Pre-loaded universals" agents/*.md | wc -l
# Expected: every primary agent (≥10)

# Confirm CI gate catches drift
bun run scripts/validate-agents.ts
# Expected: green; mutate one rendered block manually and re-run → red
```

### Phase 2 — Bash hard caps

```bash
# Confirm timeout pattern present in reviewer + reviewer-validator
grep -c "timeout " agents/reviewer.md agents/reviewer-validator.md
# Expected: ≥1 per agent file
```

### Phase 2 — TaskUpdate batching

```bash
# Confirm batching rule present in agent prompts
grep -l "batch task" agents/*.md | wc -l
# Expected: ≥6 (builder, lead, reviewer, validator, architect, doc-writer)

# Confirm validate-agents lint catches missing rule
bun run scripts/validate-agents.ts
# Expected: green; remove rule from one prompt and re-run → red

# Confirm burst-detector hook fires
cat .claude/logs/task-update-bursts.jsonl 2>/dev/null | wc -l
# After 1 slice with batching rule applied: count drops vs SLICE-67 baseline 20+
```

### Phase 2 — Edit verify-loop dedup hook

```bash
# Confirm hook denies re-Read after Edit
bun test tests/check-redundant-read.test.ts -t "blocks re-Read after successful Edit"
# Expected: green

# Confirm mtime escape works
bun test tests/check-redundant-read.test.ts -t "allows re-Read if mtime changed externally"
# Expected: green

# Confirm force:true escape works
bun test tests/check-redundant-read.test.ts -t "allows re-Read when force flag set"
# Expected: green
```

### Phase 2 — Bash call coalescing

```bash
# Confirm coalescing rule present in primary agent prompts
grep -l "chained commands" agents/*.md | wc -l
# Expected: ≥10 (all primary agents)

# Confirm validate-agents lint catches missing rule
bun run scripts/validate-agents.ts
# Expected: green; remove rule from one prompt and re-run → red

# Measure Bash call count drop in next slice cost report
ls -t .claude/artifacts/crew/cost/*cost-report*.md | head -1 | xargs grep "^- Bash:"
# Expected: post-2f count <200 (SLICE-67 baseline: 305)
```

### Integration target (post-Phase-2)

```bash
# Slice wall-clock 2-3x improvement over 3 consecutive slices
for file in $(ls -t .claude/artifacts/crew/cost/*cost-report*.md | head -3); do
  echo "=== $(basename $file) ==="
  grep "^- Total wall-clock" "$file"
done
# Expected: each shows ≥2x reduction vs Phase 1 baseline median

# Grade floor (no dimension drops >0.05 vs Phase 1 baseline)
cat .claude/artifacts/loop/grades/LATEST-grade.md | grep -A8 "## Scores"
# Expected: each dimension ≥ (baseline - 0.05)

# Hang frequency drop ≥50%
grep -c 'TIMEOUT' .claude/logs/bash-gates.jsonl
# Expected: post-Phase-2 count ≤ 0.5 × Phase 1 baseline count
```

## Testing strategy

- **Phase 1:** unit tests for `dispatch-timing.ts` (records correct fields
  under fixed clock), `bash-gate-timer.ts` (logs on Bash tool calls), cost
  report reader (aggregates JSONL rows). Smoke test: `e2e-smoke.ts` writes
  ≥1 dispatch row when smoke spawns a subagent.
- **Phase 2:** unit tests for `parallel-gates.ts` (correct exit aggregation,
  per-gate temp logs cleaned up). Integration: validator gate run wall-clock
  measured before/after. Render-universal-skills tested via golden-file
  comparison + CI hash drift detection.

## References

- 2026-06-10-slice-pipeline-speedup-design.md — prior speedup spec (WS1/WS2/WS3)
- SLICE-67 grade — hook-core extraction, suite 115.9s → 21.1s
- Commits 765c53c / 0a8acb4 / cfe26e7 / ebc4c1e — active hang-fix campaign
- CLAUDE.md — repo conventions, slice ceremony, autonomous_safe rule
- .claude/artifacts/loop/loop-snapshot.md — current backlog state
