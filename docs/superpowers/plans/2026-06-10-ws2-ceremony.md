# WS2 — Ceremony Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut slice wall-clock by restructuring ceremony: reviewer+validator dispatched concurrently after builder PASS, deterministic artifact scaffolds via --scaffold so agents fill only judgment fields, and a light tier for small slices with one combined review+validate dispatch.

**Architecture:** Three independent levers touching different surfaces: (2a) prompt/command routing in (removed v0.41) + commands/orchestrate-slice.md + workflow-state badge merge-safety in the scripts layer; (2b) a --scaffold flag on crew.ts write-* commands extending the existing stub-artifact --update machinery in scripts/lib/artifacts/write.ts; (2c) tier classification rules in the dispatcher prompt + slice frontmatter, with the misclassification guard (needs_fix on light → full ladder on the fix bounce).

**Tech Stack:** Node 22.6+ strip-types, node:test, ESM; agent prompts are Markdown under agents/ (≤300 lines each, enforced by scripts/validate-agents.ts).

---

## Task 1: Concurrent workflow-state badge writes (merge-safe)

**Why first:** 2a and 2c both depend on this. Blocks parallel-gate dispatch.

**Acceptance:** Two concurrent `markWorkflowBadge` calls (e.g., reviewer marking review_passed, validator marking validation_passed) to the same workflow state complete without lost updates. Final state reflects both.

### 1.1 Test concurrent badge writes (TDD entry)

**File:** `tests/workflow-state-concurrent.test.ts` (new)

Write a failing test that spawns two concurrent `markWorkflowBadge` calls targeting different gates and verifies both are persisted.

```typescript
test("concurrent markWorkflowBadge calls merge correctly (no lost updates)", async () => {
  const repoPath = await makeTempRepo("workflow-state-concurrent-");
  try {
    // Start a run
    await startWorkflowRun(repoPath, { title: "Test" });
    
    // Fire two concurrent badge writes (reviewer + validator)
    const [result1, result2] = await Promise.all([
      markWorkflowBadge(repoPath, {
        badge: "review_passed",
        summary: "review OK"
      }),
      markWorkflowBadge(repoPath, {
        badge: "validation_passed",
        summary: "validation OK"
      })
    ]);
    
    assert.equal(result1.ok, true);
    assert.equal(result2.ok, true);
    
    // Verify both gates are set in final state
    const final = await loadWorkflowState(repoPath);
    assert.equal(final.currentRun?.gates.review?.status, "passed");
    assert.equal(final.currentRun?.gates.validation?.status, "passed");
  } finally {
    await cleanup(repoPath);
  }
});
```

**Expected:** Test fails with "lost update" (one gate missing or overwritten).

### 1.2 Implement atomic per-field badge writes

**Files:** `scripts/lib/workflow-state.ts` — modify `markWorkflowBadge` + add atomic helper

**Strategy:** Per-field atomic read-modify-write using Node's `fs.readFile` + `fs.writeFile` on an intermediate lock file (not a lock dir, since Windows may have sensitivity issues). The lock approach:
1. Caller generates a unique lock token (UUID + timestamp)
2. Atomically write lock to `.claude/state/crew/workflow-state.lock`
3. Read current state
4. Modify only the target gate field
5. Write back
6. Delete lock file

Actually, simpler approach: **Last-write-wins per field** (since gates are independent). Rewrite `markWorkflowBadge` to:
1. Load state
2. Apply badge (modifies only `run.gates[gateName]`)
3. Serialize full state
4. Write atomically via `fs.writeFile` (atomic at OS level on POSIX; Windows WriteFile with FILE_FLAG_NO_BUFFERING)

This is safe IF: each caller only modifies one gate path and subsequent loads see the full merged state. Since JSON is text, the write is atomic per file. Multiple concurrent writes to the same file still race — but Node's `fs.writeFile` on the same file will serialize them at the OS level (last write wins).

**Better approach:** Use a simple advisory lock pattern:
- Before reading state, create `.claude/state/crew/workflow-state.lock` with lock token
- Sleep if lock file exists + is newer than 100ms (means someone else is writing)
- Proceed once lock is gone
- Read state, modify, write state, delete lock file

For Windows robustness, implement as:

