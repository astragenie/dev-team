---
name: release-engineer-reference
prompt_id: release-engineer-reference
version: 1.0.0
tier: domain
maxLines: 350
description: Release-engineer runbook + incident knowledge base. Troubleshooting flowcharts, common failure mode catalogue, diagnostic toolkit, recovery procedures, plugin-specific release knowledge. Loaded on-demand by release-engineer when a slice maps to a known failure shape or requires recovery procedure. NOT part of the release-engineer role prompt.
owner: hero-crew
last_reviewed: 2026-06-21
triggers: ["CI build fails", "hook crashes", "OTel span dropped", "test timeout", "marketplace install resolves wrong version", "release tag points at red CI", "bad release tag", "plugin-cache install broken", "OTel exporter unreachable", "marketplace registry bumped wrong version", "diagnostic toolkit", "git bisect", "gh run"]
---

# Release-engineer reference — runbook + incident KB

Knowledge base for `release-engineer`. Load when a slice maps to a known failure shape or requires a recovery procedure. The role prompt stays focused on responsibility + artifact contract; this file carries the runbook.

## When to use

- Diagnosing a failure that matches one of the catalogued shapes.
- Needing a quick `gh` / `git bisect` / `bun pm ls` recipe.
- Executing a documented recovery procedure.
- Plugin release work that needs the version-pin sequence.

Routine release ceremony (CI green → tag → push) does NOT need this file.

## Troubleshooting flowcharts

First-check sequences by failure mode:

| Failure mode | First checks |
|---|---|
| CI build fails | (1) lockfile drift `bun pm verify`, (2) Node version pin in workflow, (3) Bun version pin, (4) test timeout settings, (5) flaky-test patterns in last 5 runs |
| Local build fails | (1) `bun install` ran, (2) Node 22.6+ strip-types feature gated, (3) Windows path separators, (4) stale dist/cache, (5) env var unset (e.g. `CLAUDE_PLUGIN_ROOT`) |
| Hook crashes on customer install | (1) plugin-cache install lacks `node_modules`, (2) sync hook hangs on async, (3) signal handling on Windows |
| Test timeout | (1) subprocess wait without close, (2) cleanup misses temp dirs, (3) port conflicts on parallel CI, (4) tempdir collisions on Windows |
| OTel span dropped | (1) process exit before flush (BatchSpanProcessor delay), (2) exporter URL misconfigured, (3) sampling rate = 0, (4) span context lost across async boundary |
| Marketplace install resolves wrong version | (1) `astra-marketplace` registry `version:` field stale, (2) consumer cache, (3) `--reinstall` flag missing |
| Release tag points at red CI | (1) gate skipped (`continue-on-error`), (2) tag was created before push, (3) workflow scope didn't include the failing path |

## Common failure modes catalogue

Repository-specific incidents preserved as cautionary tales. Each row pairs the symptom with the root cause and the fix pattern that landed.

| Incident shape | Root cause | Fix pattern |
|---|---|---|
| Plugin-cache ENOENT on every hook fire (v0.37.x line) | Top-level static `import @opentelemetry/*` in hook entry, plugin-cache install lacks `node_modules` | Regression test spawns subprocess in temp cwd with PATH stripped of `node_modules`; move OTel imports behind dynamic `import()` |
| Bundle truncation at 75K | No per-file size budget in `write-handoff-and-bundle` | Shrink prompt source rather than raising cap — the cap exposes the real bloat |
| Eval Windows 32 KB command-line limit | Prompt passed as CLI arg | Pipe prompt via stdin |
| Eval candidate writing into host repo | `--dangerously-skip-permissions` + repo cwd | Run candidate in a tempdir cwd |
| Langfuse 404 spam | Wrong endpoint or stale Langfuse host | HTML title extraction to detect misroute; gate behind `LANGFUSE_DISABLE` env |
| `max-turns 3` cut off result event | Parser fell back to raw stdout | `parseStreamJson` aggregates message events |

When a new incident is resolved at the release layer, append a row here so the next on-call doesn't rediscover it.

## Diagnostic toolkit

Quick recipes — copy/paste then narrow:

```bash
bun pm ls                                       # dependency tree
git log --oneline -- <file>                     # recent commits on a file
git log --oneline --diff-filter=A -- <file>     # find when a file was added
git bisect start && git bisect bad && git bisect good <sha>   # narrow a regression
git show <sha> --stat                           # commit summary
gh run list --branch main --limit 10            # recent CI runs
gh run view <run-id> --log                      # CI log dump
gh run view <run-id> --log-failed               # only the failed steps
node --inspect ./scripts/X.ts                   # debugger session
bun test --reporter junit                       # CI-friendly test output
bun --print 'process.versions'                  # runtime version dump
```

For `git bisect` with flake retry-before-verdict + auto test-command detection, see `skills/workflow/root-cause-discipline/investigation.md` Part 2.

## Recovery procedures

| Situation | Procedure |
|---|---|
| Bad release tag pushed | Don't delete (consumers may have pinned). Cut a `vX.Y.Z+1` fix release; announce deprecation in `CHANGELOG.md`. |
| Marketplace registry bumped wrong version | Single-field revert commit in `astra-marketplace` repo + push. |
| CI red on main with merged work | Hotfix branch + advisory `continue-on-error` for the specific gate while the root cause is investigated. Surface as `band-aid:` risk per `root-cause-discipline`. |
| Plugin-cache install broken at customers | Cut a patch release with the hook entry's import moved behind a dynamic import. Announce in `CHANGELOG.md` with affected versions. |
| OTel exporter unreachable | Add `LANGFUSE_DISABLE=1` (or analogous) env to the CI workflow + open a follow-up to investigate endpoint config drift. |
| Production deploy failed mid-run | Halt promotion; capture deploy-attempt evidence (rev id, last good rev); confirm rollback path BEFORE re-attempting; document in `--evidence`. |

## Plugin-specific release knowledge

Applies when the repo ships as a Claude Code plugin (this repo + the loop companion repo qualify):

- **Source of truth for the version pin is the central registry** at `https://github.com/astragenie/astra-marketplace`. Local `plugin.json` + `marketplace.json` must match the registry entry.
- **Release sequence (per `CLAUDE.md`):**
  1. CI green on `main` (all blocking gates).
  2. `CHANGELOG.md` updated — new dated section grouped by FEAT.
  3. Version bumped in `package.json` + `.claude-plugin/plugin.json`.
  4. Commit: `chore(release): vX.Y.Z — <summary>`.
  5. Annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
  6. Push: `git push origin main --follow-tags`.
  7. Bump central registry `plugins[name=<plugin>].version` in `astra-marketplace`; commit + push as a separate commit.
- **`dev.stable: false`** in `.claude/crew/deployment.md` prevents auto-commit during slice builds. Production tags + marketplace pushes ALWAYS require explicit user approval.
- **Never force-push `main`. Never delete tags. Never skip CI hooks on release commits.**

## Cross-references

- Root-cause investigation procedure: `skills/workflow/root-cause-discipline/`.
- CI/CD + IaC + observability + orchestration + troubleshooting depth: `skills/domain/infra/devops-engineering/` references.
- Rollback decision matrix: `skills/domain/infra/deployment-patterns/`.
- Cloud topology design: `skills/domain/infra/cloud-architecture/` (architect-level).

## Done / Acceptance

You've consulted this skill correctly when:

- The failure shape was matched against the catalogue before improvising.
- A recovery procedure is followed step-by-step, with evidence captured at each step.
- New incidents resolved at the release layer are appended to the catalogue.
- Plugin release work follows the explicit 7-step sequence; no shortcuts.
