---
name: writing-claude-md
prompt_id: writing-claude-md
version: 1.0.0
tier: universal
description: Use when adding or updating CLAUDE.md entries to keep them concise and useful.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["CLAUDE.md", "@.claude/", "memory edit", "session memory"]
---

# Writing CLAUDE.md Entries

CLAUDE.md is the first thing an agent reads every session. Every line competes for the user's context budget — bloating it wastes attention that could go toward actual work.

## Trigger

Use when adding or updating any `CLAUDE.md` file (repo-local or global), or editing entries imported via `@.claude/` paths. Also use when pruning stale entries during memory reviews.

## Rules

1. **Repo CLAUDE.md is for repo-specific rules only.** Generic workflow or conventions belong in `~/.claude/CLAUDE.md` (global) or this plugin's skills/agents. Duplicating them per-repo means every repo carries stale copies the user has to maintain.
2. **Keep entries short.** One-liners over paragraphs. Commands over explanations. Long entries train agents to skim, which defeats the purpose.
3. **Only add what the agent needs every session.** Good: known bugs that affect repo integrity, critical safety rules. Bad: one-time procedures, context an agent can discover from code. Unnecessary entries dilute the important ones.
4. **Detail goes in artifacts.** More than 2-3 lines → put in `.claude/artifacts/` and reference with `@path/to/file.md`.

## Done

The entry is complete when:

- the addition fits in ≤3 lines, or longer content has been moved to an artifact and referenced via `@path`
- the content is repo-specific (not generic workflow that belongs in a global or skill file)
- no existing entry was duplicated
