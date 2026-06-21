---
name: builder-ceremony
prompt_id: builder-ceremony
version: 1.0.0
tier: workflow
model_pinned: sonnet
description: Builder dispatch ceremony — completion handoff CLI invocation, self-verify gates, workflow badges, secret grep, commit discipline, prior-handoff extraction, context ceiling. Loaded by backend-dev / frontend-dev / fullstack-dev so the builder prompts focus on the JOB and consult this skill only at slice boundaries.
triggers: ["write-handoff", "completion", "bundle", "badge", "self-verify", "secret grep", "context ceiling"]
---

# Builder ceremony — handoff + gates + badges

Consult at slice boundaries (start, mid-pause, completion). Builder prompts stay focused on implementation; this skill carries the dispatch protocol details that change rarely but matter every time.

## Trigger

Load this skill when:
- About to write the completion handoff (write-handoff-and-bundle)
- Need to emit a workflow badge (blocked, help_request, escalated_to_orchestrator)
- Running self-verify gates before handoff
- Hit context ceiling mid-slice
- Resuming from a prior handoff
- Pre-completion secret grep
- Commit decision (`dev.stable` policy)

Single-purpose tasks (writing one line, fixing a typo) skip this skill — the ceremony exists for substantive slice work.

## Completion handoff

At completion, write the report + bundle in ONE call:

```bash
: "${CLAUDE_PLUGIN_ROOT:?must be set}"
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff-and-bundle \
  --repo "$PWD" \
  --title "<short title>" \
  --summary "<one-sentence headline>" \
  --files "<comma-separated files you modified>" \
  --confidence "<high|medium|low>"
```

Minimum required: `--title`, `--summary`, `--files`, `--confidence`. Add optional flags only when they add value:

| Optional flag        | Add when                                                            |
| -------------------- | ------------------------------------------------------------------- |
| `--risks "..."`      | Residual risks, scope-cross findings, deferred follow-ups exist     |
| `--next "..."`       | A specific next handoff is clearly indicated (else orchestrator decides) |
| `--deliverable "..."` | The shipped artifact diverges from what the title suggests          |
| `--feat FEAT-NNN`    | You know the FEAT id from the dispatch (helps bundle attribution)   |
| `--files-read a,b`   | You Read meaningful files that are NOT in your diff (rare — skip by default; bundle inlines diff already) |
| `--builder <name>`   | You are `backend-dev` or `frontend-dev` (default `fullstack-dev` is fine for generalist) |

Auto-resolved (do NOT pass): `--slice` (read from `workflow-state.json`), `--run` (ISO timestamp), `--from` (defaults to your agent name), `--to` (defaults `orchestrator`), `--status` (`completed`).

The CLI returns JSON: `{ handoff: <path>, bundle: <path>, bundleError: null|"msg" }`. Bundle write is **non-blocking** — if `bundleError` is non-null, log it and still return success. Return to the orchestrator ONLY:

```
Handoff: <handoff path>
Bundle: <bundle path or "skipped: <bundleError>">
<1–3 sentence headline>
```

Do NOT inline the full report body — that re-inflates the orchestrator's context and triggers compactions.

## Stub artifact on entry (FEAT-161 risk #1)

Before any Read, Grep, or Bash investigation, your FIRST tool call MUST be:

```bash
node scripts/crew.ts write-handoff --scaffold --status in-progress --confidence low --summary "starting investigation" --run-title "<run title from dispatch>"
```

This establishes the artifact path. At the end of your run (after self-verify gates pass or you hit a blocker), re-invoke the same command with `--update <path-from-scaffold>` carrying your real verdict, confidence, and summary.

Idempotency confirmed per DEC-019 / `tests/artifact-stub-and-update.test.ts` scenarios 3–9 — `--scaffold` and `--update` both supported across `write-handoff`, `write-review-result`, `write-validation-result`. No CLI change needed.

## Self-verify gate

Before writing the handoff, run scoped gates per `skills/workflow/self-verify-gate/`. Each gate reports **PASS / FAIL / SKIPPED / TIMEOUT** — FAIL halts; others proceed (verifier picks up the deferred check). Your handoff body MUST include the `## Self-Verify Gates` section the skill specifies — `commands/orchestrate-slice.md` hard-gates on it.

## Pre-completion secret grep

Before writing the handoff, scan your diff:

```bash
git diff "$SLICE_BASE" -- ':(exclude)*.lock' | grep -E -i '(api[_-]?key|secret|password|token|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,})='
```

