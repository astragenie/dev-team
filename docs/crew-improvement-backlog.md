# Crew Plugin — Improvement Backlog (May 2026)

## Context

The Crew plugin (formerly Engineering OS) is a Claude Code plugin for multi-agent engineering workflows. A May 2026 audit fixed several runtime bugs (A, B, C, E) and ships with a regression test suite. This document lists the next set of improvements to consider, ranked by impact-to-effort ratio.

**Current state on Windows:** 26/31 tests pass. 5 failures are pre-existing (3 namespace-rename inconsistencies in installer; 2 Windows-tooling assumptions in tests). Plugin runtime is stable for solo development.

**Path conventions:**
- Plugin source: `C:\work\claude plugins\engineering-os\` (custom marketplace)
- Plugin cache (what Claude Code actually reads): `~\.claude\plugins\cache\crew-dev\crew\0.1.0\`
- User-level overrides: `~\.claude\commands\` and `~\.claude\agents\` (highest precedence, survive plugin updates)

---

## Verify before editing: cache vs source

If you edit files in the marketplace source folder, those changes don't take effect until the cache refreshes. Claude Code loads from the cache, not the source.

Check whether your existing edits are live:

```powershell
$src = "C:\work\claude plugins\engineering-os"
$cache = "$env:USERPROFILE\.claude\plugins\cache\crew-dev\crew\0.1.0"

# Compare all command files
Get-ChildItem "$src\commands\*.md" | ForEach-Object {
  $cacheFile = Join-Path "$cache\commands" $_.Name
  if (Test-Path $cacheFile) {
    $diff = Compare-Object (Get-Content $_.FullName) (Get-Content $cacheFile) -SyncWindow 0
    if ($diff) { Write-Host "DIVERGED: $($_.Name)" }
  }
}
```

If anything diverged, either:
- **Reinstall the plugin** so cache refreshes from source (cleanest)
- **Copy edited files to the cache manually** (gets overwritten on next plugin update)
- **Move edits to user-level overrides** at `~\.claude\commands\<name>.md` (survives updates, highest precedence)

---

## Priority 1 — High value, low risk

### 1.1 Define "substantial"

**Problem:** The word "substantial" is used 30+ times across commands as a gating term (e.g., "for substantial changes, run review"). It's never defined. Different agents and humans interpret it differently, leading to inconsistent gate enforcement.

**Fix:** Add one canonical definition in `constitution.md` (or wherever framework rules live) and have all commands reference it.

Suggested wording (adjust to taste):

> A "substantial" change is one that meets **any** of:
> - touches more than 3 files
> - modifies public API, schema, or persisted state
> - changes behavior that has tests
> - is user-facing
> - adds or removes a dependency
>
> Documentation-only edits, comment changes, and pure renames are not substantial.

Then sweep commands to replace inline guesses with a reference to the canonical definition.

**Effort:** 30-60 minutes. Mostly text editing.

### 1.2 Collapse canonical/alias command duplication

**Problem:** Many command pairs exist where the short name (`/crew:build`) is a thin wrapper and the "compatibility alias" (`/crew:build-feature` or similar) contains the actual content. This is inverted: the short name should be canonical, the alias should be a one-line redirect to it.

**Fix:** For each canonical/alias pair:
1. Move the canonical content into the short-name file
2. Replace the alias file content with a single line: "See `/crew:<canonical-name>`"

To find the pairs:

```powershell
# Look for commands that reference another command in their first 5 lines
Get-ChildItem "$cache\commands\*.md" | ForEach-Object {
  $head = Get-Content $_.FullName -TotalCount 5 | Out-String
  if ($head -match "alias|see /crew:|redirect") {
    Write-Host "ALIAS CANDIDATE: $($_.Name)"
  }
}
```

**Effort:** 1-2 hours depending on how many pairs exist.

**Win:** Halves the command maintenance surface area; one source of truth per logical operation.

### 1.3 Quote `$ARGUMENTS` in command bash blocks

**Problem:** `claim-files.md`, `release-files.md`, and `show-conflicts.md` expand `$ARGUMENTS` directly in bash blocks (verified May 2026 audit — 3 files, not 2). `request-approval.md` and `resolve-approval.md` already quote correctly. A file path containing shell metacharacters (semicolons, backticks, `$(...)`, etc.) could execute as a command. Theoretical risk for typical filenames, real risk if any input is ever user-controlled.

**Fix:** Wrap every `$ARGUMENTS` usage in double quotes and use `--` to terminate option parsing:

```bash
# Before (vulnerable)
node scripts/crew.mjs claim --owner builder $ARGUMENTS

