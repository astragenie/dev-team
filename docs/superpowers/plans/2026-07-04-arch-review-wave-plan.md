# Arch-Review Backlog — Regular Wave-Mode Execution Plan

- **Created:** 2026-07-04
- **Source:** `docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md` §2.1–2.10, §15
- **Method:** the sanctioned wave loop — triaged slices carry `touches_files`; `runner:wave` conflict-packs non-overlapping slices into parallel worktrees, merges PASS, pivots FAIL into `/crew:fix` next wave. Config already live in `.claude/loop.json` (`loop.marathonRunner: "wave"`, `wave.size: 3`).
- **Prior wave:** FEAT-189/181/187 shipped on `feat/auto-safe-wave` (this branch). This plan is the follow-on.

## The regular-way mechanics

```bash
RP=/c/Users/serge/.claude/plugins/cache/astra/runner/0.51.1
# 1. see the next wave the planner would pack (no dispatch):
bun "$RP/src/scripts/loop.mts" wave plan --repo "$PWD" --json
# 2. run one wave (harness dispatches parallel Agents into .worktrees/SLICE-*, merges PASS):
bun "$RP/src/scripts/loop.mts" wave run --repo "$PWD"
# 3. or loop until backlog exhausted / max-waves:
bun "$RP/src/scripts/loop.mts" wave loop --repo "$PWD" --max-waves 4
```

`run` must be invoked from inside Claude Code (harness materializes the parallel-agent batch). Each slice runs `wave.sliceCommand` (`/crew:build`) in its own worktree and returns a PASS/FAIL marker.

## ⚠️ Pre-flight (MANDATORY — planner does not filter `autonomous_safe`)

The wave planner packs **every** triaged slice with `touches_files`, regardless of `autonomous_safe` or unmet `depends_on` (documented limitation in `runner` wave.md). So before `wave plan`:

1. **Reconcile `triaged/` (this IS arch §2.10).** Per the report, 9 already-shipped phantoms sit in `triaged/` (FEAT-183, FEAT-186, SLICE-100/101/102/109/110/111/112/113/114 have shipped commits). Move every confirmed-shipped item to `done/`.
2. **Quarantine unsafe/blocked items.** Move `autonomous_safe: false` and unmet-`depends_on` slices OUT of `triaged/` (into `pending/` or a `hold/`) so the planner cannot grab them: FEAT-182 (safe=false), FEAT-185 (cross-repo, Track 3), SLICE-102 (recheck deps after step 1 — SLICE-100/101 shipped, so it MAY unblock; still safe=false → keep out of autonomous wave).
3. After steps 1–2, `triaged/` must contain **only** the autonomous-safe, deps-met slices below. Verify with `bun ... wave plan --json` and confirm `excluded[]` has no surprise inclusions.

## Track 1 — Autonomous wave (safe, parallel via runner:wave)

All `autonomous_safe: true`, deps-met, **disjoint `touches_files`** → pack in one wave.

| Slice | Finding | Owns (no overlap) | Effort |
|---|---|---|---|
| **SLICE-197** CI-gate hygiene | §2.7 + §2.8 + §2.9 + §2.10-wiring | `.github/workflows/test.yml` (sole owner), `scripts/validate-routing-table.ts`, `scripts/validate-typegraph.ts` (delete), `scripts/validate-adr-template.ts`, `scripts/validate-backlog-drift.ts` (new), `docs/routing-table.md`, `docs/architecture/decisions/ADR-00*.md` | M |
| **SLICE-198** 3rdparty agent repair | §2.6 | `agents/3rdparty/*.md` only | S–M |

> **Why test.yml is one owner:** §2.7/2.8/2.9/2.10 all edit `.github/workflows/test.yml`. Splitting them = 4-way conflict → planner serializes them across 4 waves (no parallelism). Bundling all CI-workflow edits into SLICE-197 keeps test.yml single-owner; SLICE-198 touches only `agents/3rdparty/**` → genuinely parallel. Wave 1 = size 2.

