# Why crew dev agents die mid-job — root causes and non-over-engineered fixes

**Date:** 2026-07-06
**Type:** Read-only research (no source edited)
**Scope:** Why subagents lose work/context mid-dispatch, and what's worth fixing.

---

## 1. Root-cause table

| # | Death mode | Real enforcement layer | Evidence | Does maxTurns/maxMinutes touch it? |
|---|---|---|---|---|
| 1 | **Harness dispatch cutoff** (platform-level tool-call/wall-clock budget on a single `Task`/`Agent` dispatch, above and separate from agent frontmatter) | The orchestrator/harness itself — nothing in this repo's hooks or scripts implements or reads a cutoff. `hooks/lib/check-subagent-return.ts` and `hooks/otel-subagent-stop.ts` only fire *after* a dispatch returns; they log/warn, they don't cut anything off. | `.claude/artifacts/loop/loop-snapshot.md` narrative: SLICE-107 builder "hit cutoff at tool 82 / 18 min, resumed via SendMessage." **Grade** `doc-claimed` — manually-maintained narrative, not a raw transcript citation; underlying transcript JSONL not located to verify tool-index 82 directly. | **No.** `agents/aiplugin-dev.md` sets `maxTurns: 60 / maxMinutes: 12`. SLICE-107 died at tool 82 (over the 60 cap) but framed as a harness cutoff, not an agent-cap stop — and nothing enforces either cap regardless (row 3). |
| 2 | **Agent maxTurns cap as intentional misroute guard** | Advisory-only in frontmatter; not enforced by any hook, but the *prompt text* self-enforces by instructing the agent to refuse and hand off immediately. | `agents/investigator.md:20,42`: `maxTurns: 12` + prompt: *"You will die at the cap on root-cause-analysis work. The dispatcher misrouted — say so immediately…"* `verified-in-code`. A behavioral contract written into the prompt, not a runtime cap. | Confirms operator framing: a low `maxTurns` with no `maxMinutes` is deliberate ("die fast on misroute") — but it only "works" because the prompt tells the agent to self-police, same unenforced mechanism as row 3. |
| 3 | **maxTurns/maxMinutes as a hard runtime cap** | **Not implemented anywhere.** `grep -r "maxTurns\|maxMinutes"` across `scripts/`, `hooks/` returns zero hits outside `agents/*.md`, docs, and artifact history. `docs/standards/agent-playbook.md:39` labels the field explicitly: `maxTurns: 20  # advisory ceiling`. `doc-claimed` + `verified-in-code` (absence confirmed by exhaustive grep). | Same. | This is the confirmation the operator asked for: these fields are pure documentation/routing metadata. No process reads them to stop an agent. |
| 4 | **Context/token bloat compounding toward the (harness) cutoff** | Not a separate enforcement layer, but a major *driver* of hitting death mode #1 sooner. Subagent context is append-only; re-verification and full-suite reruns balloon it. | `subagent-token-discipline` memory: one reused builder burned ~657k tokens across 3 tasks by (a) re-executing a 120-file rename "to verify," (b) running a 1493-test suite 5+ times, (c) carrying ~400k tokens forward. `doc-claimed` (session-derived memory, not code-enforced). | No — purely behavioral, upstream of any cap. |
| 5 | **Inline returns losing context on death** | `hooks/lib/check-subagent-return.ts` — a `PostToolUse` hook on `Task`, **warn-only** (`decision: "approve"`, never blocks), threshold 512 bytes, feature `subagent-inline-warn` enabled by default (`.claude/crew.json:4`). `verified-in-code`. | 225 `subagent-return:inline-return-warn` events in `.claude/logs/events.jsonl`. Each warning says: *"write the report to `.claude/artifacts/crew/handoffs/<ts>-handoff-*.md` and return only the absolute path."* Emitted but nothing forces compliance. | N/A — orthogonal to timing caps, but it's the mechanism that turns "died mid-job" into "died mid-job **with no resumable record**." |

### A caveat on the raw log numbers