```typescript
async function acquireLock(lockPath: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      // Try to create lock file exclusively (fails if exists)
      const fd = await fs.open(lockPath, "wx");
      await fd.close();
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // Lock exists, backoff
      await new Promise(r => setTimeout(r, 10));
    }
  }
  throw new Error("Workflow state lock timeout");
}

async function releaseLock(lockPath: string) {
  try { await fs.unlink(lockPath); } catch {}
}
```

**Implementation in markWorkflowBadge:**

```typescript
export async function markWorkflowBadge(...): Promise<Result<...>> {
  const lockPath = path.join(repoPath, ".claude", "state", "crew", "workflow-state.lock");
  let lockAcquired = false;
  try {
    await acquireLock(lockPath);
    lockAcquired = true;
    
    const state = await loadWorkflowState(repoPath);
    const run = ensureCurrentRun(state, ...);
    applyBadge(run, badge, ...);
    run.updatedAt = nowIso();
    await saveWorkflowState(repoPath, state);
    
    return ok(state.currentRun);
  } catch (e) {
    return err(...);
  } finally {
    if (lockAcquired) await releaseLock(lockPath);
  }
}
```

**Test:** Re-run test from 1.1 — should PASS.

**Commit:** `feat: workflow-state atomic per-field badge writes with advisory lock`

---

## Task 2: Implement --scaffold flag on write-* commands

**Why after 1:** Independent; enables deterministic artifact templating for 2c.

**Acceptance:** `crew.ts write-review-result --scaffold` produces a file with empty judgment fields, frontmatter, section headers, and deterministic git-derived file lists; existing tests pass.

### 2.1 Extend artifact types + write.ts to support --scaffold

**Files:**
- `scripts/lib/artifacts/types.ts` — add `scaffold?: boolean` to ArtifactFields
- `scripts/lib/artifacts/write.ts` — add render branch for scaffold mode
- `scripts/crew.ts` — wire --scaffold flag from parseArgs to writeArtifact call

**Implementation:**

In `write.ts`, modify the renderers for `review-result` and `validation-result` to emit scaffold-only mode:

```typescript
// Scaffold mode: emit skeleton with no prose, only structure + git-derived lists
function renderReviewResultScaffold(fields: ArtifactFields): string {
  const lines = [
    `# Review Result: ${fields.title || "Untitled"}`,
    "",
    "## Verdict",
    "- decision: ",
    "- confidence: ",
    "",
    "## Test Summary",
    "- test-command: ",
    "- coverage: ",
    "",
    "## Changed Files",
    "- (auto-populated by git during review)",
    "",
    "## Findings",
    "- pass: 0",
    "- partial: 0",
    "- fail: 0",
    "",
    "## Risks",
    "- (describe residual risks or 'none')",
    "",
    "## Notes",
    "- (reviewer judgment here)"
  ];
  return lines.join("\n");
}
```

In `write.ts` render dispatch, add:

```typescript
if (fields.scaffold) {
  return renderReviewResultScaffold(fields);
}
// ... existing render logic
```

In `crew.ts`, add `--scaffold` to parseArgs config:

```typescript
"--scaffold": { key: "scaffold", type: "boolean" }
```

Then pass it through in write-review-result command handler:

```typescript
const r = await writeArtifact(repoPath, "review-result", {
  ...fields,
  scaffold: flags.scaffold ?? undefined
});
```

**Test:** Add to `artifact-stub-and-update.test.ts`:

```typescript
test("write-review-result --scaffold emits skeleton with empty judgment fields", async () => {
  const repoPath = await makeTempRepo("artifact-scaffold-review-");
  try {
    const { status, stdout } = runCli([
      "write-review-result",
      "--repo", repoPath,
      "--title", "Scaffold test",
      "--scaffold"
    ]);
    assert.equal(status, 0);
    const result = JSON.parse(stdout);
    const body = await fs.readFile(result.path, "utf8");
    assert.match(body, /## Verdict/, "must have Verdict section");
    assert.match(body, /decision:/, "must have decision field");
    assert.match(body, /## Test Summary/, "must have Test Summary section");
    assert.doesNotMatch(body, /[a-z].*approved/, "must not contain prose (no full review text)");
  } finally {
    await cleanup(repoPath);
  }
});
```

**Commit:** `feat(artifacts): add --scaffold flag for deterministic artifact templating`

### 2.2 Extend --scaffold for validation-result

**Files:** Same as 2.1, add validation-result renderer

**Implementation:**

```typescript
function renderValidationResultScaffold(fields: ArtifactFields): string {
  const lines = [
    `# Validation Result: ${fields.title || "Untitled"}`,
    "",
    "## Environment",
    "- tested: local",
    "",
    "## Scenario",
    "- goal: ",
    "",
    "## Gates",
    "- lint: ",
    "- format: ",
    "- tests: ",
    "- validate:all: ",
    "",
    "## Evidence",
    "- (command output and observed behavior)",
    "",
    "## Findings",
    "- pass: 0",
    "- partial: 0",
    "- fail: 0",
    "",
    "## Risks",
    "- (residual risks or 'none')",
    "",
    "## Decision",
    "- outcome: "
  ];
  return lines.join("\n");
}
```

**Test:** Add companion test for validation-result --scaffold (same pattern as review-result).

**Commit:** `feat(artifacts): --scaffold for validation-result`

---

## Task 3: Wire concurrent gate dispatch in orchestrate-slice.md

**Why:** 2a prompt-side.

**Acceptance:** orchestrate-slice.md Step 4 + Step 5 dispatch reviewer and validator in parallel (Promise.all pattern) when both run; lead artifact shows both dispatches completed in same time window.

### 3.1 Rewrite Step 4.5 → Step 4 + Step 5 dispatch ordering

**File:** `commands/orchestrate-slice.md` — rewrite Step 4.5 dispatch logic (currently sequential reviewer_first / validator_first)

**Current behavior:** Step 4.5 computes `SHORT_SLICE` and `DISPATCH_ORDER`, then explicitly sequences: if `validator_first`, run Step 5 then Step 4; else run Step 4 then Step 5.

**New behavior:** Always dispatch both concurrently after builder PASS:

Replace Step 4.5 through Step 5 text with:

```markdown
### Step 4.5 — Concurrent gate dispatch

After builder PASS:

1. Compute `SHORT_SLICE` (unchanged: `acCount ≤ 6 OR changedFilesCount ≤ 10`).
2. Dispatch `crew:reviewer` and `crew:validator` **simultaneously** via Promise.all or equivalent (single message with two `Agent` calls, or via separate tool calls on the same turn).
   - Reviewer prompt receives builder handoff + contract + UX spec (if any).
   - Validator prompt receives builder handoff (same) + integration artifact (if any).
   - Validator runs the mandatory full gate FIRST (lint, format:check, full test suite, validate:all); reviewer may reference validation evidence if available.
3. Wait for both to complete.
4. **Conflict rule:** If reviewer returns `needs_fix` while validator is in-flight or after:
   - Mark validation result stale in workflow state.
   - Run fix bounce (builder re-dispatched) with review findings.
   - After builder PASS on fix bounce, re-run validator (full ladder, not combined).
5. If both return PASS (or approved_with_notes / passed_with_notes): proceed to Step 6.
```

Then merge Step 4 and Step 5 into a single "Concurrent Gates" section with two parallel dispatch prompts.

**Exact replacement text:**

```markdown
### Step 4 & 5 — Reviewer and Validator (concurrent)

After builder PASS, dispatch both agents simultaneously:

#### Dispatch `crew:reviewer` (parallel)

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Review lens: <correctness/regression (if fan-out multi-lens mode)>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none">
UX spec: <UX_SPEC_PATH or "none">
Integration artifact: <INTEGRATION_PATH or "none">
Builder handoff: <BUILDER_HANDOFF_PATH or BUILDER_FE_HANDOFF_PATH + BUILDER_BE_HANDOFF_PATH>

Review the implementation for correctness, regressions, contract/UX conformance.
Concurrently, the validator is running the full gate and may provide evidence you can reference.

Return the review-result artifact path.
```

#### Dispatch `crew:validator` (parallel)

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff: <BUILDER_HANDOFF_PATH or handoff(s) for SPLIT_BUILD>
Integration artifact: <INTEGRATION_PATH or "none">

Run the mandatory full gate FIRST (lint, format:check, full test suite, validate:all).
Then validate acceptance criteria. Reviewer is running in parallel.

Return the validation artifact path.
```

#### Conflict rule: reviewer needs_fix invalidates validation

If reviewer returns `needs_fix`:
1. Mark validation result stale: `mark-badge validation_stale --note "invalidated by review needs_fix"`.
2. Re-dispatch builder with review findings.
3. After builder PASS, re-run validator with the full ladder (not combined, even if this is a light-tier slice).
4. Proceed to Step 6 after validator PASS.

If both return PASS (or approved_with_notes / passed_with_notes): proceed to Step 6.

---

### Step 6 — Document writer (CHANGELOG) — unchanged

[rest of orchestrate-slice.md Steps 6–8 unchanged]
```

**Test:** Add concurrent-gate scenario to `e2e-smoke.ts`:

```typescript
test("parallel-gate-scenario: reviewer and validator both complete in same turn", async () => {
  // Create a small slice, dispatch builder
  // Expect builder to PASS
  // Record timestamp T1
  // Dispatch reviewer + validator concurrently via Agent tools
  // Record timestamp T2 when both complete
  // Assert T2 - T1 < (T_reviewer + T_validator) — i.e., overlap is visible
  // Assert both review_passed and validation_passed are in workflow state
});
```

**Commit:** `feat(orchestrate-slice): concurrent reviewer + validator dispatch after builder PASS`

---

## Task 4: Update lead.md for concurrent dispatch + light-tier classification

**Why:** 2a + 2c prompt side.

**Acceptance:** lead.md includes explicit rules for tier classification and concurrent dispatch handoff shape.

### 4.1 Add tier classification rules to dispatcher.md

**File:** `(removed v0.41)` — add new section after "Dispatch decision rule"

**Insertion point:** After line ~70 ("Dispatch decision rule"), before "Pre-dispatch decomposition rule"

**New section:**

```markdown
## Slice tier classification (WS2)

At slice start, classify each slice into a tier to determine gate dispatch pattern:

**Tier rules (deterministic):**

- Docs-only diff (no `.ts`, `.js`, `.tsx`, no manifest/hook/runtime files changed) → `light`
- Code diff but ≤50 changed lines (configurable in `.claude/loop.json` `lightTier.maxChangedLines`; default 50) AND no manifest/hook/runtime files touched → `light`
- Cross-plugin slice (affects 3+ modules with low coupling) → always `full` (even if small)
- Any other code-bearing slice → `full`

**Gate ladder by tier:**

- `tier: full` → builder PASS → [reviewer, validator dispatched concurrently] → approve / reject
- `tier: light` → builder PASS → [combined review+validate agent dispatched once] → approve / reject
  - Combined agent runs full gate internally (lint, tests, format:check, validate:all).
  - Returns both review_decision and validation_decision in one result.
- **Misclassification guard:** if a `light` slice returns `needs_fix` during combined gate, the fix bounce escalates to `full` ladder (separate reviewer and validator).

Record tier in the run-brief artifact as `tier: full | light`.

For tier classification automation, invoke `scripts/orchestrate-slice-classify.mjs` or call the `isLightTier()` function in your classification logic.
```

### 4.2 Update dispatch rules to reference tiers + concurrent pattern

**File:** `(removed v0.41)` — update "Dispatch decision rule" section to cross-reference tiers

Find the table starting ~line 69 ("When to dispatch architect vs builder") and add after:

```markdown
**Concurrent dispatch pattern (WS2 — standard after builder PASS):**

When a `tier: full` slice reaches builder PASS:
- Dispatch reviewer and validator SIMULTANEOUSLY (single message with 2 Agent calls).
- Both consume the same builder handoff; reviewer optionally cites validator evidence if available.
- Conflict resolution: if reviewer returns `needs_fix`, re-dispatch builder; after re-PASS, re-run validator (full ladder).
- Saves ~5–10 min/slice by eliminating sequential round-trip.

When a `tier: light` slice reaches builder PASS:
- Dispatch a single combined review+validate agent (name: `crew:reviewer-validator` or similar; or use existing `crew:validator` with review-scoped prompt extension).
- The combined agent runs the full mandatory gate internally AND performs lens review.
- If `needs_fix`: fix bounce uses full ladder (separate reviewer + validator).

See `commands/orchestrate-slice.md` Step 4–5 for exact prompts.
```

### 4.3 Update artifact discipline to record tier in run-brief

**File:** `(removed v0.41)` — update "Artifact discipline" table (~line 190) OR call out tier in run-brief fields

No table change needed; just ensure run-brief includes a `tier:` field. Update writeArtifact calls in crew.ts to include `tier` if computed.

**Commit:** `feat(lead.md): tier classification + concurrent dispatch rules for WS2`

---

## Task 5: Implement combined review+validate agent dispatch (light-tier path)

**Why:** 2c core feature.

**Acceptance:** A `tier: light` slice dispatches a single agent that runs both review and validation gates and returns both decisions.

### 5.1 Add `crew:reviewer-validator` combined agent (or extend validator)

**Option A (preferred):** Create `agents/reviewer-validator.md` combining both roles.

**Option B:** Extend `agents/validator.md` with optional review lens when marked light-tier.

Choose **Option A** for clarity:

**File:** `agents/reviewer-validator.md` (new)

```markdown
---
name: reviewer-validator
description: Combined review + validation specialist for light-tier slices. Runs full gate (lint, format:check, tests, validate:all) then performs lens review (correctness/regression focus). Returns both review_decision and validation_decision in one result.
model: sonnet
effort: high
maxTurns: 50
disallowedTools: Write, Edit
color: purple
---

## Custom instructions

Before starting work, check for custom instructions in this order:
1. Global: `~/.claude/crew/reviewer-validator.md`
2. Repo: `.claude/crew/reviewer-validator.md`

---

## Identity

You are a combined reviewer + validator for small, low-risk slices. Your job: run the full mandatory gate AND check code quality in one dispatch, returning both review and validation decisions.

This role is used only when a slice is classified as `tier: light` (docs-only, ≤50 lines, no hooks/manifests touched). For larger or riskier slices, the full ladder (separate reviewer + validator) runs instead.

## Workflow

1. **Run mandatory full gate first** (exactly as `validator` does):
   - `npm run lint` — must exit 0
   - `npm run format:check` — must exit 0
   - Full test suite (per `.claude/loop.json` `stack.test`)
   - `npm run validate:all` (if it exists)
   - Record each command + exit code in your validation evidence.

2. **If any gate fails:** stop. Return `validation_decision: failed` with evidence. The slice bounces to the builder via `crew:fix`.

3. **If gates PASS:** proceed to code review.
   - Load builder handoff and changed files.
   - Apply correctness/regression lens (focused on small diffs; deep review not needed for light slices).
   - Check test coverage for changed classes (builder scoped tests; confirm full coverage).
   - Verify contract/UX conformance (if artifacts exist).

4. **Return both decisions:**
   - `review_decision: approved | approved_with_notes | rejected`
   - `validation_decision: passed | passed_with_notes | failed`

   In the artifact, include both `## Review` and `## Validation` sections.

## Artifact format

Write via:
```bash
node scripts/crew.ts write-review-result \
  --repo "$PWD" \
  --title "Light-tier review+validation" \
  --decision approved \
  --evidence "<validation gate results + review findings>"
```

Also write (or update, if separate):
```bash
node scripts/crew.ts write-validation-result \
  --repo "$PWD" \
  --title "Light-tier validation" \
  --decision passed \
  --evidence "<gate results>"
```

Decision: the combined dispatch writes BOTH existing artifact kinds — a review-result via `write-review-result` and a validation-result via `write-validation-result` — so workflow-state gates and brief-me consume them unchanged. No new artifact kind.

## Misclassification: escalation to full ladder

If you encounter `needs_fix` but the slice was marked `tier: light`:
- Still return your findings.
- In your artifact, add a note: "⚠ Light-tier slice with needs_fix → fix bounce will use full ladder (separate reviewer + validator)."
- The dispatcher will re-dispatch builder, then use full ladder on the fix bounce.

## Skills you consult

- Review lens (correctness/regression): `skills/workflow/reviewing-code/`
- Test coverage gaps: `skills/workflow/reviewing-code/`
- (Stack-specific skills loaded per lead dispatch if builder artifacts cite stack tags)
```

### 5.2 Update orchestrate-slice.md to dispatch combined agent for light-tier

**File:** `commands/orchestrate-slice.md` — update Step 4.5 dispatch rule

In the concurrent dispatch section (Task 4.1), add:

```markdown
**Dispatch selection:**

- `tier: full` → dispatch both `crew:reviewer` and `crew:validator` in parallel
- `tier: light` → dispatch `crew:reviewer-validator` (single combined agent)
```

Then provide the combined prompt for light slices.

### 5.3 Test light-tier scenario in e2e-smoke

**File:** `scripts/e2e-smoke.ts` (extend existing test)

Add scenario:

```typescript
test("light-tier scenario: small ≤50-line slice, combined review+validate completes", async () => {
  // Create a docs-only or small code slice
  // Dispatch builder
  // Assert builder PASS
  // Record: this slice should be classified as tier: light
  // Dispatch crew:reviewer-validator (combined agent)
  // Assert: artifact has both review_decision and validation_decision fields
  // Assert: both are PASS (or approved/passed)
});
```

**Commit:** `feat(agents): crew:reviewer-validator for light-tier combined dispatch`

---

## Task 6: Implement tier field in run-brief + slice context

**Why:** Lead must know tier to dispatch correctly.

**Acceptance:** run-brief artifact and slice context include `tier: full | light`; tier is recorded in workflow state.

### 6.1 Add tier field to ArtifactFields + write-run-brief

**Files:**
- `scripts/lib/artifacts/types.ts` — add `tier?: "full" | "light"` to ArtifactFields
- `scripts/lib/artifacts/write.ts` — render tier in run-brief renderer
- `scripts/crew.ts` — accept --tier flag on write-run-brief

**Implementation:**

In `types.ts`:
```typescript
export interface ArtifactFields {
  // ... existing fields
  tier?: "full" | "light";
}
```

In `write.ts` run-brief renderer:
```typescript
"run-brief": {
  render: (f) => [
    `# Run Brief: ${f.title || "Untitled"}`,
    "",
    renderField("Created", nowIso()),
    renderField("Tier", f.tier || "full"), // default full
    renderField("Goal", f.goal),
    // ... rest unchanged
  ].join("\n")
}
```

In `crew.ts`:
```typescript
"--tier": { key: "tier" },
```

And in write-run-brief handler:
```typescript
const r = await writeArtifact(repoPath, "run-brief", {
  ...fields,
  tier: flags.tier ?? undefined
});
```

### 6.2 Add tier classification to slice context

**File:** `scripts/orchestrate-slice-classify.mjs` — extend to export `isLightTier(slice)` function

Implement:
```javascript
export function isLightTier(sliceData) {
  const { changedLinesCount = 0, filesChanged = [] } = sliceData;
  const maxLines = 50; // tunable via loop.json
  
  // Docs-only check
  const nonDocFiles = filesChanged.filter(f => 
    !f.match(/\.(md|txt)$/)
  );
  if (nonDocFiles.length === 0) return true;
  
  // Code-bearing check: ≤50 lines AND no hook/manifest/runtime files
  const hasHookOrManifest = filesChanged.some(f =>
    f.includes("hooks/") || 
    f.match(/manifest|package\.json|tsconfig/) ||
    f.includes("scripts/") && !f.includes("tests/")
  );
  
  if (hasHookOrManifest) return false;
  return changedLinesCount <= maxLines;
}
```

Then in orchestrate-slice.md Step 0, after classification:
```markdown
3. Compute tier via `scripts/orchestrate-slice-classify.mjs`:
   node ./scripts/orchestrate-slice-classify.mjs --slice <path> --tier
   # Output: tier: light | full
```

**Test:** Add to e2e-smoke and unit tests.

**Commit:** `feat: tier field in run-brief + classification logic`

---

## Task 7: Wire validator stale-mark + fix-bounce full-ladder guard

**Why:** 2a conflict resolution + 2c misclassification guard.

**Acceptance:** When reviewer returns needs_fix on a light-tier slice or after concurrent dispatch, the validation result is marked stale, builder re-dispatches, and fix bounce uses full ladder.

### 7.1 Add validation_stale badge to workflow-state

**File:** `scripts/lib/workflow-state.ts` — extend BADGE_TABLE

```typescript
const BADGE_TABLE: Record<string, BadgeSpec> = {
  // ... existing
  validation_stale: {
    selector: (run) => [run.gates, "validation"],
    status: "stale",
    custom: true
  }
};
```

### 7.2 Update lead.md to reference stale-mark + full-ladder escalation

**File:** `(removed v0.41)` — update "Autonomous resolution" table

Find the entry for "Review `needs_fix`" and update:

```markdown
| Review `needs_fix` | Mark validation_stale (if concurrent dispatch); re-dispatch builder with reviewer findings; after PASS, if slice is light-tier, use full ladder (separate reviewer + validator) on re-validation |
```

### 7.3 Implement stale-mark call in orchestrate-slice handoff

**File:** `commands/orchestrate-slice.md` — add to concurrent-dispatch conflict rule

```markdown
If reviewer returns `needs_fix`:
1. Run: `node scripts/crew.ts mark-badge --repo "$PWD" --badge validation_stale --note "invalidated by review needs_fix"`
2. Re-dispatch builder with review findings.
3. After builder PASS:
   - If original tier was `light`: escalate to full ladder (dispatch separate reviewer + validator).
   - If original tier was `full`: use standard concurrent dispatch (both in parallel).
4. Proceed to Step 6 after both gates PASS.
```

**Test:** Extend e2e-smoke:

```typescript
test("light-tier misclassification guard: needs_fix → full ladder", async () => {
  // Create a light-tier slice
  // Dispatch builder (PASS)
  // Dispatch combined review+validator
  // Simulator: reviewer returns needs_fix
  // Assert: validation marked stale
  // Builder re-dispatched (PASS)
  // Assert: fix bounce dispatches full ladder (separate reviewer + validator), not combined
});
```

**Commit:** `feat: validation_stale badge + light-tier escalation to full ladder`

---

## Task 8: Verification + test coverage

**Why:** Ensure all AC-WS2-1..6 are covered + passing.

### 8.1 Run full test suite

```bash
npm test 2>&1 | tail -30
```

Expected: all tests pass, including new concurrent + scaffold + light-tier scenarios.

### 8.2 Run validate-agents

```bash
node ./scripts/validate-agents.ts 2>&1
```

Expected: (removed v0.41), agents/reviewer.md, agents/validator.md, agents/reviewer-validator.md all pass validation (≤300 lines, required fields).

### 8.3 Verify scaffold flag end-to-end

```bash
node scripts/crew.ts write-review-result --repo /tmp/test-scaffold --title "Test" --scaffold 2>&1
# Expected: artifact created with skeleton, no prose

node scripts/crew.ts write-validation-result --repo /tmp/test-scaffold --title "Test" --scaffold 2>&1
# Expected: artifact created with skeleton
```

### 8.4 Run e2e-smoke

```bash
npm run e2e:smoke 2>&1 | tail -20
```

Expected: ≥6 scenarios pass (existing ones + new concurrent, light-tier, concurrent conflict scenarios).

### 8.5 Grade-point cross-check

After test suite green, spot-check grade artifacts if recent runs available:

```bash
ls -t .claude/artifacts/loop/grades/ | head -3
```

Expected: no dimension drops >0.05 vs baseline (if grades were run post-WS2).

### 8.6 Map AC coverage

| AC | Task | Evidence |
|---|---|---|
| AC-WS2-1: Concurrent dispatch | 3.1, 4.1 | e2e-smoke parallel-gate-scenario; orchestrate-slice.md Step 4–5 dispatch text |
| AC-WS2-2: Validator stale on needs_fix | 7.1, 7.3 | workflow-state BADGE_TABLE + validation_stale test; orchestrate-slice conflict rule |
| AC-WS2-3: Scaffold mode deterministic | 2.1, 2.2 | artifact-stub-and-update.test.ts --scaffold tests; verify empty judgment fields |
| AC-WS2-4: Light-tier combined dispatch | 5.1, 5.3 | crew:reviewer-validator agent + light-tier-scenario e2e test |
| AC-WS2-5: Light misclassification escalates | 5.1, 7.3 | light-tier misclassification test; full ladder on fix bounce |
| AC-WS2-6: Concurrent badge writes merge-safe | 1.1, 1.2 | concurrent badge test; advisory lock implementation in workflow-state.ts |

**Commit:** `test(ws2): verification suite + AC-WS2-1..6 mapping`

---

## Summary

**Total tasks:** 8 (4 code, 3 prompt, 1 verification)
**Estimated effort:** 40–50 sonnet turns + 5–10 validation turns
**Dependencies:** 1 → 2 → 3, 4, 5, 6, 7 → 8

**Parallel tracks:** Tasks 2, 3, 4 can run concurrently after 1 completes.

**Ship readiness:** All tasks complete → WS2 ready for single-slice pilot → measure cost/time improvement → next phase (WS1 + WS3 backlog).
