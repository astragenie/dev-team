# TS Migration, Standards Conformance, and Top-10 Perf Wins — Design

**Status:** approved (sections 1–6) — awaiting spec-level user review
**Date:** 2026-06-07
**Author:** brainstorming session, hero-crew main branch @ `9f00524`
**Inputs:**

- `C:\work\mega\standards\docs\typescript\coding-conventions.md`
- `C:\work\mega\standards\docs\patterns\design-patterns.md`
- Repo state: 11.4k LoC `.mjs` under `scripts/`, 39 test files, `tsconfig.json` (allowJs, checkJs, non-strict), ESLint complexity ≤15 / function lines ≤120
- Recent pivot: FEAT-A..F (FE/BE split, OpenAPI canonical, integrator) — ~40 commits since v0.10

## Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Conformance target | **B. Gradual TS migration** | Repo already has `tsconfig.json`, `typescript` devdep; standards target TS-strict |
| 2 | Runtime/build strategy | **B. `node --experimental-strip-types`** | No build artifact; matches standards' ban on enums/namespaces/path-aliases; single tooling change |
| 3 | Sequencing of cleanup / migration / perf | **C. Migrate-first** | TS strict (`noUnusedLocals`, `noUnusedParameters`) surfaces dead code; cleanup falls out of compile errors |
| 4 | Migration order | **A. Leaf-up by dependency** | Lowest per-slice risk; entrypoint rename batched once at end; single coordinated marketplace/skill cutover |

Min Node version bumped to **22.6+** in Phase 0 (strip-types stable).

## Approach summary

Phased leaf-up TS migration with parallel perf track. Strict mode enabled per-file at rename time; compiler flags surface dead code in-place; deletion happens in the same slice. ESLint thresholds tighten in lockstep as modules pass through. Standards-conformance edits (Result<T,E>, SRP splits, no floating Promises) happen in each migration slice — not separately. Perf wins ship on a parallel branch with measured before/after.

### Alternates considered

- **Concern-banded domain-grouped migration.** Rejected: cross-domain shared utilities (`artifacts.mjs`, `workflow-state.mjs`) get touched repeatedly; type contracts evolve mid-band; tooling churn higher.
- **Vertical slice per feature.** Rejected: shared infra gets churned across slices; user-visible payoff comes at the cost of architectural coherence.

## Architecture — module boundaries

### Target layout

```
scripts/
├── *.ts                     (entrypoints; run via `node --experimental-strip-types`)
├── lib/
│   ├── briefing/*.ts
│   ├── cost-hygiene/*.ts
│   ├── installer/*.ts
│   ├── preflight/*.ts
│   ├── result.ts            (Result<T,E> + helpers — new shared module)
│   ├── ids.ts               (branded types — new shared module)
│   ├── schemas.ts           (Zod schemas for every JSON boundary — new shared module)
│   └── *.ts
hooks/*.ts                   (plugin-distributed hooks — `.mjs` here renames to `.ts`; `hooks.json` path refs updated)
.claude/hooks/*.sh           (repo-local crew hooks — Bash wrappers unchanged; any internal helpers stay `.sh`/`.mjs` as today)
tests/*.test.ts              (last to migrate)
```

### Boundary rules adopted from standards

- One concept per file (SRP). Files >300 lines split into siblings under a folder.
- No barrel files. Direct imports only.
- ISP via small interfaces: `ArtifactReader` + `ArtifactWriter` split from current monolithic `artifacts.mjs`.
- DIP at I/O edges: filesystem, clock, child_process injected as params on the few modules that compose them. Default factory returns real impls; tests inject fakes.

### Phase 0 foundation modules

1. `lib/result.ts` — `Result<T, E>` + `ok`, `err`, `map`, `flatMap` (per standards §Result).
2. `lib/ids.ts` — branded types: `RepoPath`, `SliceId`, `FeatId`, `ArtifactPath`, `CostReportPath`, `BadgeName`.
3. `lib/schemas.ts` — Zod schemas for: `workflow-state.json`, cost-report frontmatter, FEAT frontmatter, slice frontmatter, `marketplace.json`, `plugin.json`, handoff/review/validation/deployment artifact frontmatter.

