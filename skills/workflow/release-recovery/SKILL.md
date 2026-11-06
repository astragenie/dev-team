---
name: release-recovery
prompt_id: release-recovery
version: 1.0.0
tier: workflow
description: Recover from broken-tag releases, version drift, and marketplace-vs-plugin desync. Covers no-ff merge, version-bump-forward, paired-marketplace recovery, and the HARD RULE against tag deletion.
owner: astra
last_reviewed: 2026-06-29
triggers: ["broken tag", "release recovery", "version mismatch", "marketplace drift", "tag vs HEAD drift", "version bump forward", "no-ff merge recovery", "pipefail release script"]
---

# Release Recovery

## Trigger

Load when:
- A release tag was pushed but the underlying refactor / commits are missing from it
- `git log` vs `package.json` version field disagree (tag-vs-HEAD content drift)
- Marketplace `version` field bumped but plugin tag wasn't pushed (or vice versa)
- A release script's `cmd | tail && cmd2` masked an earlier failure, shipping cmd2's effect on top of cmd1's broken state
- Operator says "the release went sideways" / "fix the broken tag" / "the marketplace got out of sync"

## HARD RULES (non-negotiable)

1. **NEVER delete a published tag.** Even if it's broken. Even if it's wrong. The audit trail is sacred. Roll forward with a new tag; document the broken one in CHANGELOG as a known-broken release.
2. **NEVER force-push `main`.** Same reason. If `main` is wrong, revert-forward.
3. **NEVER skip hooks** (`--no-verify`) without explicit user request. If a hook fails during release recovery, fix the underlying cause.
4. **NEVER push during recovery without verifying the diff one more time.** Recovery sequences are exactly where a second mistake compounds the first.

## Detection patterns

| Symptom | What probably went wrong |
|---|---|
| `git show <tag> -- package.json` shows version `X.Y.Z` but `git show <tag> -- src/<file>` is missing the expected refactor | Release ceremony's bash chained with `&&` after a failing `cmd \| tail`; first cmd's exit code got masked |
| `marketplace.json` plugin version is `X.Y.Z` but `git tag -l "vX.Y.Z"` returns empty | Marketplace bump committed before tag was pushed (or push failed silently) |
| Plugin tag `vX.Y.Z` exists in remote but `marketplace.json` still shows `X.Y.(Z-1)` | Tag pushed but registry-paired commit missed (cross-repo session boundary) |
| `git log vX.Y.Z..main --oneline` shows unmerged commits that the release notes claim were included | Release was cut from a stale branch or merge happened after tagging |

## Recovery sequence (broken-tag, fix-forward)

This is the canonical recovery — use when a tag was pushed without its refactor.

```bash
# 1. Confirm what's actually in the broken tag
git show vX.Y.Z --stat | head -20
git diff vX.Y.Z..main --stat

# 2. Identify the missing commits — these are what should have been in the tag
git log vX.Y.Z..main --oneline

# 3. Decide the version bump direction. ALWAYS forward — never re-tag.
#    Broken tag was X.Y.Z → recovery tag is X.Y.(Z+1) for patch-class recovery
#    OR X.(Y+1).0 if the recovery includes scope expansion.

# 4. Bump version in package.json + marketplace.json (paired)
#    Both files MUST move together. NEVER bump one without the other.
node -e "const p = require('./package.json'); p.version = 'X.Y.(Z+1)'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');"
# Edit .claude-plugin/marketplace.json — find the plugins[name=<this-plugin>].version field

# 5. Add CHANGELOG entry that documents the broken tag explicitly
#    Pattern: "## [X.Y.(Z+1)] — YYYY-MM-DD  \n  ### Fixed  \n  - Recovery of broken vX.Y.Z release: includes <refactor name> that was missing from the previous tag due to release-script exit-code masking."

# 6. Commit the recovery
git add package.json .claude-plugin/marketplace.json CHANGELOG.md
git commit -m "chore(release): vX.Y.(Z+1) — recovery of broken vX.Y.Z (includes <refactor>)"

# 7. Tag the recovery commit (NEVER delete vX.Y.Z)
git tag -a "vX.Y.(Z+1)" -m "vX.Y.(Z+1) — recovery release"

# 8. Push with --follow-tags
git push origin main --follow-tags

# 9. Verify
git tag -l "vX.Y.*" --sort=-v:refname | head -5
gh release view "vX.Y.(Z+1)" 2>/dev/null || echo "no GitHub release yet"
```