Any match → halt + `mark-badge blocked --note "secrets in diff"`. False positives → `# pragma: allowlist secret` on the line + document under handoff `--risks`.

## Workflow badges

When you hit an external blocker or need to escalate before writing the handoff, emit a badge BEFORE writing the handoff. The badge surfaces in `brief-me` and `wake-up`; the handoff body carries the detail.

```bash
: "${CLAUDE_PLUGIN_ROOT:?must be set}"

# External blocker (missing decision, API down, scope boundary crossed)
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge blocked --note "<reason>"

# Escalate when a decision is beyond agent judgment
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge escalated_to_lead --note "<reason>"
# NOTE: badge name is `escalated_to_lead` for CLI compatibility; semantically
# this means "escalated to whatever orchestrator dispatched this run" —
# interactive Claude session, /crew:build, autonomous loop, etc.

# Help request when a peer dispatch can't unblock you
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge help_request --note "<reason>"

# Record a skipped validation gate (when you own that decision)
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"

# Context ceiling: 50 tool uses or 100K context tokens before all ACs complete
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge blocked --note "context_ceiling_reached: [list remaining ACs]"
# Then write a --confidence low handoff with --risks "context ceiling reached; remaining ACs: [list]".
# Do NOT attempt inline recovery or partial commits for remaining ACs.
# Return: DONE_WITH_CONCERNS: context ceiling reached — see handoff for scope completed so far.
# Orchestrator splits remaining ACs into a fresh bounded task and dispatches a new builder.
```

## Prior handoff extraction

Resuming a prior handoff: extract these BEFORE exploring files —

- `## Repo Layout` (use it, do NOT re-discover via `ls`/`find`)
- `--risks` (scope-cross flags = read-only constraints for you)
- `## Self-Verify Gates` FAIL state (your starting point, not a fresh build)
- `--next` (confirms scope)

Saves 3–5 tool turns per resumed run.

## Commit discipline

Default: never commit without explicit user request.

**`dev.stable: true` worktree carve-out** (constitution revised 2026-06-21):

Commit autonomously when ALL of:
- `.claude/crew/deployment.md` has `dev.stable: true`
- You are on a feature branch or isolated git worktree (NOT `main` / `master`)
- **Slice-scoped tests pass** (the tests that actually exercise the changed files)
- No `help_request` badge open
- Pre-completion secret grep passed (no credentials in diff)
- Local commit only — never tag, force-push, or production deploy

**NOT required to block the commit** (deferred to orchestrator's review cycle):

- `tsc --noEmit` / `dotnet build` typecheck — advisory
- Biome / Roslyn lint — advisory
- `bun run format:check` — advisory

Rationale: slice-scoped tests catch functional regressions. typecheck / lint / format catch style + type drift — those are cheap to fix later in the review dispatch, and on C# / large solutions they cost 30s+ per cycle. Blocking autonomous commits on every full-suite gate kills slice velocity.

Use the `git-commit` skill for message authoring. When in doubt, write the handoff with `--risks "commit deferred for orchestrator review"` and let the orchestrator decide.

## Handoff before stop (final-tool-call rule, simplified)

Before returning to the orchestrator, do TWO things in order:

1. **Emit a badge** if applicable (blocker / help_request / escalated_to_lead / validation_skipped / context_ceiling). Optional if the run completed cleanly.
2. **Write the handoff** via `write-handoff-and-bundle` (or `write-handoff --update <stub>` for resumed runs).

Then return 2-3 lines to the orchestrator:

```
Handoff: <handoff path>
Bundle: <bundle path or "skipped: <reason>">
<1–2 sentence headline>
```

That's it. The orchestrator reads the handoff body, not your inline reply — don't paste the full report.

**Light tasks** (`size: light` per the dispatch hint): skip the stub + final handoff, return inline only with the 2-3 line summary. If a light task expands mid-flight, escalate to standard and write the handoff.

**Contract violation**: returning narration ("Done, let me explain...") without (1) writing the handoff artifact and (2) returning the 2-3 line summary. The artifact is the durable record; the summary is the orchestrator's pointer to it.

## Orchestrator terminology note

"Orchestrator" in this skill = whatever entity dispatched the builder run. Could be:
- Main interactive Claude session
- `/crew:build` command flow
- Autonomous loop walker (`/loop:slice start` → `slice-build` dispatch)
- Explicit `crew:lead` dispatch

The builder doesn't need to know which — write the handoff + emit badges, and whichever entity dispatched will read them at the next cycle. The CLI flag defaults (`--to lead`, `escalated_to_lead`) use "lead" for backward compatibility; semantically read as "orchestrator".