Every subsequent leaf migration imports these three modules.

## Migration phases

### Phase 0 — foundation (1 slice, ~1 day)

- tsconfig strict toggle: `strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, useUnknownInCatchVariables: true`.
- Add `--experimental-strip-types` to every `node` invocation: `package.json` scripts, hooks, CI workflow, e2e-smoke.
- Update README + CLAUDE.md min-Node = 22.6+.
- Create `lib/result.ts`, `lib/ids.ts`, `lib/schemas.ts`.
- Add `npm run typecheck` to CI as blocking.
- Install `typescript-eslint` (or equivalent flat-config plugin) for ban-rules.
- No `.mjs` renamed yet. `tsconfig.json` `include` widened from `["scripts/**/*.mjs"]` to `["scripts/**/*.{ts,mjs}", "hooks/**/*.{ts,mjs}", "tests/**/*.{ts,mjs}"]`. `exclude` retains `["node_modules"]` only; drops `tests` and `.claude`.

### Phase 1 — leaf cleanup + migration (6–8 slices)

Per-slice protocol:

1. Rename `.mjs` → `.ts` for 2–4 sibling leaves.
2. Add `Result<T, E>` return types where errors are domain-meaningful.
3. Replace `JSON.parse` + manual checks with Zod schemas from `lib/schemas.ts`.
4. Tighten ESLint per-file overrides: `complexity: 10, max-lines-per-function: 30`.
5. Split any function >30 lines or file >300 lines per SRP.
6. Delete dead code surfaced by `noUnusedLocals` / `noUnusedParameters`.
7. Run gates: `tsc --noEmit`, `node --test`, `npm run lint`, e2e-smoke, validators.

Slice candidates:

| # | Slice | Modules (≤4 files) |
|---|---|---|
| 1.1 | scope + classify leaves | `scope-estimate`, `ux-validation/classify-scenario`, `ux-validation/discover-playwright` |
| 1.2 | preflight + subagent leaves | `preflight/checks`, `subagent-return/check` |
| 1.3 | cost-hygiene leaves | `cost-hygiene/state`, `cost-hygiene/decide`, `cost-hygiene/render-frontmatter` |
| 1.4 | cost-hygiene aggregator + scanner | `cost-hygiene/emit-cost-report`, `cost-hygiene/cost-slice-handler`, `session-cost-scanner` |
| 1.5 | briefing leaves | `briefing/collect-cost-parser`, `briefing/render` |
| 1.6 | briefing collector | `briefing/collect`, `briefing.mjs` |
| 1.7 | installer leaves | `installer/util`, `installer/gitignore`, `installer/templates`, `installer/welcome` |
| 1.8 | installer core | `installer/audit`, `installer/claude-md`, `installer/harness-files`, `installer/legacy-migration`, `installer/repo-guides`, `installer/settings`, `installer/global`, `installer.mjs` |

### Phase 2 — intermediate modules (3–4 slices)

| # | Slice | Modules |
|---|---|---|
| 2.1 | core state | `workflow-state`, `claims`, `approvals` |
| 2.2 | artifacts + linkage | `artifacts`, `outcome-linkage`, `deployment-guidance` |
| 2.3 | cost-advisor stack | `cost-advisor`, `cost-advisor-grades`, `cost-advisor-rules`, `session-cost` |
| 2.4 | fleet | `fleet` |

### Phase 3 — entrypoints + hooks (1–2 slices, coordinated cutover)

| # | Slice | Files |
|---|---|---|
| 3.1 | entrypoint cutover | `scripts/crew.mjs` + 9 sibling entrypoints → `.ts`; update all skill `.md` references; update marketplace.json; update agent prompts referencing scripts |
| 3.2 | hooks | `hooks/*.mjs` (plugin-distributed) renamed to `.ts`; `hooks/hooks.json` path refs updated to `.ts`; `.claude/hooks/*.sh` (repo-local) untouched |

### Phase 4 — tests (1–2 slices)

| # | Slice | Files |
|---|---|---|
| 4.1 | tests batch 1 | 20 test files |
| 4.2 | tests batch 2 | 19 test files |

### Phase 5 — eslint ratchet (1 slice)