## Recovery sequence (marketplace drift)

When the central registry is out of sync with the plugin tag:

```bash
# Direction A: plugin tag is correct, registry lags
# - Open the registry repo (astragenie/astra-marketplace) in its own session
# - Bump plugins[name=<this-plugin>].version to match the plugin tag
# - Commit + push in that session — NEVER cross-session per the HARD RULE
#   (exception: astra-family plugin sources may do the paired bump per CLAUDE.md)

# Direction B: registry leads, plugin tag missing
# - The registry bump is the audit trail. Pull the plugin repo to the matching
#   commit (or revert the registry bump and re-do via the plugin session)
# - Decide based on whether the plugin tag was published anywhere downstream
```

## `pipefail` is mandatory in release scripts

The 2026-06-22 v0.43.0 + v0.44.1 incidents that triggered FEAT-182 were
both caused by the same bash pattern:

```bash
some_long_cmd | tail -10 && next_cmd
```

Without `set -o pipefail`, `some_long_cmd`'s exit code is masked by the
pipe — `tail -10` always exits 0. `&&` then sees success and runs
`next_cmd` even though the actual underlying command failed.

**Every release script MUST start with:**

```bash
set -euo pipefail
```

- `-e` — exit on any command failure
- `-u` — error on unset variable reference
- `-o pipefail` — pipe exit code = leftmost non-zero (uncovers masked failures)

This is recorded in memory rule `feedback-pipefail-release-script`.

## Pre-release audit (run BEFORE tagging)

```bash
# 1. Confirm versions are paired
grep '"version"' package.json
node -p 'require("./.claude-plugin/marketplace.json").plugins.find(p=>p.name==="<this-plugin>")?.version ?? "NOT FOUND"'

# 2. Confirm CHANGELOG has an entry for the version about to be tagged
grep -E "^## \[$(node -p 'require("./package.json").version')\]" CHANGELOG.md

# 3. Confirm working tree is clean
git status --porcelain
# Empty output required — uncommitted changes mean the tag will not include them

# 4. Confirm main is fully fetched + tip matches what you expect
git fetch origin main
git log origin/main..HEAD --oneline  # should be empty (we're at remote tip)
git log HEAD..origin/main --oneline  # should be empty (no upstream commits we don't have)

# 5. Confirm there's no protected file in the staged delta (secrets, .env, credentials)
git diff --cached -- '.env*' 'credentials*' 'secrets*'
# Empty output required
```

## Done when

Recovery is complete when ALL of the following are true:

- New tag pushed to remote with `--follow-tags`
- `package.json` + `marketplace.json` versions match the new tag, both committed
- CHANGELOG entry exists for the recovery version and explicitly references the broken tag
- The broken tag still exists in the remote (audit trail preserved — never delete)
- `git status --porcelain` is empty (no leftover working-tree drift)
- `git tag -l "vX.Y.*" --sort=-v:refname | head -1` shows the recovery tag at the top
- Release ceremony script (if used) has `set -euo pipefail` at the top, verified by re-reading

If any of these are false, the recovery is NOT done — continue working through the sequence.

## When NOT to use this skill

- Pure code regression where the release ceremony went fine but the code itself is buggy → use `/crew:fix` instead
- Production incident where the issue is data corruption, not release mechanics → use the incident-response skill (SLICE-B) instead
- Marketplace bump that legitimately leads the plugin (intentional pre-publish) → not a recovery scenario; follow normal release ceremony

## References

- `agents/release-engineer.md` — happy-path tagging + rollback procedure
- `CLAUDE.md` — release & deployment section (this repo) + HARD RULE for astra-family
- Memory `feedback-pipefail-release-script` — pipefail mandate origin
- Memory `gepa-core-v0.2.0-unpublish-lockout` — example of unrecoverable npm registry state requiring version-forward
