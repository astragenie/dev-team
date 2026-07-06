# Agent performance validation — before vs. after the 2026-07-06 token-burn fixes

**Date:** 2026-07-06
**Scope:** Read-only analysis of this session's own subagent dispatches, comparing behavior before and after the P0-0 (model routing), P0-1/P0-2 (checkpoint-commit + mechanical-scripted guardrails), and P0-3 (worktree-isolation) fixes in `docs/research/2026-07-06-token-burn-patch-plan.md`.
**Method:** Mined `.claude/logs/events.jsonl` + `payloads/*.json` for `subagent_stop` events on 2026-07-06, deduped by `agent_id` (fires ~2× per dispatch), split at the model-routing fix commit (`16:56:51Z`).

## Headline

**The `events.jsonl` data cannot demonstrate the fixes' behavioral effect (cutoff rate or token burn) in either direction** — small single-day sample, and the `subagent_stop` payload has **no token, no duration, no model field**. Confidence LOW on any improvement claim.

**But two structural findings are high-confidence and more important:** the capture + telemetry infrastructure meant to measure this **is not wired into dev-team's live hooks.**

## 1. Cutoff rate — inconclusive

Deduped by `agent_id`: 32 BEFORE / 13 AFTER distinct dispatches.

| Bucket | Dispatches | Flagged cutoff (forward-narration heuristic) | Rate |
|---|---|---|---|
| BEFORE (pre-fix) | 32 | 0 | 0% |
| AFTER (post-fix) | 13 | 1 | 7.7% |

0/32 → 1/13 is **not** evidence either way at this N with a regex-over-text heuristic. The BEFORE 0% is itself suspect (heuristic under-detects). Do NOT report "fixes reduced/increased cutoffs" from this.

> **Note vs. the orchestrator's observational claim:** the dispatcher's live task-notifications carried a `subagent_tokens` usage field (133k–262k per dispatch) + visible idle-mid-task resumes, which read as "Opus builders cut off ~6×, Sonnet builders cleaner/cheaper." That signal is real but is a different data source (harness notifications, not `events.jsonl`), small-N, and an inference — it is NOT rigorously confirmed here and should be labeled observational, not measured.

## 2. No token/duration/model in the stop payload

`subagent_stop` payload has `effort` (BEFORE 27 high/5 med; AFTER 13 high) but **no token count, no duration, no `model`**. So model (Opus vs Sonnet) per dispatch is **inferred** from wall-clock vs the routing-commit time, **not verified**. A token-burn before/after comparison is **not possible from this source**.

## 3. 🔴 `subagent-incomplete` capture (FEAT-188 S1a) is NOT firing in dev-team — verified

Code is correct (`hooks/lib/check-subagent-return.ts:198-212` logs the event + writes a learning + dual-writes a GEPA trial). But:
- `grep '"event":"subagent-incomplete"'` events.jsonl → **0**.
- `learnings.jsonl` = **3 entries, all Jun 9-11** — **zero from this session's ~45 dispatches**.
- GEPA trials/ = 1 canary row (Jul 2), unrelated.

**Root cause (verified):** dev-team's live `.claude/settings.json` has hook events `[SessionStart, TaskCreated, TaskCompleted, SubagentStart, SubagentStop, Stop, PreToolUse]` — **no `PostToolUse` key**, and its one `PreToolUse` matcher is `Bash` only. The plugin's `hooks/hooks.json` registers `check-subagent-return.ts` under `PostToolUse` matcher `Agent` — but that matcher **does not exist in the live settings**. So the hook never runs. (The 225 historical `inline-return-warn` rows came from a differently-wired/earlier path, not this session's S1a capture.)

**The capture FEAT-188 S1a shipped in v0.52.0 is dark in dev-team's own dogfooding.**

## 4. 🔴 `cost-watch` dispatch-timing gap — same root cause

`.claude/logs/dispatch-timing.jsonl` **does not exist**, so `crew cost-watch`'s per-dispatch table can only show its fallback string. `hooks/lib/dispatch-timing-pre-tap.ts` (`recordDispatchStart`) is registered under `PreToolUse` `Agent` in `hooks/hooks.json` — but the live settings' only `PreToolUse` matcher is `Bash`. Same divergence: **settings.json lacks the `Agent`-tool matchers the plugin manifest declares.**

## 5. P0-3 (worktree-isolation-default) — no commit found

No `isolation`/`worktree-default` commit in git history. P0-3 appears to be a *dispatcher habit* (manual `isolation: worktree` on Agent calls), not a wired default. Confidence LOW it shipped structurally.

## 6. Verdict

- **Behavioral improvement (cutoffs, token burn): unproven** here — data source + sample too limited. Confidence LOW.
- **Structural findings: high-confidence** — the `subagent-incomplete` signal AND the `dispatch-timing` pipeline are both NOT firing in dev-team, traced to one root cause: **`.claude/settings.json` is missing the `Agent`-tool `PreToolUse`/`PostToolUse` matchers that `hooks/hooks.json` declares.** Stale-settings-vs-manifest divergence.

**Actionable fix:** reconcile `.claude/settings.json` with `hooks/hooks.json` (wire the `Agent` matchers). Then S1a capture + `cost-watch` dispatch-timing actually run, and a *rigorous* before/after (real per-dispatch tokens/duration + real incomplete-return capture) becomes possible over a larger post-fix window.

**Not claimed:** that the fixes are ineffective — only that this data can't show it, and the measurement infra isn't live.

## Caveats (repeat if cited)
- N=45, single session, single day. `subagent_stop` fires ~2×/agent_id (deduped, first kept). Cutoff = regex heuristic over `last_assistant_message` tail, not a transcript replay. Model per dispatch inferred, not read.
