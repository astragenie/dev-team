# Execution plan: stabilization + plugins-common adoption across 3 repos

Goal: fastest wall-clock, max isolation, max quality.
Repos: `dev-team` (crew), `runner-plugin` (loop/runner), `plugins-common` (shared libs).

## Principles (non-negotiable)

1. **Isolation boundary = npm registry, not git.** plugins-common ships published,
   provenance-signed versions; consumers pin exact versions. Never `file:` links,
   never workspace cross-links between repos. What CI sees = what consumers get.
2. **One worktree per track, one owner per track.** Each repo edited only from its own
   worktree/session (cross-repo rule). Within dev-team, parallel tracks = sibling
   worktrees on distinct branches. `crew fleet` before claiming files.
3. **Pin bumps and behavior changes never share a PR.** Version-bump PR = lockfile +
   package.json only, full CI. Adoption PR = code swap at pinned version.
4. **Adoption PRs are behavior-preserving.** Existing tests must pass unmodified;
   test deletions forbidden; new tests allowed. Reviewer instructed to reject any
   diff that alters behavior alongside the swap.
5. **Canary order: dev-team first, runner-plugin second.** dev-team has the richer
   suite; runner adopts a version already proven in dev-team.
6. **Every PR through repo's crew review gate + full CI.** No direct-to-main.
7. **Post-merge main CI is SUPPRESSED by auto-merge** (empirically confirmed 2026-07-10:
   merge commit e1660e59 got no push run — GITHUB_TOKEN suppression). After each merge
   batch per repo: `gh workflow run test.yml --ref main` + green before next batch
   merges on top. Release cuts already do this; waves must too.
8. **Review-before-merge is convention, not a required status check.** auto-merge.yml
   merges on checks alone. Wave rule: do NOT arm auto-merge at PR-open; arm it only
   AFTER the review artifact (decision line) lands. Alternative (better, W4 candidate):
   wire review as required status check in branch ruleset.
9. **W2 rollback pre-decision:** if a published plugin-std/memory-provider version
   breaks a consumer post-adoption, default = patch-and-republish (fix forward);
   revert-swap PR only if consumer main is blocked >half day. Never leave one consumer
   on a known-bad version while the other adopts.
10. **Cost bound:** track wave burn via `crew cost-watch`; per-wave soft ceiling 1
   iteration-equivalent (~$2400); breach → pause + report before next wave.

## Dependency graph

```
plugins-common publish hygiene (W0)
        │
        ▼
pin catch-up dev-team ─┐        pin catch-up runner ─┐   (W1, parallel)
        │              │                │            │
        ▼              │                ▼            │
plugin-std adoption dev-team (W2a) → plugin-std adoption runner (W2b)
        │
        ▼
MemoryProvider extraction → plugins-common (W3a)
        │
        ▼
dev-team consumes (W3b) → runner consumes (W3c)
```

