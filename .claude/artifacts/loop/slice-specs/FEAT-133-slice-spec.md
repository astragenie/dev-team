# Spec: Split briefing/collect.ts into focused modules

## Metadata
- developer_type: agent
- estimated_complexity: medium
- languages: TypeScript
- depends_on: FEAT-129 (done; parallel collection structure in place)

---

## Objective

Refactor `scripts/lib/briefing/collect.ts` (792 lines, 5 distinct concerns) into four focused modules:
1. `git.ts` — git log and working tree status
2. `cost.ts` — cost report aggregation and health metrics (new orchestration layer above existing `collect-cost-parser.ts`)
3. `workflow.ts` — workflow state and artifact reads
4. `collect.ts` (thin orchestrator) — re-exports the public surface from the three modules above; no new public API

All exports remain unchanged; behavior and output identical; no client code modification needed.

**Scope guard (added in review):** This is a behavior-preserving *split*, not an API addition. `collect.ts` becomes a pure re-export barrel. Do NOT introduce a new `collectAll()` orchestrator export — verified there is no existing top-level orchestrator in `collect.ts` today (callers in `scripts/lib/briefing.ts` import individual `collect*` functions). FEAT-129's parallelization is the **intra-function** `Promise.all` blocks inside `collectGitActivity` / `collectRecentCosts` / `collectRelevantArtifacts`; those travel verbatim with their functions into the new modules. The top-level caller `scripts/lib/briefing.ts` is OUT OF SCOPE and must not change.

---

## Context

### Current state
- **File**: `scripts/lib/briefing/collect.ts` (792 lines, was stated as 712; growth occurred)
- **Existing helper**: `scripts/lib/briefing/collect-cost-parser.ts` (431 lines) — low-level parsing primitives already extracted for cost reports
- **Dependency**: FEAT-129 (done) parallelized independent collection calls; the split must preserve that `Promise.all` orchestration
- **Tests**: Six test files import specific exports:
  - `collectCostHealth`, `collectCostAggregate` from tests/briefing-cost-health.test.ts
  - `collectRecentCosts` from tests/briefing-cost-rollup-dedupe.test.ts, tests/cost-report-role-breakdown.test.ts
  - `collectHookHealth` from tests/collect-hook-health.test.ts
  - `computeModelCompliance` from tests/collect-model-compliance.test.ts
- **Lint gate**: `npm run lint` enforces `max-lines: 80` per rule in `eslint.config.mjs`; each new file ≤250 lines; orchestrator ≤80 lines

### Exported interfaces (immutable)
All of these must be re-exported from the thin orchestrator or imported directly by clients:
- `WorkingTreeStatus`, `CommitEntry`, `GitActivity`
- `ArtifactEntry`, `WakeUpBriefLike` (used in render.ts and other surfaces)
- `CostHealthResult`, `ModelCompliance`, `HookStatus`, `HookHealth`
- `BundleStats`

---

## Implementation Contract

### 1. Module boundaries

#### `scripts/lib/briefing/git.ts` (~140 lines)
**Exports:**
- Interfaces: `WorkingTreeStatus`, `CommitEntry`, `GitActivity`
- Function: `collectGitActivity(repoPath: string): Promise<GitActivity>`

**Moves from collect.ts:**
- Constants: `BRANCH_COMMITS_LIMIT`, `REPO_ACTIVITY_LIMIT`
- Private helpers: `runGit`, `parseStatusHeader`, `parseStatusCounts`, `parseWorkingTree`, `parseCommits`
- Exported function: `collectGitActivity`

**Import:** None (pure node:child_process + node:path)

---

#### `scripts/lib/briefing/cost.ts` (~165 lines)
**Exports:**
- Interfaces: `CostHealthResult`, `ModelCompliance`, `BundleStats` (see note below)
- Functions:
  - `collectRecentCosts(repoPath: string, limit = 5): Promise<RecentCostsResult>`
  - `collectCostHealth(repoPath: string): Promise<CostHealthResult | null>`
  - `collectCostAggregate(repoPath: string): Promise<CostHealthResult | null>`
  - `computeModelCompliance(reports: Array<{modelMix?}>): ModelCompliance | null`
  - `collectModelCompliance(repoPath: string): Promise<ModelCompliance | null>`