Remove per-file overrides. Set repo-wide `complexity: 10, max-lines-per-function: 30, max-lines: 300`. Any remaining violations fixed in this slice or explicitly waived with rationale comment.

### Total

~15–18 slices. At 1–2 slices/day → 3–4 weeks single-track wallclock.

## Standards conformance edits

Applied per-file at migration time inside each leaf slice.

### Type-system edits

- No `any`. `JSDoc @param {*}` becomes `unknown` + Zod narrowing, or a real type.
- No `as X` without runtime validation. Replace cast-only flow with Zod `safeParse → ok/err`.
- `unknown` in catch (`useUnknownInCatchVariables: true`).
- Branded types for ids via `lib/ids.ts`.
- Discriminated unions for state — workflow gate state currently mixed `null | object`; convert to `{ status: 'pending' | 'passed' | 'failed' | 'skipped'; ... }` tagged unions.
- `Result<T, E>` for domain operations: artifact write, claim, approval resolve, badge set, manifest validation. Infrastructure errors (fs ENOENT, JSON parse on corrupt state file) still throw → caught at CLI entrypoint and mapped to exit codes.

### Size + complexity budgets

| Budget | Standard | Current ESLint | Target post-Phase-5 |
|---|---|---|---|
| File lines | ≤300 | none enforced | 300 (lint) |
| Function lines | ≤30 | 120 (warn) | 30 (warn) |
| Function params | ≤4 (else options object) | none | 4 (warn) |
| Cyclomatic complexity | ≤10 | 15 (warn) | 10 (warn) |
| Nested ternaries | 0 | none | 0 (error) |

### Module structure edits

- No barrel files — repo already complies; ban via ESLint `no-restricted-imports`.
- One concept per file. Known splits:
  - `crew.mjs` (787 LoC) → split by command surface: `cli/brief-me.ts`, `cli/wake-up.ts`, `cli/write-*.ts`, `cli/mark-badge.ts`. Dispatch table stays in `crew.ts`.
  - `artifacts.mjs` → `artifacts/read.ts` + `artifacts/write.ts` (ISP).
  - `workflow-state.mjs` → read vs mutate split.
- Named imports + named exports — enforce.
- No floating Promises — add `@typescript-eslint/no-floating-promises`.

### Pattern edits

- SRP via stakeholder boundaries (not technical layers).
- ISP: `ArtifactReader` / `ArtifactWriter`, `WorkflowStateReader` / `WorkflowStateWriter`.
- DIP at I/O edges: inject `fs`, clock (`now: () => Date`), `spawnSync` into `briefing/collect.ts`, `cost-advisor.ts`, `session-cost-scanner.ts`. Default factory returns real impls; tests inject fakes.
- Strategy as function pointer — no class wrappers for switch-on-string (cost-advisor rule dispatch, classify-scenario verb routing, marketplace plugin registry).
- Composition over inheritance — repo has no inheritance today; verify.

### Banned anti-patterns (enforced)

| Banned | Enforcement |
|---|---|
| `any` | `@typescript-eslint/no-explicit-any: error` |
| `// @ts-ignore` / `@ts-expect-error` without rationale | `@typescript-eslint/ban-ts-comment` |
| Default exports from utility modules | `import/no-default-export` on `scripts/lib/**` |
| Boolean state flags for status | review-time catch + grep audit pre-Phase-5 |
| `enum` / `namespace` | strip-types runtime ban + `@typescript-eslint/no-namespace` |
| `JSON.parse` without try/catch + schema | grep audit + Zod migration during slices |

### Boundary validation policy

Every JSON read from disk validates via Zod schema in `lib/schemas.ts`. After parse, the typed object flows inward; no re-validation. Matches standards §Runtime validation with Zod.

## Top-10 perf wins (parallel track)

Each scored: Win (rough latency saving), Effort (S/M/L), Risk (L/M/H). Ranked by Win/Effort.

