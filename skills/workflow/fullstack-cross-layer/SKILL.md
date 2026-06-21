---
name: fullstack-cross-layer
tier: workflow
version: 1.0.0
prompt_id: fullstack-cross-layer
model_pinned: sonnet
description: Loaded on-demand by crew:fullstack-dev for cross-layer slices spanning both BE and FE surfaces. Covers stack-specific skill routing (file-class → skill table), TDD policy per slice type, context-efficiency rules, and shell/Bash conventions extracted from agents/fullstack-dev.md.
---

# Fullstack cross-layer skill

Detailed routing + procedure extracted from `agents/fullstack-dev.md` (FEAT-170 SLICE-B). Loaded on-demand for slices that genuinely span BE + FE surfaces. Single-surface slices re-route to `crew:backend-dev` or `crew:frontend-dev` per `docs/routing-table.md`.

## When to load

- Slice touches BOTH backend (`api/`, `server/`, `services/`, `*.cs`, `*.py`) AND frontend (`src/components/`, `src/pages/`, `*.tsx`, `*.css`)
- Slice has FEAT `surface:fullstack` tag
- Lead dispatched explicitly with cross-layer scope

Skip loading for pure-BE, pure-FE, doc-only, hooks/agents/skills/commands edits. The 5-cap on skill consults counts this skill if loaded.

## Skill resolution (full file-class table)

`docs/routing-table.md` is the authoritative dispatch map. Load the SMALLEST set that covers the slice — bloat slows the inner loop.

| Touched path                              | Skill / plugin                                                   |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `agents/*.md`                             | `plugin-dev:agent-development` + `skills/domain/prompt-engineering/` |
| `skills/**/SKILL.md`                      | `plugin-dev:skill-development` + `skills/meta/skill-creator/`    |
| `commands/*.md`                           | `plugin-dev:command-development`                                 |
| `hooks/*`                                 | `plugin-dev:hook-development`                                    |
| `plugin.json` / `marketplace.json`        | `plugin-dev:plugin-validator` (pre-commit check)                 |
| `*.ts` / `*.tsx`                          | `skills/domain/typescript-pro/`                                  |
| `*.cs` / `*.csproj` / `appsettings*.json` | `skills/domain/backend/dotnet/csharp-conventions/` + `skills/domain/backend/dotnet/aspnetcore-patterns/` (load `ef-core-patterns/` only when EF Core touched). For deep BE work → re-route to `crew:backend-dev` |
| `*.py`                                    | `skills/domain/python-pro/`                                      |
| Backend logic (server, API, data layer)   | `skills/domain/backend-advisory/`                                |
| Full-stack spanning FE + BE               | `skills/domain/fullstack-advisory/`                              |
| MCP server authoring / debugging          | `skills/domain/mcp-integration/`                                 |
| AI app / LLM SDK code                     | `skills/domain/ai-engineering/`                                  |
| Drafting a commit message                 | `skills/workflow/git-commit/`                                    |
| Bug RCA / intermittent failure            | `skills/workflow/root-cause-discipline/`                          |

If you find yourself reaching for `frontend-design`, `tailwind-patterns`, `react-engineering`, or anything visual-heavy → STOP and ask the lead to re-route to `crew:frontend-dev`. Same for deep backend work → `crew:backend-dev`. Mobile is out of scope for this product — refuse mobile work and surface via `mark-badge blocked --note "mobile not supported"`.

## TDD policy

Procedure of record: superpowers `test-driven-development` skill (`~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/test-driven-development/SKILL.md`).

| When the task is…                                                                        | TDD required?                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Net-new behavior (new public function, new artifact kind, new CLI subcommand, new badge) | **Yes** — write the failing test first                 |
| Bug fix where the bug has no regression test                                             | **Yes** — write the failing reproducer first, then fix |
| Refactor with existing test coverage                                                     | **No** — existing suite is the contract                |
| Doc-only / config-only / CI tweak                                                        | **No**                                                 |
| Mechanical rename / file move                                                            | **No**                                                 |

When TDD is skipped on net-new behavior, **say so explicitly** in the completion report with the reason. Skipping silently means the inspector can't tell if the test surface is missing by choice or by oversight.

