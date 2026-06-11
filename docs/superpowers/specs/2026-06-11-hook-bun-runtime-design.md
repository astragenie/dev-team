---
title: Hook runtime swap — node → bun (hot-path latency cut)
date: 2026-06-11
status: draft
axis: C (hook runtime latency)
supersedes: null
superseded_by: null
related:
  - docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
  - docs/superpowers/plans/2026-06-10-test-ci-wallclock-maintenance.md
  - FEAT-146 / SLICE-67 (hook-core extraction — prerequisite)
---

# Hook runtime swap — node → bun

## 1. Problem

Per-event hook latency dominates wall-clock on busy slices.

Measured 2026-06-11 on this repo (Windows 11, bun 1.3.14, node 22.6):

- `node --experimental-strip-types hooks/check-redundant-read.ts` cold start: **178ms**.
- `bash scripts/log_event.sh` cold start: **113ms**.
- Hottest event in the last 200 telemetry rows: `subagent_stop` × 96 (every subagent dispatch).
- Hook entries fire on: `PreToolUse Read` (check-redundant-read), `PreToolUse Bash/PowerShell` (preflight-shell), `PostToolUse Read` (record-read-content), `PostToolUse Agent` (check-subagent-return), plus 6 lifecycle events through `log_event.sh`.

Worked example for a typical busy slice (50 Reads, 30 Bash, 10 subagent dispatches):

- Read overhead: 50 × (178ms + 178ms) = 17.8s
- Bash overhead: 30 × 178ms = 5.3s
- Subagent overhead: 10 × (178ms + 2 × 113ms) = 4.0s
- log_event lifecycle (~5 events): 0.5s
- **Total per-slice hook overhead: ~27s of pure cold-start latency.**

The hook cores themselves were already extracted into `hooks/lib/*.ts` in SLICE-67 (FEAT-146) so tests run in-process. The runtime contract still spawns one Node process per hook event. Swapping the spawn target from Node to Bun cuts the dominant cost — cold start — by a measured ~75%.

## 2. Goals

- G1. Cut median hook cold-start latency by ≥ 60% (target ≤ 60ms; node baseline 178ms).
- G2. Cut `log_event.sh` per-event latency by ≥ 80% (target ≤ 20ms; bash baseline 113ms).
- G3. Hold byte-identical runtime contract: `tests/hook-feature-gating.test.ts` passes unchanged.
- G4. Fail loud at install if Bun is missing — no silent fallback.

## 3. Non-goals

- Hook daemon / IPC / socket / named pipe (separate spec if Bun swap insufficient).
- Merging PreToolUse Read + PostToolUse Read into a single hook (loses cost-hygiene veto semantics — separate spec).
- 3rdparty agent prompt bloat (axis B — separate spec; 6 files violate ≤ 350-line cap).
- Script code refactor (axis D — `crew.ts` 954 lines etc.; maintenance not runtime perf).
- Further test wall-clock cuts (axis G — already 8.36s post-SLICE-67; one failing 5s timeout test is triaged separately).
- Worktree workflow ergonomics (axis F — clarify in a separate session).

## 4. Architecture

Single mechanical swap: replace `node "${CLAUDE_PLUGIN_ROOT}/hooks/X.ts"` with `bun "${CLAUDE_PLUGIN_ROOT}/hooks/X.ts"` in `hooks/hooks.json` for the 4 per-tool entries. The SLICE-67 cores at `hooks/lib/*.ts` already export `runXHook(raw, env) => Promise<string | null>` and are runtime-neutral — whether the entry is `node` or `bun`, they call the same core. The hook entry shims are thin: read stdin, call core, write stdout, exit.

Bun becomes a hard runtime dep at install time. Installer preflight checks `bun --version`; missing Bun fails the install loud, not silent.

`log_event.sh` stays bash but the disk write is moved to a backgrounded subshell — the foreground returns in ~5-10ms, the write completes asynchronously.

## 5. Components