- **534 `subagent_stop` events are not 534 distinct dispatch endings.** Every sampled `agent_id` has **exactly 2** `subagent_stop` payloads ~1s apart with identical `last_assistant_message` — a duplicate-firing artifact of the hook wiring (`hooks/hooks.json` registers two commands on `SubagentStop`). **Real distinct dispatch endings ≈ 267, not 534.** Reconciles with 292 starts and 216 `task_completed` — ~36 "incomplete" tasks are real but smaller than the raw gap suggested.
- `agent_type` is `"unknown"` on 292/534 stop payloads across the entire date range — ad-hoc `Agent` calls with a custom `name:` rather than a registered `subagent_type`. Means agent-level "which agent dies most" breakdowns from raw logs are unreliable for over half the sample.

**Bottom line on the two-death-mode framing:** it holds, with one correction. Mode 1 (harness cutoff) is real but evidenced only by narrative — treat "tool 82/18min" as `doc-claimed`. Mode 2 (agent maxTurns-as-design) is confirmed and explicitly *not* a bug. Neither cap is runtime-enforced; both are advisory. The only runtime-enforced mechanism in the pipeline is the warn-only inline-return hook (row 5), and it is the one thing standing between "agent died" and "agent died with nothing to resume from."

---

## 2. Quick wins (cheap, low-risk) — ranked by ROI

| Rank | What | Where | Risk | Why it helps |
|---|---|---|---|---|
| 1 | **Make the inline-return hook a real gate for builder-tier agents on code-bearing dispatches**, not just a warning. Currently `runCheckSubagentReturnHook` always returns `decision: "approve"` even when it fires. For `backend-dev`/`frontend-dev`/`fullstack-dev`/`aiplugin-dev` treat a bare inline return with no artifact path as a `block`, forcing one retry turn to write the handoff before the dispatch ends. Keep advisory for read-only/reviewer agents. | `hooks/lib/check-subagent-return.ts`, `scripts/lib/subagent-return/check.ts` | Low — check already computes the signal; only the `decision` value changes for a named subset. Bound spurious retries by allow-listing "no-op" short bodies. | Turns 225 observed inline-return-warns from "logged and ignored" into "context guaranteed resumable." Cheapest lever, largest blast radius. |
| 2 | **Write the handoff artifact incrementally, not only at completion.** Long-running builders (the four with `maxTurns: 60`) overwrite `.claude/artifacts/crew/handoffs/<slice>-in-progress.md` after each major sub-task. Prompt-text change, not new plumbing. | `agents/aiplugin-dev.md`, `agents/backend-dev.md`, `agents/frontend-dev.md`, `agents/fullstack-dev.md` | Low — pure prompt-text; mild token overhead per boundary. | If the cutoff lands *between* tasks (the common case), the in-progress file is already the resumable state — no hook or gate needed. |
| 3 | **Fold `subagent-token-discipline` into the affected agents' prompts** — it lives only in a personal Claude memory file, so it doesn't travel with the repo or apply to fresh sessions/other machines. Add 3 lines to "Guardrails" of the 4 builders: targeted tests only (full suite once, at the final gate); verify by diff/grep never re-execution; stop when the task list is done. | same 4 agents | Very low — documenting an already-learned lesson. | Reduces the context-bloat driver (row 4) that makes agents hit the cutoff sooner. |
| 4 | **Stop frontmatter comments implying enforcement.** `agents/dev-lite.md:14` `maxMinutes: 6 # ... keeps light tier light` reads as if capping wall-clock. Reword to "advisory — not runtime-enforced." | `docs/standards/agent-playbook.md:39`, every `agents/*.md` cap comment | Zero — wording only. | Prevents a repeat of the exact confusion this task was dispatched to resolve. |

---

## 3. Proper options (need real engineering)

