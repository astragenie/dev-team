# Handoff: gstack Installation + Crew Integration

## Objective
Install gstack (Garry Tan's 48-skill Claude Code skill pack) alongside crew plugin and wire complementary capabilities into crew's routing table.

## Owner
lead (single-session, user-assisted)

## What's Done

### Installation
- [x] Bun v1.3.14 installed at `~/.bun/bin/bun.exe`
- [x] gstack cloned to `~/.claude/skills/gstack/` (depth-1, single-branch)
- [x] `./setup` ran — 227 npm packages installed, 48 skill docs generated across 7 hosts (Claude, Codex, Factory, Kiro, OpenCode, Slate, gBrain)
- [x] Browse/design/pdf/discover binaries compiled (browse.exe, find-browse.exe, design.exe, pdf.exe, gstack-global-discover.exe)
- [x] Playwright Chromium downloaded (bun install completed exit 0)

### Skill Discovery Fix (manual)
- [x] `./setup` failed silently to create individual skill dirs on Windows — `link_claude_skill_dirs` produced no output
- [x] Manual workaround: iterated `gstack/*/SKILL.md`, created `~/.claude/skills/gstack-<name>/SKILL.md` (cp, not symlink) — 51 skills + root alias = 53 dirs total
- [x] Skills now prefixed `gstack-` (e.g., `/gstack-office-hours`, `/gstack-cso`, `/gstack-qa`)
- **Tech debt:** after `git pull` on gstack, must re-run the manual copy or re-run `./setup` and verify linking worked

### Configuration
- [x] Global `~/.claude/CLAUDE.md` — added gstack routing section with use/skip guidance
- [x] `docs/routing-table.md` — 5 new rows committed (4049867):
  - `/cso` → reviewer (security-sensitive changes)
  - `/qa` → validator (web UI behavior)
  - `/office-hours` + `/plan-ceo-review` → lead (scope challenge)
  - `/investigate` → researcher (debug escalation)
  - `/benchmark` → deployer/validator (perf evidence)

### Conflict Avoidance
- crew commands namespaced (`crew:review`, `crew:ship`) — no hard conflict with gstack prefixed names (`/gstack-review`, `/gstack-ship`)
- CLAUDE.md routing section explicitly marks gstack `/review`, `/ship`, `/retro` as DO-NOT-USE (crew covers better)
- All gstack skills prefixed `gstack-` — no namespace collision possible

## What's Next

1. **Verify skills recognized** — `/reload-plugins` then type `/gstack-office-hours` and `/gstack-cso` to confirm discovery.
2. **Verify no routing collision** — type `/crew:review` and confirm it routes to crew:reviewer, not gstack review.
3. **Try gstack skills on real work** — use `/gstack-office-hours` before next FEAT, `/gstack-cso` on security-bearing PR, `/gstack-qa` on web UI change.
4. **Update global CLAUDE.md** — routing section references bare names (`/office-hours`), should update to prefixed names (`/gstack-office-hours`) for accuracy.

## Risks
- **Windows skill linking fragile.** `./setup` `link_claude_skill_dirs` silently failed. After `git pull` on gstack, manual copy must be re-run. Consider scripting a `gstack-refresh.sh` helper.
- gstack skills are large (~700K tokens total across 51 skills). May impact session startup. Monitor for slowness.
- gstack `/ship` skill exceeds 40K token ceiling (warned during build). Not a problem since we skip it in favor of `crew:ship`.

## Changed Files
- `docs/routing-table.md` (committed: 4049867)
- `~/.claude/CLAUDE.md` (outside repo, edited in place)
- `~/.claude/skills/gstack/` (new installation, outside repo)
- `~/.claude/skills/gstack-*/` (51 individual skill dirs, manual copy, outside repo)
- `~/.claude/skills/_gstack-command/` (root alias, outside repo)
- `~/.bun/` (new Bun installation, outside repo)

## Confidence
High for routing integration. High for skill discovery (manual copy verified 53 dirs). Unverified: `/gstack-office-hours` in live session (needs `/reload-plugins`).
