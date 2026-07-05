# Autonomous-Safe Parallel Wave — Execution Plan

- **Created:** 2026-07-04
- **Author:** dispatcher (left running while operator away)
- **Worktree:** `C:/work/mega/dev-team-auto` on branch `feat/auto-safe-wave` (off `main` @ v0.50.0 / 4609537)
- **Mode:** parallel builders, one git worktree per slice, merge PASS to `feat/auto-safe-wave`. Never touches `main`.
- **Commit policy:** `dev.stable: true` + feature branch → builders commit autonomously per slice when slice-scoped tests pass + secret-grep clean + no `help_request` badge. (Constitution "dev.stable worktree carve-out".)
- **Stuck policy:** if a dispatched builder stalls, errors, or returns non-PASS twice, the orchestrator completes that slice **inline** and commits. No slice waits on a hung agent.

## Why these three FEATs (and not the others)

Only `autonomous_safe: true` items are in scope. Verified against backlog frontmatter 2026-07-04.

| In scope | P | safe | Rationale |
|---|---|---|---|
| **FEAT-189** eval-spec coverage GEPA v1 | P1 | ✅ | 6 agents carry `planned:evals` sentinels → 6 CI warnings; blocks honest GEPA corpus + FEAT-183 auto-merge (n=0 trials). Templated authoring, no runtime/dispatch-prompt change. |
| **FEAT-181** badge single-source validator | P2 | ✅ | New CI validator + catalog doc. Read-only consolidation + drift guard. No agent-prompt or runtime change. |
| **FEAT-187** local eval-run viewer | P2 | ✅ | New static HTML/TS panel over `evals/runs/`. New file tree, zero coupling. |

**Excluded — do NOT let the wave planner pick these** (autonomousSafe pre-flight drop is a *known unenforced gap* in wave planner, see `runner` wave.md limitations):

- **FEAT-188** memory provider — `autonomous_safe: false` (S3 injects into every builder/reviewer/verifier dispatch prompt; needs human-in-loop).
- **FEAT-182** incident-response skill — `autonomous_safe: false`.
- **SLICE-102 / FEAT-183 GEPA cluster** — `autonomous_safe: false`, and `depends_on: [SLICE-100, SLICE-101]` unmet.
- **Arch-review §2.1 phantom-agent fix** (unfiled, Critical) — repo-wide sweep of agent prompts + command dispatch tokens. High blast radius → interactive/human, not autonomous. Left for operator.

## Slice decomposition (all disjoint `touches_files` → all parallelizable)

| Slice | FEAT | Deliverable | Key files (no overlap with any other slice) |
|---|---|---|---|
| **SLICE-190** | 189 S1 | verifier eval spec + 5 fixtures; flip `planned:` → real path | `evals/agents/crew-verifier.yaml`, `evals/fixtures/verifier-*.txt`, `agents/verifier.md` (frontmatter line only) |
| **SLICE-191** | 189 S2 | backend-dev + frontend-dev eval specs + fixtures | `evals/agents/crew-backend-dev.yaml`, `crew-frontend-dev.yaml`, `evals/fixtures/backend-dev-*.txt`, `frontend-dev-*.txt`, `agents/backend-dev.md`, `agents/frontend-dev.md` (frontmatter lines only) |
| **SLICE-192** | 189 S3 | integrator + refactor eval specs + fixtures | `evals/agents/crew-integrator.yaml`, `crew-refactor.yaml`, `evals/fixtures/integrator-*.txt`, `refactor-*.txt`, `agents/integrator.md`, `agents/refactor.md` (frontmatter lines only) |
| **SLICE-193** | 189 S4 | release-engineer eval spec + fixtures | `evals/agents/crew-release-engineer.yaml`, `evals/fixtures/release-engineer-*.txt`, `agents/release-engineer.md` (frontmatter line only) |
| **SLICE-194** | 181 | badge single-source validator + catalog doc + CI gate | `scripts/validate-badges.ts`, `docs/standards/badge-catalog.md`, `.github/workflows/test.yml`, `tests/validate-badges.test.ts` |
| **SLICE-195** | 187 | static eval-run viewer HTML/TS | `evals/viewer/**` (new subtree), `package.json` script entry |

> `agents/*.md` edits in SLICE-190..193 are **single-line frontmatter path flips** (`evals: planned:evals/agents/X.yaml` → `evals: evals/agents/X.yaml`), each on a different file. Not prompt-body edits → still `autonomous_safe: true` per FEAT-189 triage.

