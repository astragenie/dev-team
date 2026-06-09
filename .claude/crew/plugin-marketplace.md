# Plugin Marketplace — crew

## Sources

The `crew` plugin ships from this repo. The `loop` plugin ships from a separate repo.

| Plugin | Marketplace | GitHub Repo |
|--------|-------------|-------------|
| `crew` | `astra` | `sergeymilashico/hero-crew` |
| `loop` | `loop` | `sergeymilashico/hero-crew-autonomous-loop` |

## IMPORTANT: Never create local marketplaces

Always register marketplaces from GitHub, not from local paths.
Use `"source": "github"` in `known_marketplaces.json`.

## Registry files (user-global)

- `~/.claude/plugins/known_marketplaces.json` — marketplace registrations
- `~/.claude/plugins/installed_plugins.json` — installed plugin versions
- `~/.claude/plugins/marketplaces/astra/` — GitHub clone of this repo
- `~/.claude/plugins/marketplaces/loop/` — GitHub clone of loop repo
- `~/.claude/plugins/MARKETPLACE-SETUP.md` — full re-registration runbook

## Re-register from scratch

```bash
git clone --depth 1 https://github.com/sergeymilashico/hero-crew \
  ~/.claude/plugins/marketplaces/astra
git clone --depth 1 https://github.com/sergeymilashico/hero-crew-autonomous-loop \
  ~/.claude/plugins/marketplaces/loop
```

Add to `known_marketplaces.json`:
```json
"astra": { "source": { "source": "github", "repo": "sergeymilashico/hero-crew" },
           "installLocation": "~/.claude/plugins/marketplaces/astra" },
"loop":  { "source": { "source": "github", "repo": "sergeymilashico/hero-crew-autonomous-loop" },
           "installLocation": "~/.claude/plugins/marketplaces/loop" }
```

Add to `installed_plugins.json`:
```json
"crew@astra": [{ "scope": "user", "installPath": "~/.claude/plugins/cache/astra/crew/<ver>", "version": "<ver>" }],
"loop@loop":  [{ "scope": "user", "installPath": "~/.claude/plugins/cache/astra/loop/<ver>",  "version": "<ver>" }]
```
