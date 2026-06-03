---
date: 2026-06-02
kind: operations-runbook
target_release: crew@0.7.0
loop_companion: loop@0.5.6
status: ready-to-execute
audience: user (runs the bump in Claude Code)
related_spec: docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md
---

# Consumer crew@0.7.0 + loop@0.5.6 bump — Runbook

## Purpose

Roll out the perf-stabilization arc (crew@0.4.0..0.7.0 + FEAT-035 quality bar) to the five consumer repos by bumping the user-global Claude Code plugin install. No per-repo file changes; all consumers pick up the new version on next session in their repo.

Target rollout: crew@0.7.0 + loop@0.5.6.

## Pre-check

Before running the bump commands, verify:

1. Claude Code is installed on this machine.
   - POSIX shell: `which claude`
   - PowerShell: `(Get-Command claude).Source`
2. The `v0.7.0` tag exists on the `hero-crew` remote:
   `gh release view v0.7.0 -R sergeymilashico/hero-crew`
3. The `v0.5.6` tag exists on the `hero-crew-autonomous-loop` remote:
   `gh release view v0.5.6 -R sergeymilashico/hero-crew-autonomous-loop`

If any pre-check fails, stop. Either install Claude Code, or wait for the missing release to be cut.

## Bump commands

In Claude Code, run these slash commands once at the user level. `/plugin marketplace add` takes ONE arg — the source (`owner/repo`, full HTTPS URL, or local path). Do NOT add a marketplace nickname inline; Claude Code will reject the syntax.

```
/plugin marketplace add sergeymilashico/hero-crew
/plugin install crew
/plugin install loop
```

Equivalent forms for the marketplace arg:

- `sergeymilashico/hero-crew` — GitHub `owner/repo` (shortest)
- `https://github.com/sergeymilashico/hero-crew` — full URL (works in the interactive dialog)
- `./path/to/local/clone` — local path (offline / development)

If already installed at an earlier version, use the upgrade form:

```
/plugin update crew
/plugin update loop
```

After install, restart any open Claude Code sessions so they pick up the new plugin binaries.

## Verification per repo

For each consumer repo, open a Claude Code session in the repo directory and run `/crew:brief-me`. Confirm output references crew@0.7.0 features:

- `validate-agents.mjs` mentioned in CI gate list (FEAT-035 marker)
- `--validation-evidence` flag or `Validation Evidence` section visible in reviewer guidance (FEAT-030 marker)
- `Recommended Model` or `model-selection gate` mentioned in lead workflow (FEAT-031 marker)

Repos to verify (in any order):

- `C:/work/mega/cortex`
- `C:/work/mega/authentic`
- `C:/work/mega/loopobserver`
- `C:/work/mega/citylive`
- `C:/work/mega/hero-crew-autonomous-loop` (hcal) — for hcal, also confirm `loop@0.5.6` reports clean from `node "$LOOP_CLI" status` (see the loop CLI 0.5.5 workaround note in your memory).

If `/crew:brief-me` in any repo still references a pre-0.7.0 feature set, the bump did not propagate to that session. Restart that Claude Code session and re-verify.

## Rollback

If a regression surfaces after the bump, pin to the prior version:

```
/plugin install crew@0.6.0
/plugin install loop@0.5.4
```

Notes:

- `loop@0.5.5` is the **known-broken** release (missing `presets/` directory; `slice` subcommands ENOENT). Do NOT roll back to 0.5.5. Roll directly to 0.5.4 or the latest 0.5.6.
- The hero-crew marketplace pin is currently `loop@0.5.6` and has been verified post-bump (see `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md`).
- Rolling back `crew` to 0.6.0 retains the agent-quality-bar CI gate + lean-agent enrichments but loses the Sonnet-default model gate (FEAT-031).

## Audit-trail

Append a single dated line each time someone runs this bump:

| Date | Operator | Pre-bump crew | Post-bump crew | Pre-bump loop | Post-bump loop | Notes |
|---|---|---|---|---|---|---|
| 2026-06-02 | herolegion | unknown | 0.7.0 | unknown | 0.5.6 | initial v0.7.0 rollout; hook count delta 10→15 (FEAT-029 + FEAT-033 + FEAT-032) |
