# dev-team Agentic Setup Audit — Phase 1 (read-only inventory)

Run: 2026-07-21. Pattern: `../kb/05-patterns/agentic-repo-setup.md`. Scope: repo instruction layer only
(`CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/` reference tree, `.claude/` config, root hygiene).
Out of scope by explicit instruction: `agents/`, `commands/`, `skills/`, `.claude-plugin/` — these are
shipped plugin PRODUCT, not this repo's own instruction layer.

Repo facts confirmed on disk: `package.json` name `crew-plugin` v**0.67.0**; `.claude-plugin/plugin.json`
name `crew` v**0.67.0** (version parity OK — CURRENT). No `.claude-plugin/marketplace.json` in-repo
(confirmed absent — registry lives in `astragenie/astra-marketplace`). 23 top-level agent `.md` files.
Skills: universal 6, workflow 29, domain 13, meta 1 = **49 total**. 32 `scripts/*.ts` files, 0 `.mjs`.//
CI: `.github/workflows/test.yml` delegates to reusable workflow `astragenie/common/.../reusable-plugin-ci.yml@v1`
with 8 inline validators + `check-redundant-read.ts` hook.

## Secret-file protocol result

Ran `git check-ignore -v`, `git ls-files --`, `git log --all --oneline --` on `.env.example`, `.npmrc`,
`.mcp.json` (the only credential-shaped root filenames). All three are **intentionally tracked
templates/configs** (commit history: "add `.env.example` template for GROQ/GEMINI judge keys",
"npmrc scope override", "context7 MCP integration") — not raw secrets. Contents were **not read**, per
protocol. **No SECRET-EXPOSED finding.** Clear to proceed with normal edits.

## Root instruction files

