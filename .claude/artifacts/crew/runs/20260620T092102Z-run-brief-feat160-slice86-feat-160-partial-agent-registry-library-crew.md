---
feature: FEAT-160
status: active
---
# Run Brief: FEAT160 SLICE86: FEAT-160 partial — agent-registry library + crew agent-route CLI (no lead.md edit)

- Created: 2026-06-20T09:21:02.799Z
- Tier: full
- Goal: -
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - 1. New `scripts/lib/agent-registry.ts`:
   - exports `AgentCapabilities`
  - `AgentRegistryEntry`
  - `RouteQuery`
  - `RouteMatch` types
   - `loadAgentRegistry(repo
  - agentsSubdir = "agents")` — walks `agents/**/*.md`
  - parses YAML frontmatter via existing `yaml` dep
   - `routeByTags(registry
  - query)` — filters by role/surface/stack/concern/lens/scope
  - returns ranked `RouteMatch[]` (score = `matched_count * 10 + priority`)
   - silently skips files without `capabilities:` frontmatter (descriptive-only agents)
2. Edit `scripts/crew.ts`:
   - add `--role`
  - `--surface`
  - `--stack`
  - `--concern`
  - `--lens` flags (reuses existing `--scope`)
   - add `agent-route` subcommand: pretty table output + JSON return shape `{ registryCount
  - matchCount }`
   - add usage entry for `agent-route`
3. New `tests/agent-r
- Out Of Scope: -
- Planned Files: -
- Next Step: Begin implementation

