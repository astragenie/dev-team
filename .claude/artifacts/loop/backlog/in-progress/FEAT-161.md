---
id: FEAT-161
status: done
priority: P1
category: reliability
target_release: null
created: 2026-06-11
updated: 2026-06-13
depends_on: []
slices: [SLICE-70, SLICE-72]
derived_from: null
pm_customer_impact: 0.8
pm_effort_estimate: 0.4
pm_strategic_alignment: 0.8
pm_technical_risk: 0.4
pm_dependency_depth: 0.2
composite_score: 0.73
autonomous_safe: false
tags: [agent-prompts, dispatch, reliability, specialist-pause]
triage_notes: "via=pm triage 2026-06-12 | Demand: 11 documented recurrences across SLICE-51..57/87/95/96 in 6 days @ ~150k tokens each (FEAT body lines 21-29). Workaround intolerable. NOTE: cited upstream-request doc loop/docs/upstream-requests/2026-06-10-...specialist-pause-completion-enforcement.md NOT FOUND at expected path — internal recurrence table is the load-bearing evidence; ask user to attach/relink before SLICE-A. SCOPE BLOCKER: FEAT body lists agents that don't exist in this repo (builder.md, reviewer.md, validator.md, builder-fe.md, builder-be.md, reviewer-validator.md, deployer.md). Actual dispatchable specialists are backend-dev, frontend-dev, fullstack-dev, inspector, inspector-verifier, verifier, lead, architect, integrator, release-engineer. SPEC REWRITE REQUIRED before slicing — recommend loop:spec-writer pass to realign Prong A target list to the current agent set (9-agent list in FEAT is wrong). Risk band 0.40: prompt-only edits, single-file-per-agent, git revert clean rollback, no contract change. Prong B prerequisite (crew write-* idempotent double-call or --update) appears already met by tests/artifact-stub-and-update.test.ts — verify before scoping SLICE-A1. Pre-mortem: (1) Two weeks later — agents follow HARD CONTRACT but lead tool-loop still exits without final call (root cause is the orchestrator's exit condition, not the specialist's last-tool intent); prompt block conflicts with v0.35.2 identity-anchor positioning. (2) Rollback = single git revert; no migration. (3) Coverage gap: zero runtime behavioral assertion that 'agent emits final write-* tool call'; agent-prompt-content.test.ts only checks markdown structure. AC must add content assertion ('HARD OUTPUT CONTRACT block exists at first heading after identity anchor') OR coordinate with FEAT-162 for behavioral coverage. Cost analog: SLICE-64 prompt-only Path A $1.88 + SLICE-68 prompt+skill edits — Prong A across 9 agent files is ~3-4x SLICE-64 scope; estimate $8-15. autonomous_safe=false per CLAUDE.md (lead prompt edits, skill authorship require human-in-loop) AND because FEAT body needs spec rewrite to align with current agent set."
spec_rewrite: "via=loop:spec-writer 2026-06-13 | Realigned Prong A target list to actual agent set in agents/*.md (N=12: lead + 11 specialists; advisory/read-only agents excluded). Confirmed crew write-* --update semantics already exist (tests/artifact-stub-and-update.test.ts scenarios 3, 4, 5). SLICE-A1 (add --update semantics) DROPPED. Converted acceptance hints to Given-When-Then ACs with concrete pass criteria. Confirmed upstream-request doc absence — internal recurrence table is the load-bearing evidence. Per-slice decomposition updated."
started_at: 2026-06-13
slices_complete: [SLICE-70, SLICE-72]
completed_at: 2026-06-13
---
# FEAT-161: Specialist-pause prevention — stub-artifact pattern + HARD OUTPUT CONTRACT in agent prompts

## Description