| Item | Grade | Evidence | Proposed action |
|---|---|---|---|
| `CLAUDE.md` (297 lines) | **STALE** (shape) + **CONTRADICTED** (one row) | Target shape caps `CLAUDE.md` at ~130 lines with volatile state moved out (`agentic-repo-setup.md`). Current file embeds a full CI-gate list, release workflow, versioning rules, backlog-discipline detail, and a duplicated Autonomous Loop HARD RULE block (277–293) alongside AGENTS-shaped commands content (46–113) — none of that is mission/decision altitude. "Read first" item 4 says `docs/backlog/product-backlog.md` is "current Engineering OS backlog (FEAT-001…FEAT-010)" but the file's own line 180–183 says the authoritative backlog tree has been `.claude/artifacts/loop/backlog/{pending,triaged,in-progress,done}/` since 2026-06-10 and `docs/backlog/` "retains only non-state files" — the two statements contradict each other in the same file. | Split into `AGENTS.md` (commands/CI/release/structure) + slim `CLAUDE.md` (mission/decisions/canon) + `docs/memory.md` (volatile state). Fix the backlog self-contradiction by removing the stale "Read first" pointer. |
| `AGENTS.md` | **ORPHANED** | Does not exist. Root has a stray empty `.agents/` directory instead (untracked, zero files, no apparent purpose — likely an accidental `mkdir` typo for `agents/`). | Create `AGENTS.md` per target shape. Delete empty `.agents/` (untracked, harmless to remove; not referenced anywhere — grepped for `.agents/` outside of `agents/` matches only path substrings in unrelated files). |
| `README.md` (321 lines) | **CONTRADICTED** (2 rows) | (1) Line 76: "Pinned release: `v0.65.0`" vs `package.json`/`plugin.json` = `0.67.0` and `CHANGELOG.md` top entry = `v0.67.0` (2026-07-18) — stale by 2 releases. (2) Skill count stated twice, inconsistently and both wrong: line 40 "a library of **69 skills**" vs Project-structure line 313 "**34 skills** across universal/, workflow/, domain/, meta/ tiers" vs actual on-disk count **49** (6+29+13+1). Also two `## Install` headers (58 and 110) — duplicate section, second one gives a generic `claude plugin install crew` while the first gives the actual astra-marketplace flow; the second is dead/superseded content nobody removed. | Fix pinned-release line, fix skill count to 49, merge/remove the duplicate `## Install` section. |
| `.claude/crew/deployment.md` | **CONTRADICTED** | Release steps (line 42–45) say bump version "in three places" including `.claude-plugin/marketplace.json → plugins[name=crew].version` — that file does not exist in this repo (confirmed via `ls`, matches `CLAUDE.md`'s own correct statement that marketplace.json moved out). Prerequisites list (line 28–36) cites `validate-manifests.mjs`, `validate-skills.mjs`, `validate-slices.mjs`, `npm run lint`, `node --test`, `node ./scripts/e2e-smoke.mjs` — **zero `.mjs` files exist** in `scripts/` (32 `.ts` files confirmed); actual CI (`test.yml`) runs 8+ `.ts` validators via `bun`/`node`, not the 6 `.mjs` files this doc names. This file appears to describe an older pre-TS-migration release process (see `docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md`, referenced elsewhere) never updated after the migration. | Rewrite to match `CLAUDE.md`'s already-correct release workflow (2-manifest bump, `.ts` scripts) rather than duplicating it — or delete this file and point to `CLAUDE.md`'s Release & deployment section, since the two now disagree and `CLAUDE.md` is the more current one. |

## `docs/` tree (17 subdirs)

| Item | Grade | Evidence | Proposed action |
|---|---|---|---|
| `docs/architecture/`, `docs/standards/`, `docs/backlog/`, `docs/decisions/`, `docs/design/`, `docs/process/`, `docs/research/`, `docs/retrospectives/`, `docs/specs/`, `docs/superpowers/`, `docs/contracts/`, `docs/diagnostics/`, `docs/grades/`, `docs/investigations/`, `docs/observability/`, `docs/operations/`, `docs/prompts/` | **CURRENT** (no contradiction found) | Spot-checked cross-references from `README.md` and `CLAUDE.md` (`docs/process/validation-loop.md`, `docs/process/rebrand-migration.md`, `docs/architecture/product-roadmap.md`, `docs/decisions/README.md`, `docs/backlog/README.md`) — all resolve. `docs/decisions/README.md` explicitly documents that DEC-NNN files live at `.claude/artifacts/loop/decisions/`, not in this dir (by design, not drift) — kb's "Decisions dir: none" is wrong (see kb-linkage section below), this repo's own doc is accurate. | None — this tree is well-maintained and cross-referenced. Not touching per plugin-source scope (these are the repo's real docs, no rewrite needed beyond the new `docs/README.md` map). |
| No `docs/memory.md` | **ORPHANED** (gap, not defect) | No volatile-facts index exists. `CLAUDE.md`'s "v0.2.0 baseline addendum" (lines 226–264) and scattered dated facts throughout are exactly the kind of content `agentic-repo-setup.md` says belongs in a memory file instead of CLAUDE.md. | Create `docs/memory.md`, extract the dated/volatile facts out of `CLAUDE.md` into it. |
| No `docs/README.md` | **ORPHANED** (gap) | 17 subdirectories, no single map of what's where or which doc is authoritative for what. | Create `docs/README.md` per target shape. |

## `.claude/` config

| Item | Grade | Evidence | Proposed action |
|---|---|---|---|
| `.claude/loop.json` | **CURRENT** | Present and actively configured (`marathonRunner: wave`, `modelRouting`, `memory.provider: astramem`) — directly contradicts kb `02-systems/hero-crew.md`'s "Autonomous loop: absent" (see kb-linkage). | None — config is internally consistent with CLAUDE.md's loop:start/loop:end block. |
| `.claude/crew/constitution.md`, `protocol.md`, `workflow.md`, `plugin-marketplace.md` | **CURRENT** | Present, referenced correctly from CLAUDE.md's `crew:start`/`crew:end` block. | None. |
| `.claude/crew/telemetry.example.yaml` | **CURRENT** | Template file, real `telemetry.yaml` correctly gitignored (`.claude/crew/telemetry.yaml` in `.gitignore` line 13). | None. |
| `.gitignore` | **CURRENT** | Already covers this repo's actual litter surface (`.claude/logs/`, `.claude/state/`, `.claude/worktrees/`, `.claude.backup.*`, `.env*`, gepa locks/candidates, `evals/runs/`, `langfuse/data/`) — no gaps found against what's actually on disk. | None needed; this repo's hygiene is notably better than prism's was. No new patterns from the kb root-hygiene block apply (no `.aspire*`, no `.e2e-*`, no `scratch/` on disk here). |
| `.claude/settings.json`, `crew.json`, `workflows.yaml` | **CURRENT** | Present, no contradictions found in spot-check. | None. |
| `.gitleaks.toml` (staged, `A`, not by this session) | **CURRENT / in-flight** | Added by a concurrent session (git status shows `A` before this audit started) — a gitleaks config, not a secret; consistent with the secret-file protocol finding above. | Leave untouched — belongs to another in-flight session per the hard rule about concurrent sessions. |
| Untracked: `.claude/artifacts/crew/handoffs/20260720T175924Z-...md`, `scripts/windows/*.ps1` | **CURRENT / in-flight** | Pre-existing uncommitted work from a prior/concurrent session. | Leave untouched. |

## Root hygiene

| Item | Grade | Evidence | Proposed action |
|---|---|---|---|
| `.agents/` (empty, untracked dir) | **ORPHANED** | `git ls-files -- '.agents/*'` returns nothing; `find .agents -type f` returns nothing; not referenced by any doc. | Delete (empty dir, untracked, no history, no references). |
| `crew-architecture-analysis.md` (root, tracked, dated 2026-05-19) | **STALE** | A dated point-in-time architecture critique from the plugin's `v0.1.0` era ("crew-dev/crew v0.1.0 agents (lead, builder, researcher, reviewer, validator, deployer)") sitting at repo root instead of `docs/`. Content is historical, not current (the agent roster it critiques — `lead/builder/deployer` — no longer exists; today's roster is `fullstack-dev/backend-dev/.../release-engineer`, per README). Not referenced from any current doc. | Move to `docs/research/` or `docs/retrospectives/` (historical record, don't delete — has genuine "why we changed the model routing" provenance value) with a one-line dated header noting it predates the current agent roster. |
| `crew-optimization.md` (root, tracked, dated 2026-05-19) | **STALE** | Companion doc to the above; same era, same issue — root-level clutter, historical value only, not referenced from current docs. | Move alongside the above, same treatment. |
| Standard build artifacts (`node_modules/`, `bun.lock`, `package-lock.json`) | **CURRENT** | Properly ignored/tracked as expected; no litter. | None. |
| No `.aspire*`, `.e2e-*`, `scratch/`, smoke `.png` files found at root | **N/A** | This repo is JS/TS-only, no Aspire/Playwright artifacts apply. | None — kb's generic root-hygiene gitignore block doesn't add anything new here. |

## Summary counts

- CURRENT: 14
- STALE: 4
- CONTRADICTED: 3 (rows counted per distinct claim: README pinned-release + skill-count, deployment.md release/CI mismatch, CLAUDE.md backlog self-contradiction)
- ORPHANED: 3 (`AGENTS.md` missing, `docs/memory.md` missing, `docs/README.md` missing, `.agents/` stray dir)

No `SECRET-EXPOSED` finding. Clear to proceed to Phase 2 (kb linkage) and Phase 3 (rebuild).
