---
description: Revert a GEPA champion promotion. Deletes the soak pointer for the agent from soak.json and, if a promotion commit exists on main, runs `git revert <commit>` (never git reset, never git push --force). Reads prior_prompt_hash from gepa frontmatter to locate the commit.
allowed-tools: Bash
---

# /crew:gepa-revert

Revert a promoted GEPA champion back to the pre-promotion state. Use when a promoted agent prompt is causing regressions, the soak phase detected a quality drop, or operator needs to roll back immediately.

## Usage

```
/crew:gepa-revert --agent <name>
```

Flags:
- `--agent <name>` — required. Agent name (e.g. `fullstack-dev`).

## Behavior

1. **Remove soak pointer**: Deletes the `<agent>` entry from `.claude/artifacts/crew/gepa/soak.json` (atomic tmp+rename). Non-fatal if soak.json is absent or already cleaned.
2. **Find promotion commit**: Searches `git log -- agents/<agent>.md` for the most recent `chore(gepa): promote` commit. Uses `prior_prompt_hash` from the `gepa:` YAML frontmatter to locate the commit SHA.
3. **git revert**: Runs `git revert --no-edit <sha>` to create a new revert commit on the current branch. This is the ONLY form of rollback used — **never `git reset`, never `git push --force`**.
4. **Emit event**: Logs `gepa_soak_revert` to `.claude/logs/events.jsonl` with `agent`, `revert_commit`, `trial_id` (from frontmatter), and `reason`.

## Merge conflict handling

If `git revert` fails (e.g. due to a merge conflict from concurrent edits), the command:
- Prints the manual `git revert <sha>` command to stderr.
- Exits non-zero.
- Does NOT leave a half-applied revert.

## Exit codes

- `0` — revert succeeded (or no promotion commit found — soak pointer still cleaned).
- `1` — git revert failed (manual intervention required) or config read error.
- `2` — bad args (missing `--agent`).

## Safety constraints

- NEVER `git push --force`.
- NEVER `git reset` on main.
- NEVER modifies the `agents/` file directly — only uses `git revert`.

## Example

```bash
node scripts/crew.ts gepa-revert --agent fullstack-dev
```

## See also

- `commands/gepa-invalidate.md` — invalidate bad trials.
- `commands/gepa-thaw.md` — thaw a frozen agent.
- `commands/gepa-resume.md` — clear no-winner streak.
- `scripts/lib/gepa/gepa-killswitch-cmds.ts` — implementation.
- `scripts/lib/gepa/champion-provenance-writer.ts` — frontmatter format.
