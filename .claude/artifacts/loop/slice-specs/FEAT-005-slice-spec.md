# Spec: Implement builder routing by `surface` frontmatter in /crew:orchestrate-slice

## Metadata
- developer_type: agent
- estimated_complexity: medium
- languages: [typescript, markdown]
- autonomous_safe: true

---

## Objective

Wire the `/crew:orchestrate-slice` command (and its underlying dispatcher logic) to read `surface` frontmatter from SLICE and FEAT files, then dispatch the correct builder variant (`crew:builder-fe` for frontend, `crew:builder-be` for backend, `crew:builder` generic fallback for mixed/none/missing). Currently, all slices fall through to the generic `crew:builder` regardless of FEAT classification. After this change, the loop's activity report will show non-zero usage of `crew:builder-fe` and `crew:builder-be` when slices are tagged appropriately.

---

## Context

### Current state

- **FEAT-005 frontmatter** (`C:\work\mega\hero-crew\.claude\artifacts\loop\backlog\triaged\FEAT-005.md`):
  - Fully specified AC with 5 clear criteria.
  - AC explicitly lists routing matrix: `frontend` → `crew:builder-fe`, `backend` → `crew:builder-be`, `mixed|none|absent/invalid` → `crew:builder`.
  - Slice frontmatter precedence rule: slice `surface` field overrides FEAT `surface` field if both present.

- **Loop side (upstream)**:
  - Loop's `/loop:backlog-enrich` writes `surface: frontend|backend|mixed|none` into FEAT frontmatter (committed 2026-06-07).
  - Loop ship: v0.27.0+ includes routing fields in FEAT triage output.

- **Crew side (this repo)**:
  - `/crew:orchestrate-slice` command body (doc) at `C:\work\mega\hero-crew\commands\orchestrate-slice.md`:
    - Reads slice frontmatter at Step 0.
    - Classifies SPLIT_BUILD, NEEDS_CONTRACT, NEEDS_UX via `classifySlice()` in `C:\work\mega\hero-crew\scripts\orchestrate-slice-classify.ts`.
    - **Step 3**: Dispatches builder variants (when SPLIT_BUILD=true, dispatches `crew:builder-fe` + `crew:builder-be`; when SPLIT_BUILD=false, dispatches `crew:builder`).
    - **MISSING**: No dispatch on `surface` frontmatter field — only on tags (`surface:ui` vs `surface:api`).
  - Builder agents exist:
    - `C:\work\mega\hero-crew\agents\builder.md` (generic)
    - `C:\work\mega\hero-crew\agents\builder-fe.md` (frontend specialist)
    - `C:\work\mega\hero-crew\agents\builder-be.md` (backend specialist)

### The gap