| Component | Change |
| --- | --- |
| `hooks/hooks.json` | 4 entries: `node ...` → `bun ...`. PreToolUse Read / Bash / PowerShell / PostToolUse Read / PostToolUse Agent. |
| `hooks/lib/*.ts` (4 cores) | Unchanged. Runtime-neutral by construction (SLICE-67 contract). |
| `hooks/*.ts` (4 entry shims) | Unchanged in logic. Verify Bun-compatible (no `node:` scheme assumptions, no `--experimental-strip-types` quirks). |
| `scripts/log_event.sh` | Wrap disk write in `(... &)` backgrounded subshell. Append-only events.jsonl. |
| `scripts/lib/installer/*.ts` | Add `bun --version` preflight. Missing → loud failure with install URL. No node fallback. |
| `.github/workflows/test.yml` | Add CI smoke: `echo '{}' \| bun hooks/check-redundant-read.ts` exits 0 on Windows + Linux. |
| `README.md` | Note Bun as runtime dep (currently de facto for tests only). |
| Future-spec breadcrumbs | None added by this spec. Section 3 (non-goals) lists the items deferred. |

## 6. Data flow

```
Tool fires
  → Claude Code spawns `bun hooks/X.ts`
    → bun cold start (~30-40ms, was node ~150-180ms)
    → entry reads stdin (payload JSON)
    → entry calls `runXHook(raw, env)` from hooks/lib/X.ts
    → core returns string (veto/warn) or null (silent)
    → entry writes stdout (if non-null) and exits 0
```

`log_event.sh` async-fire:

```
Hook event fires
  → bash receives event arg
  → spawn backgrounded subshell `( write_payload && append_jsonl ) &`
  → bash returns 0 in ~5-10ms
  → backgrounded subshell completes write asynchronously
```

## 7. Error handling

- **Bun missing at install**: installer preflight fails non-zero with an install URL. No node fallback path. Loud failure beats silent degradation.
- **Bun missing at runtime** (e.g. PATH change after install): hook spawn fails → Claude Code surfaces hook error → slice continues (no-veto contract) → user sees the error and reinstalls Bun. Acceptable — telemetry only path is `log_event.sh` which is bash, not affected.
- **Bun crash inside hook**: core throws → bun exits non-zero → Claude Code logs the error → no stdout → no veto. Matches current node behavior. Existing tests cover.
- **Async log_event partial write on session crash**: append-only jsonl with per-line `schemaVersion` already in place. Reader parses line-by-line and skips malformed lines. Telemetry loss tolerance acceptable.
- **Windows path quoting**: `${CLAUDE_PLUGIN_ROOT}` may contain spaces. `bun "${CLAUDE_PLUGIN_ROOT}/hooks/X.ts"` quotes the path; verify Bun parses Windows paths with spaces identically to node.

## 8. Testing

- **Existing hook tests** — 92 tests across `tests/cost-hygiene-hook.test.ts`, `tests/preflight-shell.test.ts`, `tests/subagent-return.test.ts`, `tests/hook-feature-gating.test.ts`. Unchanged. Runtime swap is invisible to in-process callers (per SLICE-67 contract).
- **Retained spawn smokes** — 6 across 3 suites. Re-baseline under Bun. If timing assertions exist (e.g. "completes within 1s"), confirm Bun keeps them green or relax with a comment.
- **New micro-benchmark** — `tests/hook-cold-start-bench.test.ts`:
  - 100 cold spawns of `bun hooks/check-redundant-read.ts` with empty stdin.
  - Assert median ≤ 60ms (G1 floor).
  - Optional: skip on CI if measurement noise > 30% (record-only).
- **CI smoke** — pipeline step `echo '{}' | bun "${CLAUDE_PLUGIN_ROOT}/hooks/check-redundant-read.ts"` exits 0. Add to both Windows + Linux jobs.
- **log_event async-fire bench** — `tests/log-event-async-bench.test.ts`: 100 invocations, assert foreground p95 ≤ 20ms (G2 floor).
- **Manual smoke** — run one slice end-to-end after the swap. Diff `.claude/logs/events.jsonl` timestamps before/after to confirm no events dropped.