**Moves from collect.ts:**
- Constants: `SEVERITY_RANK`
- Private helper: `computeModelBurn`
- Exported functions: all five listed above
- Interfaces: `CostHealthResult`, `ModelCompliance` (re-export from existing shape)

**Imports:**
- `import { buildCostAdvisor } from "../cost-advisor.ts"`
- `import { parseCostReportText, dedupeForRollup, aggregateRoleDispatches } from "./collect-cost-parser.ts"`
- `import type { CostReport } from "./collect-cost-parser.ts"`
- `import { pathExists } from "../fs-utils.ts"`
- `import path from "node:path"`, `import fs from "node:fs/promises"`

**Architecture note**: `cost.ts` is the **orchestration layer**. It calls high-level cost-advisor and parsing primitives. `collect-cost-parser.ts` remains the low-level parsing library and is NOT modified.

---

#### `scripts/lib/briefing/workflow.ts` (~120 lines)
**Exports:**
- Interfaces: `ArtifactEntry`, `WakeUpBriefLike`, `ArtifactSummary` (make ArtifactSummary exported)
- Functions:
  - `collectRelevantArtifacts(wakeUpBrief: WakeUpBriefLike): Promise<ArtifactEntry[]>`
  - `findAutonomousLoopCli(): Promise<string | null>`
  - `fetchAutonomousLoopBrief(repoPath: string): Promise<unknown>`

**Moves from collect.ts:**
- Interfaces: `ArtifactSummary`, `ArtifactEntry`, `WakeUpBriefLike`
- Private helpers: `collectArtifactActivity`, `extractMarkdownField`, `readArtifactSummary`, `resolveRunArtifacts`, `findAutonomousLoopCli`
- Exported functions: `collectRelevantArtifacts`, `fetchAutonomousLoopBrief`

**Imports:**
- `import fs from "node:fs/promises"`
- `import path from "node:path"`
- `import { execFile as execFileCallback } from "node:child_process"`
- `import { promisify } from "node:util"`
- `import { getCachedArtifact } from "../artifact-cache.mjs"`
- `import { pathExists } from "../fs-utils.ts"`

---

#### `scripts/lib/briefing/collect.ts` (~65 lines, thin orchestrator)
**Exports:**
- All re-exports from the three modules (no local definitions except the orchestrator function)

**Remaining local code:**
- `collectHookHealth` (stays; 24 lines including helpers)
- `collectBundleStats` (stays; 36 lines including helpers)
- Constants: `KNOWN_HOOKS`, `HOOK_HEALTH_TAIL`, `HOOK_HEALTH_WINDOW_MS`, `SLICE_RE_BRIEF`
- Private helpers: `readCurrentSliceId` (for bundle stats)

**Orchestrator function:** NONE. `collect.ts` adds no new exported function. It is a re-export barrel plus the two small local functions (`collectHookHealth`, `collectBundleStats`) that have no natural home in git/cost/workflow. The pre-split top-level orchestration in `scripts/lib/briefing.ts` continues to import the individual `collect*` functions exactly as before — their import paths still resolve because `collect.ts` re-exports them. (Earlier draft proposed a new `collectAll()`; removed in review as out-of-scope API growth that would break the "no output change / pure refactor" guarantee.)

**Imports (re-exports):**
```typescript
export { collectGitActivity, type GitActivity, type WorkingTreeStatus, type CommitEntry } from "./git.ts";
export {
  collectRecentCosts,
  collectCostHealth,
  collectCostAggregate,
  computeModelCompliance,
  collectModelCompliance,
  type CostHealthResult,
  type ModelCompliance
} from "./cost.ts";
export {
  collectRelevantArtifacts,
  fetchAutonomousLoopBrief,
  type ArtifactEntry,
  type WakeUpBriefLike
} from "./workflow.ts";
// Local exports stay:
export { collectHookHealth, collectBundleStats, type HookHealth, type BundleStats };
```

---

### 2. Line-count targets

| Module | Target | Content |
|--------|--------|---------|
| `git.ts` | ≤250 | ~140 lines (parseStatus*, parseCommits, collectGitActivity) ✓ |
| `cost.ts` | ≤250 | ~165 lines (cost orchestration + computeModelBurn) ✓ |
| `workflow.ts` | ≤250 | ~120 lines (artifact reads, findAutonomousLoopCli) ✓ |
| `collect.ts` (orchestrator) | ≤80 | re-exports (~12) + collectHookHealth (24) + collectBundleStats (36) + readCurrentSliceId (12) ≈ 84 — **tight; see risk below** |