The orchestrate-slice command **has no logic** to read the `surface` frontmatter field (added by loop's triage) and pick a builder variant based on it. The current dispatch in Step 3 only reads *tags*, not frontmatter. FEAT-005 requires adding this routing.

### Implementation approach

1. **Extend `classifySlice()` in `orchestrate-slice-classify.ts`**:
   - Add a function `resolveSurfaceDispatch(sliceText, linkedFeatText)` that:
     - Parses slice frontmatter `surface` field (highest priority).
     - Falls back to linked FEAT frontmatter `surface` field if slice has none.
     - Returns one of: `"frontend" | "backend" | "mixed" | "none" | null` (null = absent/invalid).

2. **Extend `orchestrate-slice.md` Step 3 logic**:
   - After Step 0 (classify), compute `SURFACE_DISPATCH = resolveSurfaceDispatch()`.
   - Apply routing matrix:
     - `SURFACE_DISPATCH = "frontend"` → dispatch `crew:builder-fe`.
     - `SURFACE_DISPATCH = "backend"` → dispatch `crew:builder-be`.
     - `SURFACE_DISPATCH = "mixed" | "none" | null` → dispatch `crew:builder` (existing Step 3 behavior).
   - Document the routing table in the command body (AC requirement).

3. **Backwards compat**:
   - Existing slices without `surface` field → resolve as `null` → fall through to `crew:builder` (zero regression).

### Scope: what changes and what doesn't

**In scope:**
- `scripts/orchestrate-slice-classify.ts`: add `resolveSurfaceDispatch()` export.
- `commands/orchestrate-slice.md`: amend Step 0 classification to compute `SURFACE_DISPATCH`; amend Step 3 to gate builder dispatch on `SURFACE_DISPATCH` (and document the matrix).
- `tests/orchestrate-slice.test.ts`: add ≥3 test cases.

**Out of scope:**
- `stack` field routing (informational only; passed to builder context, no dispatch logic).
- Retroactive re-routing of existing in-flight slices.
- SPLIT_BUILD changes (separate FEAT).

---

## Implementation Contract

### Inputs

#### Script: `scripts/orchestrate-slice-classify.ts`

**Function signature to add:**
```typescript
export async function resolveSurfaceDispatch(opts: {
  slicePath: string;
  linkedFeatPath?: string;
}): Promise<"frontend" | "backend" | "mixed" | "none" | null>
```

**Behavior:**
1. Read slice frontmatter from `opts.slicePath`.
2. Extract `frontmatter.surface` (expected values: `"frontend" | "backend" | "mixed" | "none"`).
3. If `frontmatter.surface` is set and valid, return it immediately (slice takes precedence).
4. If absent from slice, read `opts.linkedFeatPath` if provided and extract FEAT `surface` field.
5. If FEAT `surface` is set and valid, return it.
6. If both are absent or unparseable, return `null` (trigger fallback to `crew:builder`).

**Valid values:**
- `"frontend"` (string literal, case-sensitive)
- `"backend"` (string literal, case-sensitive)
- `"mixed"` (string literal, case-sensitive)
- `"none"` (string literal, case-sensitive)
- `null` (when field is absent or value is unrecognized)

#### Command: `/crew:orchestrate-slice` (markdown step in `commands/orchestrate-slice.md`)

**Inputs from Step 0 (already in place):**
- Slice file path (`<slice-path>`).
- Linked FEAT ID (`<FEAT-ID>`, derived from slice frontmatter or title).

**New computation:**
- After classifying SPLIT_BUILD, NEEDS_CONTRACT, NEEDS_UX, also compute:
  - `SURFACE_DISPATCH = resolveSurfaceDispatch({ slicePath: slice, linkedFeatPath: feat })` (pseudo-code; actual call via script or inline).
  - If `SURFACE_DISPATCH = "frontend"`, set `BUILDER_VARIANT = "crew:builder-fe"`.
  - If `SURFACE_DISPATCH = "backend"`, set `BUILDER_VARIANT = "crew:builder-be"`.
  - Otherwise (mixed, none, null), set `BUILDER_VARIANT = "crew:builder"` (generic).

### Outputs

#### From `resolveSurfaceDispatch()`

One of: `"frontend" | "backend" | "mixed" | "none" | null`.

Example:
```json
{
  "slicePath": "/absolute/path/to/SLICE-042.md",
  "linkedFeatPath": "/absolute/path/to/FEAT-005.md",
  "result": "backend"
}
```

#### From `/crew:orchestrate-slice` Step 3

**Dispatch outcome:**
- When `SURFACE_DISPATCH = "frontend"` and `SPLIT_BUILD = false`: dispatch `crew:builder-fe` (not generic `crew:builder`).
- When `SURFACE_DISPATCH = "backend"` and `SPLIT_BUILD = false`: dispatch `crew:builder-be` (not generic `crew:builder`).
- When `SURFACE_DISPATCH = "mixed" | "none" | null` OR `SPLIT_BUILD = true`: dispatch per existing Step 3 logic (no change to current behavior for these cases).

**Command body documentation:**
- Add a routing matrix table in Step 0 or early in the command explaining the dispatch precedence:
  ```
  | surface value | SPLIT_BUILD=false | SPLIT_BUILD=true | Fallback |
  |---|---|---|---|
  | "frontend" | crew:builder-fe | crew:builder-fe + crew:uxdesigner + crew:builder-be | crew:builder |
  | "backend" | crew:builder-be | crew:builder-fe + crew:uxdesigner + crew:builder-be | crew:builder |
  | "mixed" | crew:builder (generic) | crew:builder-fe + crew:uxdesigner + crew:builder-be | crew:builder |
  | "none" | crew:builder (generic) | crew:builder-fe + crew:uxdesigner + crew:builder-be | crew:builder |
  | absent/invalid | crew:builder (generic) | crew:builder-fe + crew:uxdesigner + crew:builder-be | crew:builder |
  ```

### Side effects

- No database writes, no file modifications during dispatch resolution.
- Command body (orchestrate-slice.md) documentation is updated; this is a durable artifact commit (non-transient).
- Test coverage added to `tests/orchestrate-slice.test.ts`.

---

## Files to Create / Modify

### Existing files to modify

1. **`C:\work\mega\hero-crew\scripts\orchestrate-slice-classify.ts`**
   - Add `resolveSurfaceDispatch()` export (async function).
   - Update type exports if needed.
   - ~50 lines added (function body + minimal comments).

2. **`C:\work\mega\hero-crew\commands\orchestrate-slice.md`**
   - Step 0 classification section: add 5–10 lines documenting the new `SURFACE_DISPATCH` computation.
   - Add routing matrix table (8–10 lines).
   - Step 3 builder dispatch section: add conditional routing logic (prose description; the command is markdown, not executable code, so logic is described as a flowchart or decision tree).
   - ~30 lines added.

3. **`C:\work\mega\hero-crew\tests\orchestrate-slice.test.ts`**
   - Add ≥3 test cases for `resolveSurfaceDispatch()`.
   - Test data: minimal fixture slice files or inline string fixtures.
   - ~40 lines added.

### Test fixtures (create if not present)

- `C:\work\mega\hero-crew\tests\fixtures\slices\surface-frontend.md` (slice with `surface: frontend` frontmatter)
- `C:\work\mega\hero-crew\tests\fixtures\slices\surface-backend.md` (slice with `surface: backend` frontmatter)
- `C:\work\mega\hero-crew\tests\fixtures\feats\FEAT-005-mock.md` (FEAT with `surface: backend` frontmatter, for precedence test)

---

## Required Tests

### Test 1: `resolveSurfaceDispatch` returns "frontend" when slice frontmatter has `surface: frontend`

**Given:**
- Slice file with frontmatter: `surface: frontend`
- No linked FEAT file.

**When:**
- `resolveSurfaceDispatch({ slicePath: <path>, linkedFeatPath: undefined })` is called.

**Then:**
- Returns `"frontend"`.

**Data example:**
```markdown
---
id: SLICE-100
title: "Add frontend routing"
surface: frontend
---

# SLICE-100: Add frontend routing
```

### Test 2: `resolveSurfaceDispatch` falls back to FEAT frontmatter when slice has no `surface` field

**Given:**
- Slice file with frontmatter (no `surface` field).
- Linked FEAT file with frontmatter: `surface: backend`.

**When:**
- `resolveSurfaceDispatch({ slicePath: <slice>, linkedFeatPath: <feat> })` is called.

**Then:**
- Returns `"backend"` (from FEAT).

**Data example:**
```markdown
---
id: SLICE-101
title: "Build backend handler"
feat: FEAT-005
---

# SLICE-101: Build backend handler
```
```markdown
---
id: FEAT-005
surface: backend
---

# FEAT-005
```

### Test 3: Slice `surface` precedence — slice field overrides FEAT field

**Given:**
- Slice file with frontmatter: `surface: frontend`.
- Linked FEAT file with frontmatter: `surface: backend`.

**When:**
- `resolveSurfaceDispatch({ slicePath: <slice>, linkedFeatPath: <feat> })` is called.

**Then:**
- Returns `"frontend"` (slice takes precedence over FEAT).

**Data example:**
```markdown
---
id: SLICE-102
title: "UI for backend integration"
surface: frontend
feat: FEAT-005
---

# SLICE-102: UI for backend integration
```
```markdown
---
id: FEAT-005
surface: backend
---

# FEAT-005
```

### Test 4: `resolveSurfaceDispatch` returns `null` when both slice and FEAT lack `surface` field

**Given:**
- Slice file with frontmatter (no `surface` field).
- Linked FEAT file with frontmatter (no `surface` field).

**When:**
- `resolveSurfaceDispatch({ slicePath: <slice>, linkedFeatPath: <feat> })` is called.

**Then:**
- Returns `null`.

**Data example:**
```markdown
---
id: SLICE-103
title: "Generic work"
feat: FEAT-999
---

# SLICE-103
```
```markdown
---
id: FEAT-999
---

# FEAT-999
```

### Test 5: `resolveSurfaceDispatch` returns `null` for invalid/unrecognized `surface` values

**Given:**
- Slice file with frontmatter: `surface: invalid_value`.

**When:**
- `resolveSurfaceDispatch({ slicePath: <path>, linkedFeatPath: undefined })` is called.

**Then:**
- Returns `null` (invalid value is treated as absent, triggering fallback).

**Data example:**
```markdown
---
id: SLICE-104
title: "Malformed metadata"
surface: "desktop-only"
---

# SLICE-104
```

---

## Acceptance Criteria

Match FEAT-005 body exactly:

1. **AC-001**: `/crew:orchestrate-slice --id <SLICE>` reads frontmatter from the slice file AND the linked FEAT (slice takes precedence if both set `surface`).
   - **Testable**: Unit test that invokes `resolveSurfaceDispatch()` with both paths set; verify slice field wins.

2. **AC-002**: Routing matrix above is implemented; absent / invalid values fall through to `crew:builder`.
   - **Testable**: Unit test matrix covering all 5 dispatch cases (frontend, backend, mixed, none, absent).

3. **AC-003**: Existing slices (no `surface` field) keep dispatching to `crew:builder` — zero regression.
   - **Testable**: Unit test returning `null` for missing field; integration test running loop against existing slice and confirming dispatch to generic builder.

4. **AC-004**: Agent activity report shows non-zero `crew:builder-fe` and `crew:builder-be` runs after loop completes one `surface: frontend` and one `surface: backend` slice.
   - **Testable**: Loop acceptance test (out of scope for this builder agent — lead/loop-side validation). Slice itself carries sufficient implementation; integration is tested post-deployment.

5. **AC-005**: Doc update: `/crew:orchestrate-slice` command body documents the routing table.
   - **Testable**: Grep `commands/orchestrate-slice.md` for routing table markdown; inspect visual clarity (manual review).

---

## Verification Commands

Run these in order; all must exit 0 (or PASS per test framework):

1. **Lint**: `npm run lint` — zero warnings.
2. **Format check**: `npm run format:check` — no formatting drift.
3. **Type check**: `npm run typecheck` — no type errors.
4. **Unit tests**: `node --test --experimental-strip-types tests/orchestrate-slice.test.ts` — all 5+ new tests PASS.
5. **Full test suite**: `node --test --experimental-strip-types` — no regressions in other test files.
6. **Validators**: `node ./scripts/validate-manifests.ts` && `node ./scripts/validate-agents.ts` && `node ./scripts/validate-skills.ts` — all exit 0.

Expected outcome: AC-001 through AC-005 verified via test output + manual doc inspection.

---

## Open Questions / Risks

### Questions

1. **How is the linked FEAT path resolved in the command?**
   - Currently, Step 0 derives `<FEAT-ID>` from slice frontmatter or title.
   - The command body does NOT currently locate the FEAT file on disk — it just uses the ID as a string.
   - **Resolution needed**: Spec requires the dispatcher to find and read the FEAT file. Should the command body accept the FEAT file path as an input argument, or should the dispatcher glob for it (`.claude/artifacts/loop/backlog/triaged/FEAT-*.md`)?
   - **Recommendation**: Add a "Resolve linked FEAT path" step to Step 0: if FEAT ID is known, glob `.claude/artifacts/loop/backlog/*/FEAT-<ID>.md` and use the first match; if none found, treat the FEAT path as absent (no fallback to FEAT `surface`).

2. **Is the dispatch logic meant to be inline in the markdown command, or in a script?**
   - Commands are documentation (Markdown); they describe procedural logic, not executable code.
   - The `orchestrate-slice-classify.ts` script is the executable source of truth.
   - **Resolution**: Keep `resolveSurfaceDispatch()` in the script; document the call site in the command markdown (Step 0); command body describes the logic, script contains the implementation. No new command-executing code needed.

### Risks

1. **Backwards-compat edge case: slice already has `surface:ui` tag**
   - Old code uses tags (`surface:ui`, `surface:api`) for SPLIT_BUILD classification.
   - New code adds frontmatter `surface: frontend | backend` field.
   - If a slice has both `surface:ui` tag AND `surface: backend` frontmatter field, which wins?
   - **Current spec assumption**: Frontmatter field routing (FEAT-005) is independent of tag-based SPLIT_BUILD classification (FEAT-018 logic). Step 0 computes both; Step 3 applies surface-routing first (dispatch to specific builder), then classic SPLIT_BUILD logic remains unchanged.
   - **Mitigation**: Test a slice with `surface:ui` tag + `surface: backend` frontmatter; verify it routes to `crew:builder-be` per frontmatter, not `crew:builder-fe` per tag.

2. **FEAT file not found**
   - Slice references FEAT ID but FEAT file is missing from backlog.
   - **Mitigation**: resolveSurfaceDispatch() returns `null` when FEAT path is not provided or file is not readable; command falls back to `crew:builder` (no error).

3. **FEAT `surface` value is invalid**
   - E.g., FEAT frontmatter has `surface: "unknown-type"`.
   - **Mitigation**: Return `null` (treat as absent); fall through to `crew:builder`.

---

## Rationale & Context

### Why this approach

1. **Simplicity**: Surface routing is orthogonal to tag-based SPLIT_BUILD classification. Adding a new frontmatter field (not extending tags) keeps concerns separate and backward-compatible.

2. **Precedence clarity**: Slice frontmatter > FEAT frontmatter > absent/null is explicit and testable. No ambiguity.

3. **Loop-crew contract alignment**: Loop's `backlog-enrich` already writes `surface: frontend|backend|mixed|none` into FEAT frontmatter. This spec consumes that contract directly.

4. **Builder variant utilization**: `crew:builder-fe` and `crew:builder-be` exist but are unused (only SPLIT_BUILD=true triggers them). Surface routing unlocks their use on single-stack slices (e.g., frontend-only slice with `surface: frontend` dispatches to `crew:builder-fe` even if SPLIT_BUILD=false).

### What was rejected

- **Tag-based routing (e.g., `surface:frontend` tag)**: Tags are already used for SPLIT_BUILD classification (`surface:ui` vs `surface:api`). Adding a new tag namespace would muddy semantics. Frontmatter field is clearer.
- **Stack-based routing (e.g., `stack: typescript` → default to frontend)**: Too fragile; stack does not determine surface. TypeScript is used for backend (Node.js) and frontend (React). Explicit `surface` field is safer.
- **Retroactive re-routing**: Out of scope per FEAT-005 body. Future work if needed.

---

## Dependencies & External Integrations

### Loop plugin (`loop`)

- **Capability**: v0.27.0+, `/loop:backlog-enrich` writes `surface: frontend|backend|mixed|none` into FEAT frontmatter.
- **Contract**: FEAT files in `.claude/artifacts/loop/backlog/*/FEAT-*.md` include `surface:` field in YAML frontmatter.
- **Impact**: This spec consumes that output. No new loop changes required; existing loop behavior is sufficient.

### Builder agents

- **Capability**: `crew:builder-fe` and `crew:builder-be` already exist and are fully trained.
- **Contract**: Command dispatches to them as-is; no changes to agent prompts required.
- **Impact**: Increased utilization, no breaking changes.

---

## Examples & Edge Cases

### Example 1: Frontend-only slice with surface frontmatter

```markdown
---
id: SLICE-200
title: "Build login form"
surface: frontend
feat: FEAT-042
---

# SLICE-200: Build login form

## Acceptance Criteria
- [ ] Login form renders with email + password fields
- [ ] Form submission sends POST to /auth/login
- [ ] Success redirects to /dashboard
```

**Expected dispatch**: `crew:builder-fe` (surface=frontend, SPLIT_BUILD=false).

### Example 2: Backend-only slice, FEAT has surface annotation

```markdown
---
id: SLICE-201
title: "Implement POST /auth/login"
feat: FEAT-042
---

# SLICE-201: Implement POST /auth/login

## Acceptance Criteria
- [ ] Handler accepts email + password
- [ ] Returns 401 if credentials invalid
- [ ] Returns 200 + JWT token if valid
```

**Linked FEAT (FEAT-042):**
```markdown
---
id: FEAT-042
surface: backend
---

# FEAT-042: Auth integration
```

**Expected dispatch**: `crew:builder-be` (surface=backend from FEAT, since slice has no surface field).

### Example 3: Slice with surface=mixed → generic builder

```markdown
---
id: SLICE-202
title: "Auth flow (UI + API)"
surface: mixed
feat: FEAT-042
---

# SLICE-202: Full auth flow
```

**Expected dispatch**: `crew:builder` (surface=mixed, no split even if SPLIT_BUILD=true via tags).

### Example 4: Legacy slice with no surface field, no FEAT link

```markdown
---
id: SLICE-003
title: "Refactor tests"
tags: [concern:refactor]
---

# SLICE-003: Refactor tests
```

**Expected dispatch**: `crew:builder` (no surface field, no fallback; returns null → generic builder). Zero regression.

### Example 5: Precedence test

```markdown
---
id: SLICE-203
title: "Web frontend for backend service"
surface: frontend
feat: FEAT-043
---

# SLICE-203
```

**Linked FEAT (FEAT-043):**
```markdown
---
id: FEAT-043
surface: backend
---

# FEAT-043
```

**Expected dispatch**: `crew:builder-fe` (slice surface wins; frontend, not backend).

---

## Validation Criteria

Each AC maps to one or more runnable checks:

| AC # | Check | Command / Method | Expected Result |
|---|---|---|---|
| AC-001 | Slice frontmatter takes precedence over FEAT | Unit test: `resolveSurfaceDispatch()` with both paths + both fields set | Returns slice value |
| AC-002a | "frontend" routes to `crew:builder-fe` | Unit test OR grep `orchestrate-slice.md` for dispatch table | Table row shows frontend→builder-fe |
| AC-002b | "backend" routes to `crew:builder-be` | Unit test OR grep `orchestrate-slice.md` for dispatch table | Table row shows backend→builder-be |
| AC-002c | "mixed", "none", null route to `crew:builder` | Unit test OR grep `orchestrate-slice.md` for dispatch table | Table row shows fallback→builder |
| AC-003 | Legacy slice without `surface` falls back to `crew:builder` | Unit test returning null for missing field | Confirmed via test output |
| AC-004 | Loop runs non-zero `crew:builder-fe` + `crew:builder-be` | Loop integration test (async, post-deployment) | Agent activity report shows usage |
| AC-005 | Command documents routing table | Grep `commands/orchestrate-slice.md` | Markdown table or prose description present + clear |

---

## Summary

This spec wires builder dispatch to read `surface` frontmatter from slice and FEAT files, enabling precise routing to `crew:builder-fe` and `crew:builder-be` on single-stack slices. The change is additive (no breaking changes), backward-compatible (missing field → existing behavior), and aligns with loop's output contract. Implementation is ~120 lines of code + tests across 2–3 files. All 5 ACs are testable with concrete, runnable verification commands.