## 9. Acceptance criteria

| ID | Criterion | Evidence |
| --- | --- | --- |
| AC-1 | All 4 PreToolUse/PostToolUse entries in `hooks/hooks.json` use `bun` not `node`. | `grep -c '"command": "node' hooks/hooks.json` returns 0. |
| AC-2 | `tests/hook-feature-gating.test.ts` (runtime contract proof) green unchanged from main. | `bun test tests/hook-feature-gating.test.ts` → all pass; `git diff main -- tests/hook-feature-gating.test.ts` empty. |
| AC-3 | Hook cold-start p50 (median) ≤ 60ms (was 178ms with node). p95 ≤ 120ms. | `tests/hook-cold-start-bench.test.ts` median + p95 assertions over 100 cold spawns. |
| AC-4 | Installer fails loud on missing `bun --version`; error includes install URL. | Manual test: PATH-strip bun → run install → expect non-zero exit + URL in stderr. |
| AC-5 | CI smoke green on Windows + Linux jobs. | `.github/workflows/test.yml` new step green; PR builds prove both jobs pass. |
| AC-6 | `log_event.sh` foreground p95 ≤ 20ms (was 113ms). | `tests/log-event-async-bench.test.ts` assertion. |
| AC-7 | One end-to-end manual slice run shows no dropped events vs the pre-swap baseline. | Slice-progress event count matches `.claude/logs/events.jsonl` line delta. |

## 10. Risks

- **Bun-vs-node Windows path parsing divergence**: low — Bun 1.3 is Windows-native and the entries pass `${CLAUDE_PLUGIN_ROOT}/hooks/X.ts` as a single quoted argv element. Mitigated by AC-5 (CI Windows smoke).
- **Consumer plugin installs without Bun**: medium — `dev.stable: false` plus a loud installer failure is acceptable. Update README pinned-release callout to call out the Bun runtime dep.
- **CI flake on the micro-benchmark**: medium — cold-start timing is noisy. Mitigated by recording p50 + p95 instead of asserting tight bounds; loosen to ≤ 80ms median if CI proves jittery.
- **Async log_event silently drops events on session crash**: low — telemetry only, append-only jsonl, per-line schemaVersion, downstream readers already skip malformed lines.
- **Bonus async-fire collides with the SLICE-67 record-read-content fix** (removed mid-flow `process.exit(0)` to comply with repo rule 6): not applicable. The async fire happens in `scripts/log_event.sh` (bash), not in `hooks/lib/record-read-content.ts`. Repo rule 6 is untouched.

## 11. Rollback

- Revert `hooks/hooks.json` to `node ...` entries.
- Revert `scripts/log_event.sh` background-subshell wrap.
- Remove installer preflight + CI smoke step.
- Delete `tests/hook-cold-start-bench.test.ts` + `tests/log-event-async-bench.test.ts`.

Rollback is one PR. The hook cores at `hooks/lib/*.ts` are not touched by this spec, so no risk of permanent divergence from main.

## 12. Open questions

- Should the installer preflight pin a minimum Bun version (e.g. `>= 1.3.0`)? Current measurement is on 1.3.14. Suggest pin `>= 1.3` and lift if a sub-1.3 user reports a regression.
- Should the bench tests run on every CI build or nightly? Suggest: nightly + on PRs that touch `hooks/`. Avoid noisy timing assertions blocking unrelated PRs.

## 13. Expected outcome

- Per-hook latency: 178ms → ~40ms (≥ 75% cut, G1).
- Per-event log_event: 113ms → ~10ms (≥ 90% cut, G2).
- Worked example (50 Reads + 30 Bash + 10 subagents): hook overhead 27s → ~7s. ~20s wall-clock saved per busy slice.
- Median slice cost-report wall-clock should drop in proportion to dispatch-heavy turns.