### SLICE-197 scope (CI-gate hygiene)
- §2.7: add an `agents/*.md` basename → routing-table presence check to `validate-routing-table.ts`; flip its CI step from `advisory-validators` to blocking; backfill the 7 missing agents (`aiplugin-dev`, `architect-reviewer`, `c-sharp-reviewer`, `dev-lite`, `inspector-lite`, `performance-engineer`, `typescript-reviewer`) into `docs/routing-table.md`.
- §2.8: delete `scripts/validate-typegraph.ts` + its `advisory-bun-commands` CI entry (all `.mjs` migrated; `bun run typecheck` already blocks).
- §2.9: rename `validate-adr-template.ts`'s expected heading to `## Alternatives considered` (matches both existing ADRs); wire it into `advisory-validators`.
- §2.10-wiring: new `scripts/validate-backlog-drift.ts` — diff `triaged/` slice IDs vs `git log --grep "close SLICE"`; wire advisory. (The retroactive file moves are done in Pre-flight, not here.)

### SLICE-198 scope (3rdparty repair)
- Rewrite `agents/3rdparty/expert-react-frontend-engineer.md` `tools:` frontmatter from VS Code Copilot names → Claude Code names (`Read`/`Edit`/`Bash`/`Grep`/…); smoke-verify before trusting in `uxdesigner.md` delegation map.
- For `frontend-developer.md`, `mobile-developer.md`, `refactoring-specialist.md`, `database-architect.md`: strip foreign `context-manager` "Communication Protocol" boilerplate; replace invented peer names (`postgres-pro`, `neon-database-architect`, `tech-lead`, `code-reviewer`, …) with this repo's real agents, OR add a `reference-only / non-dispatchable` header.

Future waves auto-pack as more safe slices land in `triaged/` (e.g. splitting SLICE-197 finer, or new arch-review §5–14 findings). No re-plumbing needed.

## Track 2 — Human-gated (interactive `/crew:build` + mandatory review; NOT in autonomous wave)

`autonomous_safe: false` → run one at a time interactively so a human reviews before merge. Runs in parallel with Track 1 (different files, different mechanism).

1. **PHANTOM-AGENT FIX (§2.1, P0 — do FIRST).** 6 dispatched names don't exist; `/crew:review` errors today. Repo-wide: either finish the `inspector→reviewer` rename (git mv + grep-replace every `crew:<name>` in `commands/**` + `skills/**` + agent blacklists + `validate-agents.ts` `EVALS_REQUIRED`) OR revert every phantom ref to real names (`inspector`/`verifier`/`release-engineer`) and delete the abandoned rename-design doc. Add the CI resolver check (§2.1 fix): every `crew:<name>` in `commands/*.md`/`skills/**` must resolve to `agents/<name>.md` (~30 LoC in `validate-dispatch-graph.ts`). Not autonomous — high blast radius.
2. **FEAT-188 memory provider** (P1) — 5 sequential slices S1→S5; S1 (capture repair) has standalone value. S3 injects into all 6 dispatch-assembly sites → mandatory human review. Its own multi-slice sub-plan: `docs/superpowers/specs/2026-07-04-memory-provider-plan.md`.
3. **§2.4 reviewer-cluster overlap** (Med) — dedupe the C# checklist across `csharp-reviewer` + `inspector` under one trust posture.
4. **FEAT-182 incident-response skill** (P2).

## Track 3 — Cross-repo (separate session, per HARD RULE)

- **FEAT-185 SLICE-109** — move azure provider into `gepa-core` (sibling repo). Cross-repo edits require gepa-core's own worktree/session (memory [[cross-repo-edits-require-worktree]]). gepa-core cadence 0.4.0→0.5.0. Not runnable from this repo's wave.

## Track 4 — Operator-only (needs live API keys)

- **§2.3 GEPA corpus grow** (P1). The FEAT-189 specs (just shipped) are authored but n=8/10 < `min_soak_trials=20`. Run `GROQ_API_KEY=… GEMINI_API_KEY=… bun run evals --live --prompt <agent>` per agent to seed real trials toward the floor before any `/crew:gepa-optimize` promotion is trusted. Pure operator step; no code.

## Sequencing summary

```
Pre-flight (manual): reconcile triaged/ → only SLICE-197,198 remain
  │
  ├── Track 1  Wave 1: [SLICE-197 ‖ SLICE-198]  → merge PASS → feat branch   (runner:wave)
  │            Wave 2+: auto-pack next safe slices; FAIL pivots to /crew:fix
  │
  ├── Track 2  interactive, human-reviewed:  §2.1(P0) → FEAT-188 → §2.4 → FEAT-182
  │
  ├── Track 3  separate gepa-core session:   FEAT-185 SLICE-109
  │
  └── Track 4  operator + keys:              §2.3 live-eval corpus grow
```

Merges land on the feature branch only. Main promotion / push / tag stay operator-gated.
