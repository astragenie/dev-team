# Final Synthesis: gstack Installation + Crew Integration

## What happened this session

### Phase 1: gstack Installation
- Installed Bun v1.3.14 at `~/.bun/bin/bun.exe`
- Cloned gstack to `~/.claude/skills/gstack/` (depth-1)
- Ran `./setup` — built browse/design/pdf binaries, downloaded Playwright Chromium, generated 48 skill docs
- **Windows fix:** `link_claude_skill_dirs` silently failed. Manually copied 51 `SKILL.md` files to individual `~/.claude/skills/gstack-<name>/` dirs. All skills now discoverable with `gstack-` prefix.

### Phase 2: Routing Table (committed, pushed)
- 5 new rows in `docs/routing-table.md` (commit 4049867):
  - `/gstack-cso` → reviewer (security)
  - `/gstack-qa` → validator (browser QA)
  - `/gstack-office-hours` + `/gstack-plan-ceo-review` → lead (scope)
  - `/gstack-investigate` → researcher (debug escalation)
  - `/gstack-benchmark` → deployer/validator (perf)

### Phase 3: Global CLAUDE.md
- Added gstack routing section with use/skip guidance
- Explicitly marks `/gstack-review`, `/gstack-ship`, `/gstack-retro` as DO-NOT-USE (crew covers better)

### Phase 4: Crew Agent Custom Instructions
- Created `~/.claude/crew/reviewer.md` — wires `/gstack-cso`, `/gstack-health`, `/gstack-design-review`
- Created `~/.claude/crew/builder.md` — wires `/gstack-plan-eng-review`, `/gstack-investigate`
- Created `~/.claude/crew/validator.md` — wires `/gstack-qa`, `/gstack-benchmark`
- Placed in global `~/.claude/crew/` (applies to all repos)

## Commits pushed to origin/main
- `4049867` feat(routing): add gstack integration rows
- `82b1b47` docs(handoff): gstack installation + crew integration session record

## Open decision
User asked whether custom instruction files should stay global (`~/.claude/crew/`) or move into repo (`.claude/crew/`). Awaiting answer. Current state: global only.

- **Global** = applies to all repos, not committed, not shared with collaborators
- **Repo** = committed, shared, but only applies to hero-crew repo
- **Both** = global as default, repo overrides where needed

## Tech debt
- Windows gstack skill linking is fragile. After `git pull` on gstack, must re-run manual copy or re-run `./setup` and verify. Consider scripting a `gstack-refresh.sh` helper.
- gstack skills total ~700K tokens. Monitor session startup time.

## What's next
1. Resolve global vs repo placement of custom instructions
2. Test integration: run `/crew:review` on security-bearing code, verify `/gstack-cso` invoked
3. Test `/gstack-qa` on a web app repo to verify Playwright works
