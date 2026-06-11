---
id: FEAT-161
status: pending
priority: P1
category: reliability
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
tags: [agent-prompts, dispatch, reliability, specialist-pause]
---
# FEAT-161: Specialist-pause prevention — stub-artifact pattern + HARD OUTPUT CONTRACT in agent prompts

## Description

Specialist dispatches (`crew:lead`, `crew:builder`, `crew:builder-fe`, `crew:builder-be`, `crew:reviewer`, `crew:validator`) regularly **pause mid-investigation and return without completing their mandatory `write-handoff` / `write-review-result` / `write-validation-result` step**. The parent receives narration ("I'll now check X", "Let me dispatch Y") with no tool call attached. The agentic loop's standard termination condition reads this as the final answer and returns. Parent has no artifact path, gate is unresolved, parent has to write a skip-badge or re-dispatch — costing ~150k tokens per recurrence.

Observed across ≥11 slices in three sessions:

| Session | Slices | Roles |
|---|---|---|
| 2026-06-06 | SLICE-51..57 (6 slices) | reviewer ×2, builder ×5, validator ×4 |
| 2026-06-10 | SLICE-87 | builder ×2, reviewer ×1 |
| 2026-06-11 | SLICE-95, SLICE-96 (loop repo) | lead ×2 (new — orchestrator pause) |

Full evidence + verbatim final turns: `loop/docs/upstream-requests/2026-06-10-hero-crew-specialist-pause-completion-enforcement.md`.

**Prompt-level mitigation already proven insufficient.** `agents/builder.md:213` already declares: *"Inline-only return (path + headline without a written artifact) is a contract violation on a standard task."* Specialists still pause despite this. Instructions positioned at LINE 213 do not gate the agentic loop's exit condition — by the time the agent reaches that section, it's already mid-investigation and the rule is buried.

## Acceptance hints

**Two-pronged fix. Both prongs apply prompt-level only — no harness changes required.**

### Prong A — HARD OUTPUT CONTRACT block (front-loaded)

Add a HARD OUTPUT CONTRACT section to every dispatchable agent prompt (`lead.md`, `builder.md`, `builder-be.md`, `builder-fe.md`, `reviewer.md`, `reviewer-validator.md`, `validator.md`, `architect.md`, `deployer.md`, `integrator.md`) — positioned **immediately after the identity section**, before any tactical guidance. Block contents:

- Header: `## HARD OUTPUT CONTRACT (read first, every dispatch)`
- Preamble: "Your LAST tool call before returning MUST be one of: [variant list]. Returning narration without a final tool call is a contract violation. The recurring failure mode is responses ending mid-intent ('I'll now do X', 'Let me check Y') — do NOT do this."
- Variant list per role:
  - `lead`: `Agent` (next specialist) OR `Bash` (`/loop:slice complete` / `slice grade`)
  - `builder*` / `reviewer*` / `validator`: `Bash` (`crew write-handoff` / `write-review-result` / `write-validation-result`) OR `Write` / `Edit` (file change that captures the verdict)
- Citation: link to this FEAT + the upstream-request doc.

### Prong B — Stub-artifact pattern (first-action enforcement)

For roles that own a write-* artifact (builder, reviewer, validator), the prompt mandates:

> **First action upon dispatch (before any Read, Grep, or Bash investigation)**: write a stub artifact via the appropriate `crew write-* --confidence low --decision pending --summary "starting investigation"` invocation. The stub establishes the artifact path. At the end of the run, the same write-* command is run again (overwriting or appending) with the real verdict + confidence.

This degrades pauses gracefully: a mid-run pause leaves a `decision: pending` artifact the parent can detect (instead of nothing), then either re-dispatch with the partial artifact or escalate via badge.

Prerequisite: confirm `crew write-handoff` / `write-review-result` / `write-validation-result` either (a) accept being called twice on the same slice-id and overwrite, or (b) take a `--update` flag. If neither holds, scope a SLICE-A1 to add `--update` semantics to `scripts/crew.ts`.

### Per-slice decomposition suggestion

- **SLICE-A**: Prong A — prompt edits across 9 agent files. Pure markdown. Tests: existing snapshot tests on prompt content (if any) updated. No behavior change in the dispatch loop.
- **SLICE-B**: Prong B — stub-artifact-on-entry instruction added to builder/reviewer/validator prompts. Depends on `crew write-*` supporting double-call or `--update` (verify or add).
- **SLICE-C** (optional): instrument the `crew write-*` CLI to emit a structured "artifact updated from pending" log line so the parent can distinguish a normal completion from a stub-promoted-to-real artifact.

## Notes

- Loop side (`sergeymilashico/loop`) maintains the matching upstream-request at `docs/upstream-requests/2026-06-10-hero-crew-specialist-pause-completion-enforcement.md`. Originally drafted 2026-06-10; amended 2026-06-11 to add `crew:lead` after SLICE-95/96 observations.
- Loop's `docs/sop/specialist-pause-handling.md` documents the parent-side workaround in use today (verify artifact landed; on miss, write inline or mark skip badge). That SOP becomes redundant once this FEAT lands.
- Decision boundary with loop: harness-level enforcement (e.g. re-prompt on tool-less exit) is Claude Code territory, NOT hero-crew. This FEAT scopes hero-crew to prompt-level + write-* CLI changes only — the realistic, in-scope fix surface.
- Loop will hold off on local mitigation (HARD CONTRACT injection in dispatch.mts) until this FEAT lands. Local mitigation was prototyped + reverted on 2026-06-11 (commit a9fde62) to avoid duplicate maintenance.