Specialist dispatches (`crew:lead`, implementer roles, review roles, validation roles) regularly **pause mid-investigation and return without completing their mandatory `write-handoff` / `write-review-result` / `write-validation-result` step**. The parent receives narration ("I'll now check X", "Let me dispatch Y") with no tool call attached. The agentic loop's standard termination condition reads this as the final answer and returns. Parent has no artifact path, gate is unresolved, parent has to write a skip-badge or re-dispatch — costing ~150k tokens per recurrence.

Observed across ≥11 slices in three sessions:

| Session | Slices | Roles |
|---|---|---|
| 2026-06-06 | SLICE-51..57 (6 slices) | reviewer ×2, builder ×5, validator ×4 |
| 2026-06-10 | SLICE-87 | builder ×2, reviewer ×1 |
| 2026-06-11 | SLICE-95, SLICE-96 (loop repo) | lead ×2 (new — orchestrator pause) |

**Load-bearing evidence:** the recurrence table above. The earlier draft cited `loop/docs/upstream-requests/2026-06-10-hero-crew-specialist-pause-completion-enforcement.md`; that path does NOT exist in this repo or the sibling loop checkout (verified 2026-06-13 via `Glob **/upstream-requests/**/*specialist-pause*` → no files found). Treat the table as the load-bearing demand evidence until/unless the upstream-request doc is relinked.

**Prompt-level mitigation already proven insufficient where it was applied at the wrong position.** Earlier mitigations buried the "must call write-*" rule deep in the prompt body. Six agents (`lead`, `fullstack-dev`, `frontend-dev`, `backend-dev`, `inspector`, `verifier`) now front-load a `## HARD OUTPUT CONTRACT (read first, every dispatch)` block immediately after their identity anchor (verified 2026-06-13 via `Grep`). The remaining six dispatchable specialists do not. This FEAT closes that gap and adds the stub-artifact-on-entry pattern that degrades pauses gracefully even when the contract block is read but mid-run reasoning still drops the final tool call.

## Realigned target agent set (Prong A, N=12)

Source of truth: `agents/*.md` in this repo (excluding the read-only `agents/3rdparty/` mirror). Each agent's contract enumerates the **valid last tool calls** before returning to the parent. The list excludes non-dispatchable / read-only / advisory specialists (see [Out of scope](#out-of-scope) below).

| Agent | Role | Valid LAST tool call variants | HARD CONTRACT today? |
|---|---|---|---|
| `lead` | orchestrator | `Agent` (dispatch next specialist) OR `Agent` dispatching `crew:document-writer` for slice close / `mark-badge` (lead has no `Bash`) | YES (line 21) |
| `architect` | designer | `Write`/`Edit` (ADR / OpenAPI YAML / design doc inside write boundary) OR `Bash crew write-handoff` OR `Agent` (delegating to specialist) | NO — add |
| `backend-dev` | implementer | `Bash crew write-handoff` OR `Write`/`Edit` (last code change before handoff) | YES (line 39) |
| `frontend-dev` | implementer | `Bash crew write-handoff` OR `Write`/`Edit` (last code change before handoff) | YES (line 39) |
| `fullstack-dev` | implementer | `Bash crew write-handoff` OR `Write`/`Edit` (last code change before handoff) | YES (line 39) |
| `inspector` | reviewer | `Bash crew write-review-result` | YES (line 33) |
| `inspector-verifier` | reviewer+validator (light tier) | `Bash crew write-review-result` AND `Bash crew write-validation-result` (both required) | NO — add |
| `verifier` | validator | `Bash crew write-validation-result` | YES (line 32) |
| `integrator` | wire-up smoke | `Bash crew write-handoff` (integration artifact uses handoff kind per `docs/standards/integration-artifact-schema.md`) | NO — add |
| `release-engineer` | deployer | `Bash crew write-deployment-check` OR `Bash crew write-handoff` | NO — add |
| `document-writer` | docs / slice-close CLI owner | `Bash crew write-final-synthesis` / `slice complete` / `slice grade` / `mark-badge` (whichever closes the dispatched job) OR `Write`/`Edit` (last doc change) | NO — add |
| `refactor` | quality sweep | `Bash crew write-handoff` (quality-sweep artifact) | NO — add |

