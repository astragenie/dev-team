# Astra Rebrand Migration (v0.2 → v0.3)

`v0.3.0` renames the marketplace `crew-dev` → `astra` and the companion
plugin `autonomous-loop` → `loop`. Existing installs must be re-registered.

## One-time Claude Code re-install

```text
/plugin uninstall autonomous-loop@crew-dev
/plugin uninstall crew@crew-dev
/plugin marketplace remove crew-dev
/plugin marketplace add sergeymilashico/hero-crew
/plugin install crew@astra
/plugin install loop@astra
```

After the new install, the local cache lives at:

```
~/.claude/plugins/cache/astra/crew/0.3.0/
~/.claude/plugins/cache/astra/loop/0.3.0/
```

The orphan cache dir `~/.claude/plugins/marketplaces/crew-dev/` can be
deleted manually.

## Consumer-repo state (companion plugin)

`loop@0.3.0` ships a migrator that auto-runs on first `/loop:install`:

| Before | After |
|---|---|
| `.claude/autonomous-loop.json` | `.claude/loop.json` |
| `.claude/autonomous-loop/rules.md` | `.claude/loop/rules.md` |
| `<!-- autonomous-loop:start -->` / `:end -->` in `CLAUDE.md` | `<!-- loop:start -->` / `:end -->` |

The migrator is idempotent; re-running `/loop:install` after migration
is a no-op for the migrator step. No manual edits are required in
consumer repos.

## Slash-command namespace

The companion plugin's slash commands change namespace:

| Before | After |
|---|---|
| `/autonomous-loop:install` | `/loop:install` |
| `/autonomous-loop:slice-start` | `/loop:slice-start` |
| `/autonomous-loop:phase-gate` | `/loop:phase-gate` |
| (33 commands total) | (33 commands total) |

The `crew` plugin's `/crew:*` namespace is unchanged.

## Verifying

After re-install:

```bash
/plugin
```

Expect:

- `crew@astra` — `0.3.0`
- `loop@astra` — `0.3.0`

In a consumer repo previously running the old plugin:

```bash
/loop:install
```

Watch the install output for the `legacyMigration` summary listing the
rename steps that ran. Each step appears at most once across the
lifetime of the consumer repo.