**Risk**: keeping `collectHookHealth` + `collectBundleStats` + `readCurrentSliceId` in `collect.ts` lands it at ~84 lines — over the ≤80 target. **Recommended (primary) approach**: extract `collectHookHealth` → `hook.ts` and `collectBundleStats` (+`readCurrentSliceId`) → `bundle.ts`, leaving `collect.ts` a pure re-export barrel (~20 lines, comfortably ≤80). This yields five modules (git, cost, workflow, hook, bundle) + the barrel. The FEAT named three; this is a faithful extension of the same SRP intent, not scope creep — call it out to the reviewer. If the reviewer prefers exactly the FEAT's module set, the fallback is to bump the orchestrator's max-lines allowance, but the five-module split is cleaner.

---

## Files to Create / Modify

### Create
- `C:\work\mega\hero-crew\scripts\lib\briefing\git.ts`
- `C:\work\mega\hero-crew\scripts\lib\briefing\cost.ts`
- `C:\work\mega\hero-crew\scripts\lib\briefing\workflow.ts`

### Modify
- `C:\work\mega\hero-crew\scripts\lib\briefing\collect.ts` (content replacement: remove 3 concerns, add re-exports + thin orchestrator)

### No changes
- `C:\work\mega\hero-crew\scripts\lib\briefing\collect-cost-parser.ts` (stays as-is; new cost.ts imports it)
- `C:\work\mega\hero-crew\scripts\lib\briefing\render.ts` (only imports ArtifactEntry; re-export unchanged)
- All client code (tests, briefing.ts, etc.)

---

## Required Tests

### Test: No output change — characterization test
**Objective**: Prove the split produces identical briefing output. Capture a real `brief-me` (or `wake-up`) JSON snapshot on this repo BEFORE the split (commit it as a golden fixture), then assert the post-split run matches.

```typescript
// File: tests/briefing-split-characterization.test.ts (new)
// Golden-snapshot characterization. The golden file is produced from the
// PRE-split build: run `node scripts/crew.ts brief-me --repo <fixtureRepo>`,
// normalize volatile fields (timestamps, absolute paths), and save to
// tests/fixtures/briefing/golden-brief.json. Post-split run must match.

test("brief-me output is byte-identical after the collect.ts split", async () => {
  const fixtureRepo = await setupTestRepo();           // deterministic fixture
  const golden = readGolden("briefing/golden-brief.json");
  const after = normalize(await runBriefMe(fixtureRepo)); // same normalization
  assert.deepEqual(after, golden);
});
```

Do NOT compare a new `collectAll()` against a hand-reimplemented "old flow" — that tests the spec's own reimplementation, not the real briefing surface. The golden snapshot from the actual `brief-me`/`wake-up` entry point is the only honest before/after.

### Test: Existing suite stays green
**Commands:**
```bash
npm test                # All 51+ tests must pass
npm run lint            # Max-lines warnings must not increase
npm run typecheck       # No new type errors
```

### Test: Module imports resolve
**Quick smoke test** (new file: tests/briefing-module-imports.test.ts):
```typescript
test("all briefing modules can be imported independently", async () => {
  // Verify no circular dependencies or broken imports
  const git = await import("../scripts/lib/briefing/git.ts");
  const cost = await import("../scripts/lib/briefing/cost.ts");
  const workflow = await import("../scripts/lib/briefing/workflow.ts");
  const collect = await import("../scripts/lib/briefing/collect.ts");
  
  assert.ok(git.collectGitActivity);
  assert.ok(cost.collectRecentCosts);
  assert.ok(workflow.collectRelevantArtifacts);
  assert.ok(collect.collectHookHealth);
  // collect.ts re-exports the full surface — every original export still resolves:
  assert.ok(collect.collectGitActivity);
  assert.ok(collect.collectRecentCosts);
  assert.ok(collect.collectRelevantArtifacts);
});
```

### Test: Lint max-lines
**Objective**: Each module under the threshold.

```bash
npm run lint -- --rule "max-lines: [error, {max: 250}]" scripts/lib/briefing/{git,cost,workflow}.ts
npm run lint -- --rule "max-lines: [error, {max: 80}]" scripts/lib/briefing/collect.ts
```