**Net work for Prong A:** add a `## HARD OUTPUT CONTRACT (read first, every dispatch)` block to 6 agent prompts (`architect.md`, `inspector-verifier.md`, `integrator.md`, `release-engineer.md`, `document-writer.md`, `refactor.md`). The other 6 are already compliant; the test extension in AC-1 below covers all 12 so regressions on the existing 6 are caught.

### Out of scope

These agents are NOT covered by Prong A. Each has a documented reason:

- `investigator` — Haiku-tier read-only locator; explicitly designed so "the answer dies with the turn" (see `agents/investigator.md` line 13). Inline narration IS its output contract; forcing a final `write-*` would break its cost model. Lead dispatches it for cheap file:line lookups.
- `researcher` — read-only, returns findings inline; same rationale.
- `qa-expert`, `performance-engineer`, `uxdesigner` — advisory specialists invoked for narrow audits. If recurrence is observed on these, scope a follow-up FEAT after Prong A lands.
- `parallel-runner` — worktree orchestrator (per ADR-001 / DEC-015); operates over isolated `.claude/state/` trees and its output contract is per-worktree artifact aggregation, not a single `write-*` call.

## Acceptance Criteria

### SLICE-A (Prong A — HARD OUTPUT CONTRACT block on 6 missing agents)