| # | Win | Effort | Risk | Estimated saving | Where |
|---|---|---|---|---|---|
| 1 | Tail-read `events.jsonl` — reverse-read last 64KB instead of full 860KB | S | L | 200–400ms cold, 50–100ms warm | `lib/briefing/collect.mjs`, `lib/session-cost-scanner.mjs` |
| 2 | Parallelize artifact reads (`runBrief` + handoffs + review + validation + deployment + synthesis) via `Promise.all` | S | L | 100–300ms per brief-me | `lib/briefing/collect.mjs` |
| 3 | Mtime-filter Claude session JSONLs — skip files older than slice window | S | L | 300–800ms on cost-aggregate | `lib/session-cost-scanner.mjs` |
| 4 | Memoize hot frontmatter reads keyed by `(path, mtime.getTime())` | S | L | 50–150ms | new `lib/artifact-cache.ts` |
| 5 | Combine git spawns — `git fetch`, `status`, `log`, `for-each-ref` via async `Promise.all` not sequential `spawnSync` | M | M | 200–300ms | `lib/briefing/collect.mjs`, fleet |
| 6 | Convert remaining sync FS to async + parallelize (23 occurrences) | M | M | 150–400ms compound | repo-wide |
| 7 | Early-exit JSONL parse on tail-only queries — `tail(file, n, predicate)` helper | M | L | 100–250ms | `lib/session-cost-scanner.mjs` |
| 8 | Lazy autonomousLoop section — `--include-loop=auto\|on\|off`; skip computation when not rendered | M | L | 200–500ms on no-loop calls | `lib/briefing.mjs`, `crew.mjs` |
| 9 | Single readdir for payloads index — cache 2782-file list per process with mtime invalidation | S | M | 80–150ms per cost call | `lib/session-cost-scanner.mjs` |
| 10 | Skip stat-before-read — replace `if (existsSync) readFileSync` with `try/catch ENOENT` | S | L | 30–80ms compound | repo-wide |

### Targets (after all 10)

- brief-me cold: 3–5s → 1.5–2s
- brief-me warm: 2–3s → 0.5–1s
- cost-aggregate brief-me: 5–8s → 2–3s

### Measurement protocol (every PR)

1. Capture 5 baseline runs of `time node ./scripts/crew.mjs brief-me --repo "$PWD"`.
2. Apply change.
3. Capture 5 runs after.
4. Report median + p95 delta in PR body.
5. Reject PR if regression on p95 of any other CLI command (`wake-up`, `slice start`, `slice complete`).

### Sequencing vs TS migration

- Wins 1, 2, 4, 9, 10 are mechanical → ship anytime, no module surgery → week 1 payoff.
- Wins 3, 5, 6, 7, 8 touch architecture → land after the relevant leaf migrates to TS:
  - 3 + 7 + 9 wait for slice 1.3 / 1.4 (cost-hygiene leaves done).
  - 5 + 6 wait for slice 2.1 / 2.2 (state + artifacts in TS).
  - 8 waits for slice 1.5 / 1.6.

## Testing strategy & gates

### Per-slice gates (hard, blocking)

| Gate | Command | When |
|---|---|---|
| Typecheck | `tsc --noEmit` strict | every slice |
| Unit tests | `node --test --experimental-strip-types` | every slice |
| Lint zero-warning | `npm run lint` | every slice |
| e2e-smoke | `node ./scripts/e2e-smoke.mjs` | every slice touching CLI paths |
| Manifest validators | `validate-manifests`, `validate-skills`, `validate-agents`, `validate-slices`, `validate-syntheses` | every slice |

### New test types added during migration

1. Zod schema tests — every schema in `lib/schemas.ts` gets `*.schema.test.ts`:
   - happy path → ok
   - missing required field → typed `parse.error.issues`
   - extra unknown field → strict mode rejects
   - fixture-driven: every real artifact under `.claude/artifacts/crew/**` round-trips through schema
2. `Result<T, E>` contract tests — both ok and err branches covered.
3. Boundary tests — `lib/artifacts.ts`, `lib/workflow-state.ts` each test the disk-IO seam with injected fake `fs`.
4. Property-based parser tests — `briefing/collect-cost-parser.ts` round-trips any valid `CostReportFrontmatterSchema` via fast-check.
5. Snapshot fixture rebuild for `briefing/render.ts` markdown output.

### Test file migration

- Tests migrate after their module migrates. Cross-ext fine — strip-types accepts both.
- `.test.mjs` → `.test.ts`, imports updated. No content changes unless module API changed.
- Test fixtures stay `.mjs` / `.json` / `.md` (data, not source).