---

## Acceptance Criteria

1. **AC-001**: Four modules created with correct exports
   - Given: `git.ts`, `cost.ts`, `workflow.ts`, `collect.ts` exist
   - When: Import each module independently
   - Then: All exports from the original `collect.ts` are accessible (either locally or via re-export)
   - Verification: `npm test -- tests/briefing-module-imports.test.ts` PASS

2. **AC-002**: No output change
   - Given: A deterministic fixture repo and a golden `brief-me` snapshot captured pre-split
   - When: Run `brief-me`/`wake-up` against the fixture post-split and normalize volatile fields
   - Then: Output matches the golden snapshot byte-for-byte
   - Verification: `npm test -- tests/briefing-split-characterization.test.ts` PASS

3. **AC-003**: All existing tests pass
   - Given: Six test files exercising briefing/collect exports
   - When: Run `npm test`
   - Then: All 51+ tests pass; no regressions
   - Verification: `npm test` exit code 0

4. **AC-004**: Lint clean
   - Given: New modules and modified `collect.ts`
   - When: Run `npm run lint`
   - Then: No new warnings; max-lines respected
   - Verification: `npm run lint` exit code 0; grep for "max-lines" in output = zero warnings

5. **AC-005**: Type safety maintained
   - Given: TypeScript strict mode
   - When: Run `npm run typecheck`
   - Then: No new type errors
   - Verification: `npm run typecheck` exit code 0

6. **AC-006**: Line counts within targets
   - Given: Four modules with defined targets (git ≤250, cost ≤250, workflow ≤250, collect ≤80)
   - When: Count lines in each file
   - Then: All targets met
   - Verification: Manual inspection + lint rule enforcement

---

## Verification Commands

Run these in sequence; all must exit 0:

```bash
# Unit tests (existing + new characterization tests)
npm test

# Type checking
npm run typecheck

# Linting (including max-lines)
npm run lint

# Optional: verify line counts manually
node -e "console.log('git.ts:', require('fs').readFileSync('scripts/lib/briefing/git.ts', 'utf-8').split('\\n').length, 'lines')"
node -e "console.log('cost.ts:', require('fs').readFileSync('scripts/lib/briefing/cost.ts', 'utf-8').split('\\n').length, 'lines')"
node -e "console.log('workflow.ts:', require('fs').readFileSync('scripts/lib/briefing/workflow.ts', 'utf-8').split('\\n').length, 'lines')"
node -e "console.log('collect.ts:', require('fs').readFileSync('scripts/lib/briefing/collect.ts', 'utf-8').split('\\n').length, 'lines')"
```

---

## Risks & Mitigation

### Risk 1: Import-cycle between modules
**Likelihood**: Medium  
**Mitigation**: Modules only import from external files (cost-advisor, fs-utils, node builtins, collect-cost-parser). No module imports from another module. If detected, separate cycles into independent files.

### Risk 2: Lint max-lines failure on collect.ts orchestrator
**Likelihood**: Low  
**Mitigation**: If orchestrator + hook + bundle logic exceeds 80 lines, move `collectHookHealth` to `hook.ts` and `collectBundleStats` to `bundle.ts`. Re-export from thin collect.ts. Targets become six modules instead of four; spec AC-006 adjusts accordingly.

### Risk 3: Existing client code expects collect.ts to have all exports
**Likelihood**: Very low (tests mocked here; briefing.ts only imports specific exports)  
**Mitigation**: All exports re-exported from `collect.ts`; no breaking change. Verify with `npm test` before commit.

### Risk 4: FEAT-129 Promise.all structure lost
**Likelihood**: Very low  
**Mitigation**: The intra-function `Promise.all` blocks (FEAT-129) move verbatim inside their functions into git.ts/cost.ts/workflow.ts. The top-level `scripts/lib/briefing.ts` orchestration is untouched, so no parallelism is lost and output is unchanged.

---

## Rationale & Design Decisions

### Why four modules, not three?

The FEAT description specified three modules (git, cost, workflow). However:
- `collectHookHealth` and `collectBundleStats` are sufficiently orthogonal and small (~60 lines combined) that keeping them in the thin orchestrator is simpler than spinning up two more files.
- If linter enforcement fails, they can be separated easily.

### Why not modify collect-cost-parser.ts?