**AC-1 (content assertion across all 12 targeted agents):**
- **Given** the 12 agents listed in [Realigned target agent set](#realigned-target-agent-set-prong-a-n12),
- **When** `tests/agent-prompt-content.test.ts` runs (extended with a new `## HARD OUTPUT CONTRACT — Prong A coverage` block),
- **Then** for each agent file the test MUST assert all of:
  1. The literal heading `## HARD OUTPUT CONTRACT (read first, every dispatch)` appears in the file.
  2. That heading appears **before** the first occurrence of `## Workflow`, `## Job`, `## Procedure`, `## Golden Path`, `## Inputs`, or `## Operating principles` (whichever exists first in the file) — verified by `indexOf` comparison on the file string. This enforces "front-loaded, before any tactical guidance".
  3. The block body contains the literal phrase `"Your LAST tool call before returning"`.
  4. The block body contains the literal phrase `"Returning narration"` AND the literal phrase `"contract violation"`.
  5. The block body contains the agent-specific valid-last-tool-call list from the table above (asserted by literal substring on at least one valid CLI/tool name per row, e.g. `write-handoff` for `fullstack-dev`, `write-review-result` for `inspector`, `Agent` dispatch keyword for `lead`).

  **Pass criteria:** `bun test tests/agent-prompt-content.test.ts` exits 0 with all new assertions green; the existing assertions in that file (lines 21-191) remain green (no regression).

**AC-2 (HARD CONTRACT block placement is immediately after identity anchor, where one exists):**
- **Given** the 4 agents in the target set that today carry an explicit `## Identity anchor` section (`fullstack-dev`, `frontend-dev`, `backend-dev`, and any other where one is added),
- **When** the test asserts heading order,
- **Then** the substring index of `## HARD OUTPUT CONTRACT (read first, every dispatch)` MUST satisfy `idx(HARD_CONTRACT) > idx(Identity anchor) AND idx(HARD_CONTRACT) < idx(any tactical heading from AC-1.2)`.
- For the 8 agents without an identity anchor, the HARD CONTRACT block MUST appear after the file frontmatter close (`---`) and the `## Custom instructions` section (if present), but before any tactical heading from AC-1.2.

**AC-3 (no behavior regression on existing 6 agents):**
- **Given** the 6 agents that already carry the HARD CONTRACT block (`lead`, `fullstack-dev`, `frontend-dev`, `backend-dev`, `inspector`, `verifier`),
- **When** SLICE-A lands,
- **Then** the existing HARD CONTRACT text in those files MUST NOT be reworded or moved; only the test coverage extends to them. Diff check: `git diff --stat` on SLICE-A MUST show file modifications limited to the 6 agents in the "add" column (`architect`, `inspector-verifier`, `integrator`, `release-engineer`, `document-writer`, `refactor`) plus `tests/agent-prompt-content.test.ts`. Any modification to the 6 already-compliant agent files in the same slice is a scope violation and fails AC-3.

**AC-4 (cite-back from each block):**
- **Given** each newly added HARD CONTRACT block,
- **When** the test scans block contents,
- **Then** the block body MUST contain the literal path `.claude/artifacts/loop/backlog/triaged/FEAT-161.md` (or wherever this FEAT then lives — the path SHOULD be resolved at edit time to the actual triaged/in-progress/done location) so future maintainers can trace the policy back to its source.

**AC-5 (full CI green):**
- **Given** SLICE-A's diff,
- **When** `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and the validator chain (`node ./scripts/validate-agents.ts`, `node ./scripts/validate-manifests.ts`, `node ./scripts/validate-skills.ts`, `node ./scripts/validate-slices.ts`) run,
- **Then** all MUST exit 0. The `validate-agents.ts` 350-line cap MUST hold on every modified prompt — if a HARD CONTRACT block pushes any agent past 350 lines, that agent's edit must be deferred and the overflow logged as a follow-up FEAT.

### SLICE-B (Prong B — stub-artifact-on-entry instruction)

**AC-6 (stub-on-entry instruction added to 5 artifact-owning roles):**
- **Given** the 5 agents that own a `write-*` artifact contract (`fullstack-dev`, `frontend-dev`, `backend-dev`, `inspector`, `verifier`); `inspector-verifier` is included because it owns BOTH a review-result AND a validation-result write; `integrator`, `release-engineer`, `refactor` are included because they own `write-handoff` / `write-deployment-check`,
- **When** SLICE-B lands,
- **Then** each prompt MUST contain a literal `## First action (stub artifact on entry)` heading whose body instructs the agent: before any `Read`, `Grep`, or substantive `Bash` investigation, invoke the relevant `crew write-* --status in-progress --summary "starting investigation" --scaffold` (or `--status in-progress --summary ...` if the agent prefers explicit values over the scaffold skeleton). The instruction MUST capture the resulting artifact path and re-invoke `crew write-* --update <path> ...` at completion with the real verdict.

**AC-7 (idempotency prerequisite already met — no CLI change needed):**
- **Given** `tests/artifact-stub-and-update.test.ts` (scenarios 3, 4, 5 — lines 88-253),
- **When** read at 2026-06-13,
- **Then** the test file MUST already exercise:
  - `write-handoff --update <path>` overwriting a stub in place without creating a second file (scenario 3, line 88),
  - `write-review-result --update <path>` overwriting a stub with a final decision (scenario 4, line 156),
  - `write-validation-result --update <path>` overwriting a stub with a final decision (scenario 5, line 206),
  - the `--scaffold` flag emitting a skeleton with empty judgment fields (scenarios 7, 8, lines 298, 326),
  - scaffold-then-update flow finalizing correctly (scenario 9, line 353).
- **Pass criteria:** verified READ at the start of SLICE-B; if these tests have regressed or been removed by the time SLICE-B starts, SLICE-B blocks pending a `scripts/crew.ts` patch (re-add `--update` semantics). At time of FEAT rewrite (2026-06-13) the tests are present and the prerequisite is met — SLICE-A1 ("add `--update` semantics") is DROPPED.

**AC-8 (stub artifact is detectable by parent):**
- **Given** an agent that wrote a stub and then paused mid-run without re-invoking `crew write-* --update`,
- **When** the lead checks for the artifact,
- **Then** a stub-but-not-finalized state MUST be detectable: the stub MUST contain `Status: in-progress` (verified by `tests/artifact-stub-and-update.test.ts` scenario 1, line 39) and MUST omit a final decision field. The lead's existing dispatch-resume logic SHOULD be able to read the stub and either re-dispatch with `--update <stub-path>` context OR mark a `help_request` badge. (This AC is a content assertion only — wiring the lead to read stubs is a separate FEAT; SLICE-B only ensures the stub IS detectable.)

**AC-9 (full CI green for SLICE-B):**
- Same gate set as AC-5 applied to SLICE-B's diff.

### SLICE-C (OPTIONAL — instrument `crew write-*` CLI with a structured "promoted from stub" log line)

Defer until production observability signal shows the lead cannot distinguish stub-promoted artifacts from normal completions. Not in scope for the next slicing round.

## Per-slice decomposition (updated)

- **SLICE-A** (~2-3h, prompt-only): Prong A — add HARD CONTRACT block to 6 agent prompts (`architect`, `inspector-verifier`, `integrator`, `release-engineer`, `document-writer`, `refactor`). Extend `tests/agent-prompt-content.test.ts` with the AC-1/2/3/4 assertions across all 12 targeted agents. No behavior change in the dispatch loop. Files changed: 6 agent prompts + 1 test file.
- **SLICE-B** (~2-3h, prompt-only): Prong B — add `## First action (stub artifact on entry)` heading + instruction to the 8 artifact-owning roles (`fullstack-dev`, `frontend-dev`, `backend-dev`, `inspector`, `inspector-verifier`, `verifier`, `integrator`, `release-engineer`, `refactor`). No CLI changes (AC-7 confirmed `--update` already shipped). Test extension: assert each of the 8 prompts contains the literal `## First action (stub artifact on entry)` heading and the literal `--scaffold` or `--status in-progress` substring + the `--update` substring.
- **SLICE-A1 (DROPPED)** — was "add `--update` semantics to `scripts/crew.ts`". Already shipped per `tests/artifact-stub-and-update.test.ts` scenarios 3, 4, 5. No work needed.
- **SLICE-C (OPTIONAL, deferred)**: instrument the `crew write-*` CLI to emit a structured "artifact updated from pending" log line so the parent can distinguish a stub promotion from a normal completion. Park behind explicit "lead can't tell stub-promoted from normal" observability trigger.

## Notes

- Loop side (`sergeymilashico/loop`) was expected to maintain a matching upstream-request at `docs/upstream-requests/2026-06-10-hero-crew-specialist-pause-completion-enforcement.md`. That file is NOT present in this checkout's loop sibling (verified 2026-06-13 via Glob `**/upstream-requests/**/*specialist-pause*` → no results). The internal recurrence table above is the load-bearing evidence. If the upstream-request gets attached later, link it from this section.
- Loop's `docs/sop/specialist-pause-handling.md` documents the parent-side workaround in use today (verify artifact landed; on miss, write inline or mark skip badge). That SOP becomes redundant once SLICE-A and SLICE-B both land.
- Decision boundary with loop: harness-level enforcement (e.g. re-prompt on tool-less exit) is Claude Code territory, NOT hero-crew. This FEAT scopes hero-crew to prompt-level changes only — the realistic, in-scope fix surface. The CLI surface needed for Prong B (`--update`, `--scaffold`, `--status in-progress`) already exists per the tests in AC-7.
- Loop will hold off on local mitigation (HARD CONTRACT injection in dispatch.mts) until this FEAT lands. Local mitigation was prototyped + reverted on 2026-06-11 (commit a9fde62) to avoid duplicate maintenance.
- `autonomous_safe: false` is retained — prompt edits across 6 agent files (Prong A) and 8 agent files (Prong B) qualify as the "lead prompt edits / skill authorship" class per CLAUDE.md, which requires human-in-the-loop on review even when the loop picks it.
