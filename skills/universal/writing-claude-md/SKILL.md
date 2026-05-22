---
name: writing-claude-md
tier: universal
description: Use when adding or updating CLAUDE.md entries to keep them concise and useful.
---

# Writing CLAUDE.md Entries

CLAUDE.md is the first thing an agent reads every session. Every line competes for the user's context budget — bloating it wastes attention that could go toward actual work.

## Rules

1. **Repo CLAUDE.md is for repo-specific rules only.** Generic workflow or conventions belong in `~/.claude/CLAUDE.md` (global) or this plugin's skills/agents. Duplicating them per-repo means every repo carries stale copies the user has to maintain.
2. **Keep entries short.** One-liners over paragraphs. Commands over explanations. Long entries train agents to skim, which defeats the purpose.
3. **Only add what the agent needs every session.** Good: known bugs that affect repo integrity, critical safety rules. Bad: one-time procedures, context an agent can discover from code. Unnecessary entries dilute the important ones.
4. **Detail goes in artifacts.** More than 2-3 lines → put in `.claude/artifacts/` and reference with `@path/to/file.md`.
