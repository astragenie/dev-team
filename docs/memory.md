# dev-team — Memory (durable facts index)

Volatile, dated facts agents keep rediscovering. **Supersede entries by editing them in place**
(update the date + content) rather than appending forever. For history, see
`.claude/artifacts/crew/{runs,handoffs}/`, `.claude/artifacts/loop/decisions/DEC-*.md`, and git log.

`CLAUDE.md` should change rarely; this file is where the dated "verified on" facts and phase-baseline
state that used to live in CLAUDE.md's "v0.2.0 baseline addendum" now live.

## Current release (verified 2026-07-21)

- `package.json` and `.claude-plugin/plugin.json` both at **v0.67.0** (2026-07-18, "enforcement
  hooks, repair dedup, GEPA honesty, QA-gate agent modes"). `marketplace.json` is not in this repo —
  registry lives in `astragenie/astra-marketplace`.
- Companion plugins: `loop` (`astragenie/runner-plugin`, own standalone marketplace),
  `cortex`/memory-plugin (referenced in README install block).

## Phase 1 (Engineering OS) baseline — closed at v0.2.0 (2026-05-22)

Treat the following as the assumed floor; consult `CHANGELOG.md` for detail since and
`docs/routing-table.md` for current routing:

- Skill taxonomy live: `universal/`, `workflow/`, `domain/`, `meta/`, enforced by
  `scripts/validate-skills.ts` (name/tier/description required, ≤200 lines, tier in enum).
- `docs/routing-table.md` is authoritative; `/crew:brief-me` warns if its mtime exceeds 30 days.
  Builder routing matrix (FEAT-170 SLICE-C): `BE_ONLY`/`FE_ONLY` tags route to specialists,
  `TS_TOOLING_ONLY` routes to `backend-dev`, untagged slices default to `fullstack-dev`.
- Workflow badges `blocked` / `escalated_to_lead` are first-class (`--note` / `--blocked-by`);
  `write-final-synthesis` refuses to run while escalated unless `--force`.
- `crew fleet` surfaces parallel-worktree visibility — check before claiming files in multi-tree work.
- TDD policy wired into builder + reviewer prompts (FEAT-011); reviewer enforces test presence on
  runnable changes.
- Cost reports land in `.claude/artifacts/crew/cost/` per slice; historical baseline ~$40/slice on
  opus-4-7 at 99.9% cache hit (pre model-routing).
- **Model routing (v0.52.0, FEAT-194/#167):** builds route to Sonnet via `loop.modelRouting`
  (`{architect:opus, build:sonnet, default:sonnet}`); a PreToolUse hook hard-enforces it on
  builder-tier dispatch. Toggle: `crew.json` `features["model-routing"]`. Root cause of the earlier
  Opus burn: missing `modelRouting` block caused fallback to Opus for every non-trivial build. Watch
  with `crew cost-watch [--token-cap N]`.

## Open Phase 1 deferrals

- **FEAT-005** (snapshot telemetry beyond the loop plugin) and **FEAT-009**: intentionally deferred
  behind explicit "when X observed" triggers — do not pick up without the trigger firing.

## Known drift fixed by the 2026-07-21 agentic-setup rebuild (do not re-raise)

- `README.md` pinned-release line was `v0.65.0` (2 releases stale vs `0.67.0`) — corrected.
- `README.md` stated the skill count as both "69" and "34" in two places; actual on-disk count is
  **49** (universal 6 + workflow 29 + domain 13 + meta 1) — corrected, both instances.
- `README.md` had two `## Install` headers (a stale generic-install duplicate under the real
  astra-marketplace install flow) — merged into one.
- `.claude/crew/deployment.md` described a pre-TS-migration release process (`.mjs` script names,
  a 3-manifest bump including `marketplace.json`) that no longer matches reality (32 `.ts` scripts,
  0 `.mjs`; `marketplace.json` absent from this repo). Superseded — `AGENTS.md` Release workflow +
  `CLAUDE.md` are now the sources of truth for release steps.
- `CLAUDE.md`'s own "Read first" list pointed at `docs/backlog/product-backlog.md` as "current...
  (FEAT-001…FEAT-010)" while a later section of the same file said the authoritative backlog moved
  to `.claude/artifacts/loop/backlog/` in 2026-06-10 — self-contradiction, removed the stale pointer.
- Stray empty `.agents/` directory (untracked, no files, no references) removed.
- `crew-architecture-analysis.md` / `crew-optimization.md` — v0.1.0-era analysis docs that had been
  sitting at repo root — moved to `docs/research/` with a dated header noting they predate the
  current agent roster (`lead`/`builder`/`deployer` no longer exist; today's roster is
  `fullstack-dev`/`backend-dev`/.../`release-engineer`).

## kb linkage note

kb's `02-systems/hero-crew.md` page (as of 2026-07-21, before this run) states v0.1.0, "external deps:
none", "autonomous loop: absent", and "docs/ (15 reference docs)" — all four are stale against this
repo's actual v0.67.0 state (real `@astragenie/*` npm deps, an active `.claude/loop.json` +
loop:start/end HARD RULE block, and 17 `docs/` subdirectories). Flagged back to the kb owner in this
run's handoff rather than edited directly (kb is out of this repo's write scope).