### Coverage policy

No threshold during migration. After Phase 5 complete, optional coverage gate (line ≥80%, branch ≥70%) considered separately.

### Perf-track tests

Each win ships with: functional fixture test, perf assertion in CI (loose regression guard), e2e-smoke pass.

### Proposed new gate

`validate-typegraph` — `tsc --noEmit` across only `scripts/lib/**` catches leaf-level type drift before entrypoints migrate.

## Cadence & governance

- 1 slice/day target; up to 2 if leaf ≤200 LoC touched.
- Pause point after every phase.
- Total horizon: 3–4 weeks single-track wallclock. Perf wins parallel.
- Each slice = one FEAT under `docs/backlog/`. Numbered FEAT-100..FEAT-117 (or next free range).
- Each slice routes through `/crew:orchestrate-slice` for full ladder.
- Reviewer gate mandatory — no `review_skipped` on TS migration slices.
- ADRs recorded in `docs/decisions/` for: strip-types choice, leaf-up order, eslint ratchet timing, branded-id naming, schema location.
- Cost cap: `$80/slice` max. Sonnet share ≥70% adjacent initiative (not blocking but called out).

### Memory + artifact discipline

- Slice 0 writes `docs/architecture/ts-migration-baseline.md` — LOC, ESLint warning count, brief-me p50/p95, cost-aggregate p50/p95.
- Each slice updates the baseline doc with new numbers.
- Each phase end writes `docs/retrospectives/YYYY-MM-DD-phase-N.md`.

## Exit criteria

- Every `.mjs` under `scripts/`, `hooks/`, `tests/` renamed to `.ts` (except shell wrappers and fixtures).
- `tsconfig.json` `strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true` repo-wide, no per-file relaxations.
- ESLint repo-wide `complexity: 10, max-lines-per-function: 30, max-lines: 300` with zero warnings.
- Zero `any`, zero `as` without preceding Zod validation, zero `// @ts-ignore` without rationale comment.
- All 10 perf wins shipped + measured. brief-me p95 ≤2s warm, ≤3s cold on a representative dev machine (Windows 11, NVMe SSD, 32 GB RAM, Node 22).
- Standards-doc reference added to `CLAUDE.md`; `docs/standards/code-conventions.md` reconciled or replaced.
- Marketplace bumped to `v0.17.0` minimum (likely v0.18+); `CHANGELOG.md` records migration.

## Stop conditions (plan halts; user decides)

- 3 consecutive slices with reviewer rejections → root-cause halt.
- Any slice's e2e-smoke fails on `main` after merge → revert + halt.
- Strip-types compatibility surprise (Node version, syntax) → halt, evaluate fallback to `tsx`.
- Plugin install fails on a fresh clone after Phase 3.1 → revert + halt.

## Out of scope (explicit)

- React/frontend portions of standards: N/A.
- `docs/standards/code-conventions.md` rewrite — separate FEAT, parallel.
- Astragenie.Standards reorganization — upstream; not touched here.
- Companion `loop` plugin — different repo.
- Sonnet-routing cost discipline — adjacent initiative, called out, not bundled.
- Coverage gates — not added during migration.
- New features in `scripts/` or `agents/` — frozen during migration unless user explicitly unfreezes.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Strip-types rejects valid TS syntax in some module | M | M | Phase 0 dry-run; fallback to `tsx` loader documented |
| `--experimental-strip-types` removed or changed in Node | L | H | Pin Node 22.6+ as min; ADR records fallback to compile-to-`dist/` |
| Entrypoint cutover breaks plugin for existing installs | L | H | Phase 3.1 in worktree; staging install on sample repo; rollback ready |
| Reviewer load too high under tight cadence | M | M | Slice budget hard cap (≤4 files); pause points enforced |
| Cost overrun (~$80/slice avg today, plan = ~17 slices) | M | M | Sonnet-routing adjacent initiative; reviewer flags |
| Type drift in shared modules cascades errors | M | M | `validate-typegraph` gate runs on every slice |
| Zod schema mismatch with real artifacts | M | L | Fixture-driven schema tests against `.claude/artifacts/crew/**` real data |