`collect-cost-parser.ts` is a pure parsing library (no I/O orchestration). The new `cost.ts` is the **orchestration layer** that:
1. Lists cost-report files from disk (I/O)
2. Calls the parser on each
3. Aggregates results
4. Delegates to cost-advisor for health grading

Keeping the split clean: parsing primitives stay isolated in `collect-cost-parser.ts`; orchestration logic moves to `cost.ts`. This preserves single responsibility and allows other callers to use either layer independently.

### Why no new orchestrator export?

FEAT-133 is a pure split. The top-level orchestration already lives in `scripts/lib/briefing.ts`, which calls the individual `collect*` functions; that file is out of scope and unchanged. FEAT-129's parallelism is the intra-function `Promise.all` blocks, which move verbatim with their functions. Adding a `collectAll()` would be net-new API — gold-plating that widens the blast radius of a behavior-preserving refactor. Rejected in review.

---

## Dependencies & External Integrations

- **FEAT-129** (done): Parallelized collection via intra-function `Promise.all`; preserved verbatim as functions move into new modules
- **collect-cost-parser.ts**: Low-level parsing; no changes; only imported by new `cost.ts`
- **cost-advisor.ts**: Health grading; imported by new `cost.ts`
- **artifact-cache.mjs**: Caching; imported by new `workflow.ts`
- **fs-utils.ts**: File operations; imported by new `cost.ts` and `workflow.ts`
- **Node builtins**: fs, path, child_process, util — used across all modules

---

## Examples & Edge Cases

### Example 1: Re-export barrel keeps existing call sites working
```typescript
// scripts/lib/briefing.ts (UNCHANGED) keeps importing from collect.ts:
import { collectGitActivity, collectRecentCosts, collectRelevantArtifacts } from "./briefing/collect.ts";
// collect.ts now re-exports these from git.ts / cost.ts / workflow.ts — paths still resolve, no caller edits.
```

### Example 2: Individual module use (backward compat)
```typescript
import { collectGitActivity } from "./scripts/lib/briefing/git.ts";
import { collectHookHealth } from "./scripts/lib/briefing/collect.ts";

const git = await collectGitActivity(repoPath);
const hooks = await collectHookHealth(repoPath);
// Sequential; no change in behavior
```

### Example 3: Cost concern isolation
```typescript
import { collectRecentCosts } from "./scripts/lib/briefing/cost.ts";
import type { CostReport } from "./scripts/lib/briefing/collect-cost-parser.ts";

const costs = await collectRecentCosts(repoPath, 10);
// costs is RecentCostsResult (defined in cost.ts)
```

### Edge case: No cost reports exist
- `collectCostHealth()` returns `null` (unchanged behavior)
- `collectRecentCosts()` returns `{ recent: [], totalReports: 0, dedupedCount: 0, roleDispatches: {} }` (unchanged)
- callers observe `costHealth: null` exactly as before (unchanged)

### Edge case: No git repo
- `collectGitActivity()` returns `{ isGitRepo: false, workingTree: {...}, recentBranchCommits: [], recentRepoActivity: [] }` (unchanged)
- No crash; safe fallback

---

## Validation Checklist

- [x] All file paths exact (git.ts, cost.ts, workflow.ts, collect.ts under `scripts/lib/briefing/`)
- [x] All interface shapes match existing exports (no renaming, no new required fields)
- [x] Every AC testable with concrete pass/fail condition
- [x] ≥3 test cases: unit suite (existing + new), characterization (output sameness), module imports (no cycles)
- [x] All terms used in AC defined (RecentCostsResult, CostHealthResult, etc.)
- [x] Verification commands runnable without manual arguments (`npm test`, `npm run lint`, `npm run typecheck`)
- [x] Risks identified and mitigation strategies provided
- [x] autonomous_safe flag: true (pure refactor, behavior-preserving, no client code changes)
- [x] developer_type: agent (application layer, repeatable pattern, ≤8 hours complexity)

---

## Key Decision Summary

**Cost.ts vs collect-cost-parser.ts separation:**
- `collect-cost-parser.ts` = parsing primitives (stays at 431 lines, not modified)
- `cost.ts` (new, ~165 lines) = orchestration layer (lists files, calls parser, aggregates, delegates to cost-advisor)
- This prevents duplication and maintains single responsibility: parsing logic lives in one place; orchestration in another.