# After (safe)
node scripts/crew.mjs claim --owner builder -- "$ARGUMENTS"
```

If `$ARGUMENTS` is space-separated and needs to expand into multiple args, use proper array handling:

```bash
# Split arguments respecting quoting
read -ra ARGS <<< "$ARGUMENTS"
node scripts/crew.mjs claim --owner builder -- "${ARGS[@]}"
```

**Effort:** 30 minutes. Mechanical search-and-quote across the 3 affected files.

**Note on `--`:** The first snippet above (`-- "$ARGUMENTS"`) passes the whole `$ARGUMENTS` value as a single shell argument. If the command expects multiple args (e.g., several file paths), use the `read -ra` form instead, otherwise multi-arg invocations will silently break.

---

## Priority 2 — High value, medium risk

### 2.1 Hard PreToolUse gate for `/crew:ship`

**Problem:** `ship.md` enforces production safety entirely through prompt instructions ("don't ship if review_required is set"). The model can misread or skip the check. A PreToolUse hook in `hooks.json` could actually block the `git push` or `gh pr` commands when gates are pending.

**Current state:** Installer already creates `check_git_gate.sh` as a soft-warning PreToolUse hook. It warns but doesn't block.

**Fix:** Add a stricter variant that actually returns `continue: false` when the current run has `review_required` or `validation_expected` pending and the command is a production push.

This is a real behavior change. Think through edge cases before shipping:
- What if review was legitimately skipped (`review_skipped` badge)? Already handled by existing softgate logic — preserve that.
- What if the user wants to bypass intentionally? Add an env var escape hatch like `CREW_BYPASS_GATES=1`.
- What about `git push origin feature-branch` to a non-prod branch? The gate should probably only fire on protected branches.

**Effort:** 1-2 hours. Bash hook logic plus regression tests.

### 2.2 Script-failure handling in commands

**Problem:** Most commands call `node scripts/crew.mjs ...` and proceed to the next step regardless of exit code. If the CLI errors, the next step plows ahead on stale assumptions.

**Fix:** Either:
- Add `set -e` semantics to bash blocks (one-line addition per block)
- Or explicit `if [ $? -ne 0 ]; then exit 1; fi` after each CLI call

The simpler fix is `set -euo pipefail` at the top of every bash block. Catches both exit failures and undefined variables.

**Effort:** 30-60 minutes. Mechanical.

---

## Priority 3 — Defer or skip

### 3.1 Namespace rename (`engineering-os/` → `crew/`)

**Status:** Already deferred. Real bug (installer writes `.claude/state/engineering-os/`, runtime writes `.claude/state/crew/`) but migration of existing repos has real complexity — overlapping artifact directories in production repos with content created under both naming schemes.

**Don't do this without:**
- Backing up `.claude/` in every affected repo
- Writing a dry-run migration tool first
- Reviewing what the migration would touch per repo
- Deciding artifact merge strategy (keep both? keep newer? union by filename?)

The 3 failing installer tests (`bootstrap adds harness files`, `bootstrap is idempotent`, `bootstrap upgrades legacy harness paths`) all relate to this. They will keep failing until the rename is done.

If you want to make them stop failing without doing the migration, mark them as `test.skip` with a comment explaining migration is deferred. Honest, surfaces the design choice.

### 3.2 Split long-running command workflows

**Problem:** Some commands have 25+ steps. Long workflows tax instruction-following reliability.

**Fix:** Break into smaller sub-commands that orchestrate together.

**Why defer:** Significant rewrite. The benefit is reliability under load, but the cost is breaking muscle memory and any documentation that references step numbers.

### 3.3 Append-only event log migration (claims, workflow state)

**Status:** Already documented as commitment #9 in `implementation-commitments.md`. The current BUG-A fix uses file locking, which is correct for now but not the eventual architecture. Migration to append-only logs (like `approvals.jsonl` already uses) eliminates the race fundamentally.

**Why defer:** Major refactor. Lock-based fix is working. Defer until you observe the lock causing pain (timeouts, stale-lock recovery edge cases, etc.).

### 3.4 Lock pattern in `workflow-state.mjs`

**Status:** Same race pattern as `claims.mjs` had, but no current concurrent caller. Cheap insurance.

**Why defer:** Not currently broken. Add if/when you go multi-session on workflow operations. The `withClaimsLock` helper in `claims.mjs` is directly reusable — copy it, rename to `withWorkflowStateLock`, wrap `saveWorkflowState`'s callers.

---

## How to approach this

Pick one Priority 1 item. Don't batch them — finish, test, commit, move on. After each:

1. Run the existing test suite: `node --test tests\cli.test.mjs tests\installer.test.mjs tests\regression.test.mjs`
2. Verify expected pass count (26/31 baseline)
3. Manually exercise the changed command in a real repo
4. Commit

If anything regresses in tests, revert immediately and reassess. The regression test suite catches the 4 known bugs (A, B, C, E). New failures mean your change introduced a new bug.

For Priority 2 items, additionally write a regression test before shipping. Same pattern as `tests\regression.test.mjs`.

---

## Verifying the plugin is working as expected

After any change, sanity-check by running a quick smoke test in a throwaway directory:

```powershell
$tmp = "$env:TEMP\crew-smoke-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp | Out-Null
node "$env:USERPROFILE\.claude\plugins\cache\crew-dev\crew\0.1.0\scripts\crew.mjs" init --repo $tmp
node "$env:USERPROFILE\.claude\plugins\cache\crew-dev\crew\0.1.0\scripts\crew.mjs" brief-me --repo $tmp
Remove-Item -Recurse -Force $tmp
```

If `init` or `brief-me` fails, something in the plugin core broke. Roll back.

---

## Files you'll most often touch

| Area | File | Lives where |
|---|---|---|
| Define "substantial" | `crew/constitution.md` (or framework memory file) | Both source and cache |
| Command edits | `commands/*.md` | Both source and cache |
| Bash safety | `commands/*.md` (any with bash blocks) | Both source and cache |
| Hook behavior | `hooks/check_git_gate.sh` | Both source and cache |
| CLI bug fixes | `scripts/lib/*.mjs` | Both source and cache |
| Tests | `tests/*.test.mjs` | Source only (cache doesn't ship tests) |

If you only edit the cache, your changes vanish on the next plugin update. If you only edit the source, your changes don't take effect until reinstall. Edit both, or use user-level overrides for important customizations.

---

## What's already fixed (don't redo)

- **BUG-A** (concurrent claims race): file-lock in `claims.mjs`
- **BUG-B** (write-run-brief destroys current run): archive-before-replace in `workflow-state.mjs`
- **BUG-C** (dead code in artifacts.mjs): unreachable validation-result and deployment-result branches removed
- **BUG-E** (Windows path separators in deployment-guidance.mjs): normalize to forward slashes
- **Cost optimization**: agent model downgrades from opus to sonnet for `code-simplifier`, `lead`, `builder`, `reviewer`, `validator`, `deployer`
- **Docs cleanup**: project-status, implementation-commitments, memory docs consolidation, dead-path-genericization

Regression tests in `tests\regression.test.mjs` cover BUG-A/B/C/E. Don't delete them.

---

That's the backlog. Pick one, do it, ship it, repeat.