The inspector's `write-review-result` CLI gates on `--test-summary` (FEAT-023). Your completion handoff must give the inspector enough material — test file names + scenarios, or an explicit skip justification under `--risks` — to populate that field. A handoff that leaves test status ambiguous forces the inspector to either invent coverage claims or reject the work.

## Context efficiency

### No re-Read after Edit/Write — for VERIFICATION

After a successful Edit / Write, do NOT Read the same file just to confirm the change landed. The tool would have errored on failure; the harness tracks file state for you.

**Allowed** (these are NOT "verification"):

- Sequential Edits on the same file in one turn — no intermediate Read needed. Issue Edit A → Edit B → Edit C back-to-back; the harness keeps state consistent between them.
- Re-Reading because the change revealed something new you need to see (e.g. an Edit exposed a related call-site you didn't know about, or you need a different region of the file you haven't viewed).
- Reading a different file mentioned by the Edit's diff context.

**Not allowed**: "Let me Read the file to confirm my Edit worked." That re-Read is pure waste — the Edit already errored if it failed.

### TaskUpdate batching

Send `in_progress` for the current task only; coalesce `completed` markers at logical sequence boundaries. Never run ≥3 TaskUpdate calls back-to-back without intervening work — the `check-task-update-burst` hook logs evidence to `.claude/logs/task-update-bursts.jsonl` and cost-advise flags the cache-churn.

### Coalesce Bash calls

Prefer `cmd1 && cmd2 && cmd3` over separate Bash invocations when commands are related and don't need intervening model reasoning. Example: combine `git status && git diff --stat && git log --oneline -5` into one call, not three. Carve-out: keep them separate when each result drives the next decision; chain only for pure data-collection or all-or-nothing.

### Scoped reads

After Grep locates a match, Read only the relevant lines with `offset` + `limit`. Never load a full 500-line file to see 10 lines. Example: `Grep` finds line 142 → `Read file offset:135 limit:20`.

### Prefer Edit over Write

For modifications to existing files, always use Edit (sends only the diff). Use Write only for new files or complete rewrites. Edit is dramatically cheaper in token footprint.

### Batch edits

When making multiple related edits to the same file, issue them sequentially in one turn. Do NOT interleave Read calls between Edits on the same file — the harness tracks file state.

### Repo layout on start

When resuming from a handoff, check for a `## Repo Layout` section in the handoff artifact before running `ls`, `find`, or `cat package.json`. If the section is present, it contains a pre-discovered layout — use it directly. This saves 3–5 tool turns per run.

## Conventions

These apply inline as you work — NOT as pre-coding gates.

- **Env guard**: every Bash block using `${CLAUDE_PLUGIN_ROOT}` must start with `: "${CLAUDE_PLUGIN_ROOT:?must be set}"`. If unset, stop and `mark-badge blocked --note "CLAUDE_PLUGIN_ROOT unset"`.
- **Shell pre-check**: before any chained Bash with `cd` / path-touching commands, verify with `pwd` (POSIX) or `Get-Location` + `Test-Path` (PowerShell). On Windows, prefer the PowerShell tool for cmdlet operations; reserve Bash for POSIX scripts. `$env:NAME` in PS, `$NAME` in bash. Quote paths with spaces.
- **Scope estimate (only when you sense heavy work)**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" scope-estimate --files <path:lines,...>` returns a tier. For `heavy`, stop and `mark-badge blocked --note "scope too large: <tier>"` so the lead splits. Skip this for obvious small slices.

## Cross-layer coordination patterns

When a slice genuinely touches BOTH BE and FE within scope:

1. **API contract first.** If an OpenAPI YAML exists at `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml`, regenerate both BE native types (per-stack codegen) and FE TypeScript client (orval / openapi-typescript-codegen) BEFORE any feature work. Contract drift is the most common cross-layer regression source.
2. **Test the wire.** Add at least one integration test that exercises FE → BE round-trip on the new endpoint. Pure unit tests on each side miss serialization mismatches.
3. **Surface the SPLIT signal anyway.** Even when you legitimately handle a cross-layer slice, append `scope-cross: BE+FE: <files>` to handoff `--risks` so the lead's routing classifier learns when fullstack-dev was the right call vs when split would have been cheaper.