| Option | Sketch | Effort | Risk | Failure mode closed |
|---|---|---|---|---|
| **Default `isolation: worktree` + scripted SendMessage-resume for the 4 long-running builders** | Extend the live `Agent`-dispatch wrapper (the runtime call lives in the loop-plugin/command layer; `scripts/lib/slice-linker/dispatch.mts` is a pure plan generator) to always pass `isolation: "worktree"` for the 4 builders, and on a detected cutoff-stop auto re-dispatch via `SendMessage` rather than needing a human to notice. | Medium (2-4 d) — locate + modify the live orchestrator call site + a stop-reason classifier. | Medium — auto-resume on a misbehaving agent could compound cost; needs a resume-attempt cap (1 then escalate). | Closes death mode #1 at the root — resume is currently manual and depends on a human noticing. |
| **Scope-splitting gate before dispatch (refuse oversized slices)** | Estimate slice size (files, LOC delta, FEAT-tag count) against a threshold calibrated from SLICE-107 + the token-discipline memory. If oversized, split at plan time. `skills/workflow/slice-sizing/SKILL.md` is the likely home; wire into `scripts/orchestrate-slice-classify.ts`. | Medium — heuristic + wiring into the existing classify step. | Low-medium — too-conservative fragments slices, adding ceremony cost. | Prevents #1 by never handing an agent more than one dispatch can finish — cause, not recovery. |
| **Auto-checkpoint on approaching cutoff** | True "approaching-cutoff" is impossible from inside the prompt (no self-clock — operator-confirmed, tested, rejected). Only buildable form: checkpoint every N tool calls unconditionally (same as quick-win #2, automated by tool-count). | High for true awareness (not buildable in-repo); Low if redefined as periodic-by-tool-count. | Low if periodic. Do NOT re-attempt as cutoff-awareness. | Marginal beyond quick-win #2 unless combined with worktree+resume. |
| **Grow the GEPA eval corpus** | `docs/superpowers/plans/2026-07-04-arch-review-wave-plan.md:68` (§2.3): FEAT-189 specs authored but corpus n=8/10 vs `min_soak_trials=20`. Operator-only, key-gated (`GROQ_API_KEY`/`GEMINI_API_KEY` + `bun run evals --live`). | Operator time only. | None code-side — risk is trusting promotions before the floor is met. | **Prerequisite, not a fix.** Even a perfect corpus optimizes prompt *behavior* (discipline, earlier stopping, proactive handoffs) — it cannot influence the harness cutoff, which lives outside prompt-space. Don't oversell as a death-mode fix. |

---

## 4. Explicitly rejected

- **maxMinutes as a hard runtime cap.** Confirmed unenforced: zero references outside `agents/*.md`/docs across `scripts/`+`hooks/`; `docs/standards/agent-playbook.md:39` labels it `# advisory ceiling`. No code path reads these to stop a dispatch. The harness's own budget (external to this repo) is the real backstop and fires regardless of declared caps (SLICE-107 died at tool 82, above `maxTurns: 60`).
- **Agent self-timing ceremony.** Structurally sound rejection: an agent has no reliable way to estimate elapsed wall-clock from inside a prompt — no clock tool, and turn-count ≠ time (a `Bash` build vs a `Read` are not equivalent ticks). The cutoff-vs-cap unit mismatch in death mode #1 reinforces that the binding constraint isn't even the same unit the agent could self-monitor.
- **Auto-checkpoint framed as "approaching the harness cutoff."** Same root problem — the cutoff is external and invisible, so "approaching it" isn't computable from inside the dispatch. Only the dumb periodic form is buildable.

---

## 5. Recommendation — do these first, in order

1. **Quick win #1 + #3 together, same PR** (inline-return hook → real gate for the 4 builders; fold token-discipline into their prompts). Prompt-text + one small hook-logic change; addresses the two most evidence-backed problems (225 inline-return-warns; a documented 657k-token blowout). Low risk, immediately measurable — inline-return-warn count should drop toward zero for builder-tier agents.
2. **Quick win #2** (incremental in-progress handoff writes) as a fast follow — cheapest way to make a mid-task cutoff resumable without touching the orchestrator/dispatch layer (out of this repo's direct control anyway).
3. **Then, only if death-mode-1 frequency stays material:** the scope-splitting gate (proper option 2) — the only structural fix that reduces *how often* a builder needs more than one dispatch's budget. Hold off on worktree+auto-resume until the resume-cap-loop risk has a design; don't chase corpus-growth as a death-mode fix — it solves prompt-optimization inputs, not dispatch-budget mechanics.

Do **not** revisit maxMinutes-as-hard-cap or self-timing ceremonies — both are confirmed dead ends for structural reasons, not just "not yet implemented."