Issue-fix tracks (dev-team #199/#202/#152 etc.) have NO dependency on adoption — run
fully parallel in own worktrees.

## EXECUTION STATUS (2026-07-10, user go)

- **ACTIVE:** dev-team + plugins-common tracks (W0-A/B/C, W1-A/C, W2a, W3a/W3b).
- **DEFERRED:** ALL runner-plugin tracks (W1-B, W2b, W3c) — another session runs
  tracker-provider waves there (churns `src/scripts/lib/**`, `loop.mts`). Resume after
  its program ends (later today). Confirmed zero writes from it into dev-team.
- **COORDINATION CONSTRAINTS (from runner session):**
  1. Do NOT touch dev-team `commands/architect-feature.md` — its FEAT-255 rewrites it
     (backlog tag-merge CLI); parallel edits = guaranteed conflict.
  2. Use plugins-common astramem-client seam (`resolveWireProvider`), never hand-roll
     resolution.
  3. Bun-on-Windows `file:`/`link:` deps hit EPERM — moot here (plan forbids file:
     links), but if a local smoke test needs linking: `mklink /J` junction, absolute target.

## Wave 0 — unblock + quick wins (parallel ×3, ~half day)

| Track | Repo/worktree | Work | Gate |
|---|---|---|---|
| W0-A | plugins-common wt | **First: patch release.yml** — tag switch only matches `gepa-core-v*`/`plugin-kernel-v*`/`astramem-client-v*`; add `plugin-std-v*` case (+ `memory-provider-v*` for W3a; drop dead `plugin-kernel-v*` — package doesn't exist). Then publish hygiene: gepa-core 0.10.0 dist (check #168 raw-.ts regression), astramem-client 0.2.0, plugin-std 0.5.0 (currently 404 on npm — never published); provenance + repository fields; verify `npm pack` contents per package | tag-triggered release.yml green; `npm view` shows dist |
| W0-B | dev-team wt-1 | Verify-and-close pass: retest #186 #153 #197 #198 #171 #162 against v0.58.0; close fixed with evidence comment; file follow-ups for partials; close #200 with explanation | issue comments w/ evidence; no code |
| W0-C | dev-team wt-2 | #202 hooks-under-gitignore fix + #152 apostrophe/backtick quoting bug — small isolated diffs | review + CI + close issues |

## Wave 1 — pins + idle guard (parallel ×3, ~half day, after W0-A)

| Track | Repo/worktree | Work | Gate |
|---|---|---|---|
| W1-A | dev-team wt-1 | Pin bump only: astramem-client →0.2.0, gepa-core →0.10.0; npm ci + bun install clean. (Framing: npm registry tops out at gepa-core 0.7.0 — dev-team pins the latest ever PUBLISHED; the "gap" is unpublished local work in plugins-common, so W0-A publish is the actual unblock, not consumer staleness) | full CI incl. npm ci gate (kills #168 class) + explicit peer-dep warning check: astramem-client 0.2.0 peers on astramem-plugin >=0.6.0, but dev-team pins astramem-plugin by git ref — npm can't semver-check git-ref peers, verify manually |
| W1-B | runner wt | Pin bump only: astramem-client →0.2.0 | runner CI |
| W1-C | dev-team wt-2 | #199: SubagentStop decision-line guard (extend check-subagent-return), fix.md watchdog step, idle-ping guidance | hook tests + review |

## Wave 2 — plugin-std adoption (sequenced canary, ~1–2 days)

- **W2-pre** (read-only investigator, parallel with W1): map duplication — dev-team
  `scripts/lib/` + runner `src/scripts/lib/` vs plugin-std modules
  (errors/frontmatter/git/http/jsonl/result). Output: swap-list table with file:line,
  API-gap list.
- **W2-fix** (plugins-common wt): close API gaps found by W2-pre; publish plugin-std
  0.6.0. Small, test-first.
- **W2a** (dev-team wt-1): swap helpers → plugin-std, one PR per helper family
  (frontmatter PR, jsonl PR, result PR…). Behavior-preserving rule applies.
- **W2b** (runner wt, starts when W2a first PR merges): same swap in runner.
  Can overlap W2a tail — different repo, zero contention.

## Wave 3 — MemoryProvider unification (the big one, ~2–3 days, sequential core)

- **W3-pre** (read-only, before any extraction): apply
  `dev-team/docs/research/2026-07-06-memory-bridge-reconciliation.md` — config-schema
  reconciliation is MANDATORY first: runner memory-bridge and dev-team MemoryProvider
  collide on the same `memory` key (`memory.enabled` auto|never vs `memory.provider`
  none|file|astramem; `recall.k` vs `recall.topK` → reconcile to `k`). Reconciled
  schema is a W3a input, not an afterthought.
- **W3a** (plugins-common wt): extract ONLY the generic provider/schema layer (~7 files:
  schema.ts, types.ts, resolve-provider.ts, astramem-provider.ts, file-provider.ts,
  noop-provider.ts, ranking.ts — verified free of dev-team CLI coupling) into new
  package `@astragenie/memory-provider`. Port WITH tests. NOT extracted:
  capture-learning.ts, inject-recall.ts, drift-check.ts — dev-team-specific
  orchestration (learnings.jsonl path, wakeup-brief format, dual-write reconcile);
  they stay local and call the shared primitives. Note: transport/discovery already
  unified via astramem-client `resolveWireProvider()` in BOTH repos (dev-team#172) —
  the remaining duplicated surface is config schema + provider selection + file
  fallback, so W3 is likely faster than the 2–3 day estimate.
  Publish 0.1.0 (needs release.yml case from W0-A). Closes prep for FEAT-188 S1b/S3b + FEAT-195.
- **W3b** (dev-team wt-1): consume package, delete local copies, thin adapter if
  import-shape differs. Full suite + astramem dual-write tests (#170 flake — fix or
  quarantine BEFORE this lands, else false reds).
- **W3c** (runner wt): replace `memory-sink.mts`/`memory-transport.mts` with package.
  Closes FEAT-195.
- Parallel lane during W3: dev-team wt-2 runs perf items (#175 affected-test resolver,
  #178 cost-report stub fix, #154 tsc cross-contamination) — no file overlap with
  memory work. HARD RULE for this window: wt-2 must NOT touch package.json/lockfiles
  while wt-1 is mid-W3b dependency swap (only real collision surface — .claude/state/
  is per-worktree, cost artifacts timestamp-named additive).

## Wave 4 — perf + cleanup (parallel, ongoing)

- dev-team: #167/#165 token-burn levers (checkpoint commits, mechanical-scripted,
  worktree-default), FEAT-190 bun-single-runtime, #164 pre-push-verifier worktree fix,
  #163 chore-branch lane.
- plugins-common: plugin-registry adopt-or-delete decision (ADR).
- runner: #392 git-anchored re-dispatch check (design change).
- Both: astramem scoped-recall adoption (#159) — unblocked by W1 pin bumps.

## Release cadence

- plugins-common: publish per-package tag as soon as each package is ready (W0-A, W2-fix, W3a).
- dev-team: cut minor release at end of each wave that ships consumer-visible change
  (W1→v0.59.0 pins+idle-guard, W2a→v0.60.0, W3b→v0.61.0). Registry bump each time.
- runner-plugin: same pattern, its own versioning, its own session cuts release.

## Max-speed summary

- 3 repos = 3 independent CI pipelines → up to 5 concurrent tracks (2 dev-team worktrees
  + 1 runner + 1 plugins-common + 1 read-only investigator).
- Only true sequence points: publish→pin (W0-A→W1), extract→consume (W3a→W3b→W3c).
- Everything else overlaps. Critical path ≈ W0-A → W1-A → W2a → W3a → W3b → W3c
  ≈ 4–6 working days; issue-fix + perf tracks amortized alongside.

## Quality checklist per PR (reviewer contract)

- [ ] Full repo CI green (no advisory-only skips on adoption PRs)
- [ ] Behavior-preserving: zero existing-test modifications on swap PRs
- [ ] Pin bump isolated from code change
- [ ] Issue number referenced (auto-close on merge)
- [ ] Review artifact written (crew gate), decision line present
- [ ] No cross-repo file edits in one PR