## Precedent the builders MUST follow

- Spec format: `evals/agents/crew-fullstack-dev.yaml` + `evals/agents/crew-reviewer.yaml`.
- Judge recipe: `groq` primary (`llama-3.3-70b-versatile`) + `gemini` fallback (`gemini-2.5-flash`) + `validate_with: gemini`. `candidate: { runner: claude-p, model: claude-sonnet-4-6, subscription: true }`. `budget: { daily_cap_usd: 5.00 }`.
- ≥5 hand-seeded fixtures per agent, each a *realistic dispatch shape* (not lorem), each covering a **distinct failure mode** with an `llm-rubric` assertion. At least one `held_out: true`.
- Spec format authority: `evals/README.md`. Statistical rationale: `docs/standards/gepa-statistical-bar.md`.

### Per-agent failure modes to cover (from FEAT-189 ACs)

- **verifier** (critical-allowlist, n=0 today): false-PASS on failing scenario; false-FAIL on passing scenario; missing evidence citation; critical-allowlist misclassification.
- **backend-dev**: EF Core migration mistakes; missing null-safety; async/await misuse.
- **frontend-dev**: orval client drift; accessibility regression; missing test coverage on new components.
- **integrator**: false-PASS on broken live wire-up; missing OpenAPI-schema runtime validation.
- **refactor**: complexity-cap violation left unfixed; stale-ref false negative.
- **release-engineer**: skipping a CI gate before release; marketplace-manifest version mismatch; force-push/tag-delete risk miss.

## Per-slice acceptance gate (builder self-verify before commit)

1. `evals/agents/crew-<agent>.yaml` exists, parses, has candidate+judge+fallback+budget blocks.
2. ≥5 fixtures, each with a distinct-failure-mode `llm-rubric`.
3. `node ./scripts/validate-agents.ts` — the `planned:` warning for the target agent(s) no longer fires.
4. `bun run evals --dry-run --prompt <agent>` runs clean (no schema error). Live judge run NOT required (needs operator GROQ/GEMINI keys — defer, note in handoff).
5. Secret-grep clean on diff.
6. Commit: `feat(evals): SLICE-NNN — <agent> eval spec + fixtures (FEAT-189 SX)`.

SLICE-194 gate: new validator runs green in CI wiring locally (`node ./scripts/validate-badges.ts` exits 0), catalog doc lists every badge from `BADGE_HANDLERS`, test passes.
SLICE-195 gate: viewer opens a real `evals/runs/*.json` artifact and renders pass/fail + cost without a server; no external CDN (CSP-safe, inline assets).

## Orchestration procedure

1. Setup commit on `feat/auto-safe-wave`: this plan + 6 slice files + `loop.json` wave block. ✅ (this file is part of it)
2. Dispatch builders in parallel, ≤3 concurrent, each in its own git worktree `../dev-team-auto-SLICE-NNN` branched off `feat/auto-safe-wave`. Each builder prompt carries: scope, precedent files, failure-mode list, self-verify gate, **commit-when-green** instruction, and "return last-line JSON marker `{\"slice\":\"...\",\"status\":\"PASS|FAIL\"}`".
3. As each returns PASS → merge its branch into `feat/auto-safe-wave` (disjoint files → clean merge).
4. Any FAIL / stall / 2× retry → orchestrator completes inline, commits, merges.
5. After all 6 land: run `bun test src/tests/` + `node ./scripts/validate-agents.ts` on `feat/auto-safe-wave`; write final synthesis; leave branch for operator review. **Do not merge to `main`, do not push, do not tag** — operator-gated.

## Resume instructions (if this session's context is lost)

- Branch `feat/auto-safe-wave` in worktree `C:/work/mega/dev-team-auto` holds all slice files + this plan.
- Check `git -C C:/work/mega/dev-team-auto log --oneline` for which SLICEs already committed.
- For any slice not yet committed: dispatch `/crew:build --slice SLICE-NNN` from the worktree, or run `bun <runner>/src/scripts/loop.mts wave run --repo C:/work/mega/dev-team-auto` (wave config already set in `loop.json`).
- Unfinished/stuck → complete inline following the per-slice acceptance gate above.
- On full completion, hand branch to operator; mainline promotion is human-gated.
