---
name: commit
prompt_id: commit
version: 1.0.0
tier: workflow
description: Create well-formatted git commits using conventional commit format with emoji. Use when staging and committing changes, especially when the diff spans multiple logical concerns that should be split into separate commits. Pairs with the repo's pre-commit checks.
owner: astra
last_reviewed: 2026-05-23
triggers: ["commit", "conventional commit", "git commit", "stage and commit", "split commit"]
---

# Commit

Create well-formatted commits with conventional commit messages + emoji.

## When to Use

- About to run `git commit` on staged or unstaged changes.
- The diff touches multiple logical concerns and may need splitting.
- A bare `git commit` would produce a low-quality message.

## What this skill does

1. Run pre-commit gate unless caller passes `--no-verify`. For this repo: `bun run lint && bun test --parallel && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts`.
2. `git status` — show what is staged.
3. If nothing staged, stage all modified + new files (`git add -A`).
4. `git diff --cached` — read what is about to land.
5. Decide whether the diff is one logical change or many. If many, propose a split and ask before committing.
6. For each commit: write a conventional commit message with the right emoji + type.

## Conventional commit format

```
<type>: <description>
```

- `feat`: new feature.
- `fix`: bug fix.
- `docs`: documentation only.
- `style`: formatting; no code-meaning change.
- `refactor`: code change that is neither feat nor fix.
- `perf`: performance improvement.
- `test`: add or fix tests.
- `chore`: build, tooling, marketplace, version bumps.
- `ci`: CI configuration.
- `revert`: revert a prior commit.

Rules:

- Present tense, imperative mood (`add`, not `added`).
- First line under 72 characters.
- Body wraps at 72 columns; blank line between subject and body.
- Omit the Claude footer unless the user explicitly asks to keep it.

## Emoji conventions

Optional but encouraged for at-a-glance grouping. Common pairings:

| Emoji | Type | When |
|---|---|---|
| ✨ | feat | new feature |
| 🐛 | fix | bug fix |
| 📝 | docs | documentation |
| ♻️ | refactor | restructuring |
| ⚡ | perf | performance |
| ✅ | test | adding tests |
| 🔧 | chore | tooling / config |
| 🚀 | ci | CI / release |
| 🔥 | fix | remove code |
| 🚨 | fix | resolve linter warning |
| 🔒 | fix | security fix |
| 🚑 | fix | critical hotfix |
| 🏗️ | refactor | architectural change |
| 🎨 | style | improve structure |
| 📦 | chore | dependency / compiled output |
| 🔖 | chore | release / version tag |
| 💚 | fix | repair CI build |
| 👽 | fix | update for external API change |
| 🩹 | fix | minor non-critical fix |
| ✏️ | fix | typo |

## When to split commits

Split if the diff hits two or more of:

1. **Different concerns** — auth code + UI text in the same commit reads as two stories.
2. **Different types** — `feat` mixed with `chore` is hard to read; splits cleanly.
3. **File-pattern boundaries** — source vs docs vs config vs tests.
4. **Size** — a 600-line diff doing five things is a code-review tar pit.

## Splitting workflow

1. `git reset HEAD --` to unstage everything.
2. `git add -p` for line-level granularity, or `git add <file>` for file-level.
3. Commit subset 1 with focused message.
4. Repeat for remaining subsets.

## Examples

Good:

- `✨ feat: add cost-report writer for slice handoffs`
- `🐛 fix: handle missing crew.json with default config`
- `📝 docs: link FEAT-019 from architecture skill-tiers section`
- `♻️ refactor: extract briefing collector into separate module`
- `🚨 fix: resolve eslint warning in validate-skills.ts`
- `🔒 fix: redact secrets in cost-report output`
- `🔖 chore(release): v0.3.1 — marketplace polish`

Bad:

- `update files` — what changed?
- `fix bug` — which bug?
- `WIP` — should not land on `main`.
- 200-word subject lines — body is for that.

## Done / Stop-when

- Pre-commit gate passed (or `--no-verify` requested with stated reason).
- Each landed commit has type + emoji + single-concern subject under 72 chars.
- Multi-concern diffs were split before commit, not after.
- No Claude footer unless explicitly requested.

## Attribution

Adapted from [evmts/tevm-monorepo](https://github.com/evmts/tevm-monorepo) `.claude/commands/commit.md` (MIT, © 2023 evmts contributors). Reduced and aligned to the crew skill quality bar (≤200 lines, tier frontmatter, repo-specific pre-commit gate).
