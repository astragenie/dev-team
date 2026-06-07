---
description: Orchestrate the full specialist ladder for a slice — classify by FEAT tags, dispatch architect (contracts), uxdesigner (UI spec), builder, reviewer, validator, doc-writer in sequence. Every dispatch is visible in the main thread.
---

# Orchestrate Slice

Run this after `/loop:slice start --id SLICE-NN`. It reads the slice file, classifies it by tags and frontmatter, then dispatches the right specialist ladder in sequence — all from the main thread, all visible.

## Workflow

### Step 0 — Read and classify slice

1. Find the slice file. Try these globs in order until a match is found:
   - `docs/ai-loop/slices/pending/*SLICE-NN*.md`
   - `docs/ai-loop/slices/completed/*SLICE-NN*.md`
   - `.claude/artifacts/loop/ai-loop/slices/**/*SLICE-NN*.md`
   - `docs/ai-loop/backlog/approved-slices.md` (inline slice entry)

2. Read the slice file. Extract:
   - `frontmatter.tags` — YAML array
   - `frontmatter.needs_contract` — bool or absent
   - `frontmatter.needs_ux` — bool or absent
   - `frontmatter.skip` — array or absent
   - Acceptance criteria section — all lines under `## Acceptance Criteria` or `## AC`
   - Linked FEAT ID (look for `feat:` or `feature:` in frontmatter, or `FEAT-NNN` in the title)

3. Classify using this priority order (explicit frontmatter wins over tag heuristics):

   **Explicit overrides (check first):**
   - `needs_contract: true` → `NEEDS_CONTRACT = true`
   - `needs_contract: false` → `NEEDS_CONTRACT = false` (suppresses all tag heuristics)
   - `needs_ux: true` → `NEEDS_UX = true`
   - `needs_ux: false` → `NEEDS_UX = false` (suppresses all tag heuristics)
   - `skip:` includes `"architect"` → force `NEEDS_CONTRACT = false`
   - `skip:` includes `"uxdesigner"` → force `NEEDS_UX = false`

   **Tag heuristics (when explicit override absent):**
   - tags include `surface:ui` AND (`surface:api` OR `surface:schema`) → `NEEDS_CONTRACT = true`, `NEEDS_UX = true`
   - tags include `surface:ui` OR `concern:ux` OR `concern:accessibility` → `NEEDS_UX = true`
   - tags include `surface:api` OR `surface:schema` → `NEEDS_CONTRACT = true`
   - tags include `stack:react` OR `stack:vue` → `NEEDS_UX = true`
   - tags include `surface:docs` only and no `surface:api`/`surface:ui` → `NEEDS_CONTRACT = false`, `NEEDS_UX = false`
   - tags include `stack:none` → `NEEDS_CONTRACT = false`, `NEEDS_UX = false`
   - tags include BOTH (`surface:ui` OR `stack:react`) AND (`surface:api` OR `surface:schema` OR `stack:csharp` OR `stack:node` OR `stack:python` OR `stack:go`) → `SPLIT_BUILD = true`
   - slice frontmatter `skip:` includes `"split-build"` → force `SPLIT_BUILD = false`
   - otherwise → `SPLIT_BUILD = false`

   **AC-text heuristics (fallback when no tags):**
   - ACs mention both "frontend" and "backend" or "API" → `NEEDS_CONTRACT = true`
   - ACs mention "UI", "screen", "page", "component", "user sees" → `NEEDS_UX = true`

   **Derive behavior/release flags:**
   - `BEHAVIOR_CHANGED = true` when: ACs mention "returns", "emits", "user sees", "command outputs", "test passes", "endpoint responds". Default: `true` (safer).
   - `RELEASE_CONTENT = true` when: tags include `surface:docs` OR ACs mention "CHANGELOG" or "release notes".
   - `DOCS_NEEDED = true` when: slice or FEAT body mentions "README", "architecture doc", "ADR", or "CHANGELOG" update required.

4. Print a one-line classification summary before any dispatch:
   ```
   Classification: SPLIT_BUILD=<true|false> NEEDS_CONTRACT=<true|false> NEEDS_UX=<true|false> BEHAVIOR_CHANGED=<true|false> RELEASE_CONTENT=<true|false> DOCS_NEEDED=<true|false>
   ```

The classification logic is also implemented in `scripts/orchestrate-slice-classify.mjs` (the source of truth for SPLIT_BUILD). When in doubt, run:
  node ./scripts/orchestrate-slice-classify.mjs <slice-path>
to see the deterministic answer.

---

### Step 1 — Architect (contract artifact)

**Skip when `NEEDS_CONTRACT = false`.**

Locate the FEAT ID from the slice frontmatter (`feat:` field or `FEAT-NNN` in the title). If none, derive from the slice ID (SLICE-NN → look up which FEAT owns this slice in the slice file body).

Check whether `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml` already exists. The artifact is FEAT-scoped (shared across all slices of the FEAT) — loop's `/loop:backlog-enrich` pass 2 and `/loop:slice-from-feature` on-demand trigger pre-populate it when missing.

**Decision tree:**

1. **Artifact exists AND slice does NOT require a revision** → SKIP architect dispatch entirely. Set `CONTRACT_YAML_PATH = .claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml` from the existing file (derive `CONTRACT_MD_PATH` and `CONTRACT_TS_PATH` by replacing `.openapi.yaml` with `.md` / `-contracts.ts`) and continue to Step 2. Print:
   ```
   Step 1: contracts artifact already present at <CONTRACT_YAML_PATH>; skipping architect dispatch (no revision needed).
   ```

2. **Artifact exists AND slice DOES require a revision** → instruct architect to read it and append a `## Revision — SLICE-NN` subsection. Use the dispatch prompt below with the existence-known branch.

3. **Artifact does NOT exist** → instruct architect to create it from scratch. Use the dispatch prompt below with the creation branch.

**Revision-required heuristic.** A slice requires a contract revision when ANY of the following holds:

- Slice frontmatter has `revises_contract: true` (explicit, highest precedence)
- Slice AC text contains any of: `"new endpoint"`, `"new event"`, `"new schema"`, `"breaking change"`, `"new type"`, `"new interface"`, `"new field"`, `"rename field"`, `"remove field"` (case-insensitive)
- Slice introduces a new public surface called out in its `## In scope` bullets (look for terms like `"public API"`, `"export"`, `"interface"`, `"schema"`)

When in doubt, default to revision — a redundant `## Revision — SLICE-NN` block is cheap; a missing one drifts the contract.

Dispatch `crew:architect` with this prompt (fill in `<...>` placeholders from slice data):

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
FEAT ID: <FEAT-ID or "unknown">
FEAT tags: <tags array as comma-separated string>
Acceptance criteria:
<paste the full AC section text>

Contract artifact target (canonical YAML): .claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml
Contract markdown companion:               .claude/artifacts/crew/designs/<FEAT-ID>-contracts.md
Derived TS (regenerated, committed):       .claude/artifacts/crew/designs/<FEAT-ID>-contracts.ts

If the YAML already exists: read it, then add the new operations / schemas for this slice. Bump `info.version` (semver) if any public operation changes. Append `## Revision — SLICE-NN` to the markdown.
If the YAML does not exist: create it from scratch following `skills/domain/openapi-authoring/SKILL.md`.

After writing/revising the YAML, regenerate the TS:
  node ./scripts/validate-contracts.ts <yaml> --write

Then run the validator without --write to confirm clean:
  node ./scripts/validate-contracts.ts <yaml>
  (must exit 0; redocly lint + drift check must pass)

Return ONLY the YAML path on a single line.
```

Store the returned path as `CONTRACT_YAML_PATH`. Derive `CONTRACT_MD_PATH` and `CONTRACT_TS_PATH` from it (replace `.openapi.yaml` with `.md` / `-contracts.ts`).

---

### Step 2.5 — Resolve builder skills (optional, when loop plugin is installed)

If the `loop` plugin is installed at >= v0.27.0, resolve the builder skill
loadout from the repo preset BEFORE dispatching builder(s). The resolved
`## Required skills (resolved)` Markdown block is prepended to each builder
dispatch prompt so the builder invokes the right `Skill` tools as Step 0
before any code work. Falls back silently when loop is absent or returns no
match — builder uses its own baked-in routing table.

Locate the loop plugin root:

```bash
LOOP_ROOT="${LOOP_PLUGIN_ROOT:-$(find "${HOME}/.claude/plugins/cache/loop/loop" -maxdepth 1 -type d 2>/dev/null | sort -V | tail -1)}"
PRESET_NAME=$(grep -oP '"preset"\s*:\s*"\K[^"]+' .claude/loop.json 2>/dev/null)
```

If `LOOP_ROOT` is empty or `PRESET_NAME` is empty, SKIP this step — no
resolved block; proceed to Step 3 with the existing prompt shape.

Otherwise run, **per variant**:

```bash
# SPLIT_BUILD = true
FE_BLOCK=$(node "${LOOP_ROOT}/scripts/loop.mjs" resolve-skills \
  --variant fe \
  --preset "${LOOP_ROOT}/scripts/presets/${PRESET_NAME}.json" \
  --override .claude/loop.json 2>/dev/null | jq -r '.dispatchInstructionBlock // empty')

BE_BLOCK=$(node "${LOOP_ROOT}/scripts/loop.mjs" resolve-skills \
  --variant be \
  --preset "${LOOP_ROOT}/scripts/presets/${PRESET_NAME}.json" \
  --override .claude/loop.json 2>/dev/null | jq -r '.dispatchInstructionBlock // empty')

# SPLIT_BUILD = false
SINGLE_BLOCK=$(node "${LOOP_ROOT}/scripts/loop.mjs" resolve-skills \
  --variant single \
  --preset "${LOOP_ROOT}/scripts/presets/${PRESET_NAME}.json" \
  --override .claude/loop.json 2>/dev/null | jq -r '.dispatchInstructionBlock // empty')
```

Each block is empty string when:
- CLI exits 2 (split mismatch, empty skills, or no match)
- jq cannot find `.dispatchInstructionBlock`

Treat empty as "no block — proceed without it". The builder dispatch prompts
in Step 3 / 3a / 3b prepend the block when non-empty, omit it otherwise.

---

### Steps 2 + 3 — UX designer + Builder (parallel when both fire)

`crew:uxdesigner` and `crew:builder` both consume the FEAT-scoped contracts artifact (Step 1's `CONTRACT_YAML_PATH` + `CONTRACT_MD_PATH`) but NOT each other's output. Builder works from contracts + slice ACs; uxdesigner produces UX spec for reviewer to check separately. Both fire concurrently.

**Dispatch rules:**

- `SPLIT_BUILD = false` AND `NEEDS_UX = false` AND `BEHAVIOR_CHANGED = false` — no implementation work. Skip Steps 2 + 3, jump to Step 4.
- `SPLIT_BUILD = false` AND only `NEEDS_UX = true` — dispatch `crew:uxdesigner` only.
- `SPLIT_BUILD = false` AND only `BEHAVIOR_CHANGED = true` — dispatch `crew:builder` only (single-builder path, unchanged).
- `SPLIT_BUILD = false` AND BOTH true — single message with TWO Agent calls: `crew:uxdesigner` + `crew:builder` (existing v0.15.0 behavior, unchanged).
- `SPLIT_BUILD = true` — single message with THREE Agent calls: `crew:uxdesigner` + `crew:builder-fe` + `crew:builder-be`. All consume the same FEAT-scoped OpenAPI YAML path. Builder handoffs are scoped by role: `builder-fe-<SLICE>.md` and `builder-be-<SLICE>.md`.

Race-safety: each parallel agent writes its own artifact at a deterministic path. No shared mutable state. UX spec stays slice-scoped. OpenAPI YAML is read-only for both builders (drift → help_request).

#### Step 2 prompt — `crew:uxdesigner`

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
FEAT tags: <tags array>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none — no contract artifact for this slice">
Contract markdown: <CONTRACT_MD_PATH or "none — no contract artifact for this slice">
Acceptance criteria:
<paste the full AC section text>

UX spec target: .claude/artifacts/crew/designs/<FEAT-ID>-ux-<SLICE-NN>.md

Read the contract artifact (if provided) before designing. Your spec must be consistent with the interfaces and API shapes it defines.

Produce:
- Interaction flows (what the user does step by step)
- Component hierarchy (which components render on each screen/state)
- State transitions (loading / empty / error / success states for each component)
- Copy and labels for all user-visible text
- Accessibility requirements (keyboard nav, ARIA roles, color contrast notes)
- `## API touchpoints` section listing every user action that triggers a network call, with matching operationId from the OpenAPI YAML. Example:
    - "User clicks Save" → operationId `createThing`
    - "List page loads" → operationId `listThings`
- A YAML frontmatter block at the top of the file with `slice:`, `feat:`, and `contracts:` fields (where `contracts:` points to the FEAT YAML path).

After writing the spec, run:
  node ./scripts/validate-ux-spec.ts <ux-spec-path>
(must exit 0; every operationId referenced must exist in the FEAT YAML.)

Return ONLY the artifact path on a single line.
```

Store the returned path as `UX_SPEC_PATH`.

#### Step 3 prompt — `crew:builder`

Prepend `${SINGLE_BLOCK}` from Step 2.5 when non-empty. Omit otherwise.

```
<SINGLE_BLOCK from Step 2.5 — omit when empty>

Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none">
Contract markdown: <CONTRACT_MD_PATH or "none">

Read the contract artifact before writing any code. Your implementation must conform to it. If you find a gap, surface it in your handoff as a help_request — do not invent a resolution.

A UX spec is being authored concurrently by crew:uxdesigner if the slice needs UI. You do NOT block on it — work from contracts + slice ACs only. Reviewer will check UX-spec conformance separately in Step 4.

Implement all acceptance criteria in the slice file. Follow TDD: write failing tests first, then implementation. Return the handoff artifact path.
```

Store the returned path as `BUILDER_HANDOFF_PATH`.

When both branches fire, the orchestrator collects `UX_SPEC_PATH` AND `BUILDER_HANDOFF_PATH` before proceeding to Step 4.

#### Step 3 (SPLIT_BUILD=true) prompts

##### Step 3a — `crew:builder-fe`

Prepend `${FE_BLOCK}` from Step 2.5 when non-empty. Omit otherwise.

```
<FE_BLOCK from Step 2.5 — omit when empty>

Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
UX spec: <UX_SPEC_PATH or "none">

Read the OpenAPI YAML before writing any FE code. Your implementation must conform to it. Regenerate orval clients and openapi-msw handlers as your FIRST step (see skills/domain/contract-codegen/ FE recipes).

If you find a gap in the YAML, surface it as help_request — do not invent.

A BE builder is working concurrently on the BE side; do NOT block on it — work from contracts + UX spec only. Integrator will exercise the real wire later.

Implement all acceptance criteria related to FE. Follow TDD: write failing component tests first.

Return the handoff artifact path.
```

Store the returned path as `BUILDER_FE_HANDOFF_PATH`.

##### Step 3b — `crew:builder-be`

Prepend `${BE_BLOCK}` from Step 2.5 when non-empty. Omit otherwise.

```
<BE_BLOCK from Step 2.5 — omit when empty>

Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
Stack: <derived from FEAT stack:* tag>

Read the OpenAPI YAML before writing any BE code. Your implementation must conform to it. Regenerate native types/stubs as your FIRST step (see skills/domain/contract-codegen/ BE recipes for your stack).

If you find a gap in the YAML, surface it as help_request — do not invent.

A FE builder is working concurrently on the FE side; do NOT block on it — work from contracts only. Integrator will exercise the real wire later.

Implement all acceptance criteria related to BE + DB. Follow TDD: write failing tests first.

Return the handoff artifact path.
```

Store the returned path as `BUILDER_BE_HANDOFF_PATH`.

---

### Step 3.5 — Integrator (SPLIT_BUILD only)

**Skip when `SPLIT_BUILD = false`.**
**Skip when slice frontmatter `skip:` includes `"integrator"`.**

Pre-condition: both `BUILDER_FE_HANDOFF_PATH` and `BUILDER_BE_HANDOFF_PATH` must be set AND each handoff body's `## Self-Verify Gates` section must show PASS for all gates. If either side reports any FAIL: STOP. Print the failing handoff path; tell the user to run `/crew:fix` before re-running orchestrate-slice.

When both PASS, identify the happy-path AC from the slice's Acceptance Criteria — pick the first AC tagged `happy` or, if no explicit tag, the first AC that mentions a status code (e.g. "201", "200") or "shows" / "returns" / "creates".

Dispatch `crew:integrator` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH>
Contract markdown: <CONTRACT_MD_PATH>
Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
happy_path_ac: <verbatim AC text>

Run the integration-smoke procedure (see skills/workflow/integration-smoke/). Validate every response against the OpenAPI schema at runtime. Write the artifact at .claude/artifacts/crew/integrations/<SLICE-NN>-integration.md.

Return the artifact path on a single line.
```

Store the returned path as `INTEGRATION_PATH`.

If the artifact's `Outcome:` line reads `FAIL`: STOP. Print the artifact path; tell the user to run `/crew:fix --target integration` before re-running orchestrate-slice.

If `Outcome: SKIP`: continue to Step 4. Reviewer marks Integration Conformance as `N/A — <SKIP reason>`.

If `Outcome: PASS`: continue to Step 4.

---

### Step 4.5 — Short-slice size check and dispatch-order determination

Before dispatching reviewer and validator, determine the `SHORT_SLICE` flag from the
builder handoff so that short slices with observable behavior run validator first.

**Compute `SHORT_SLICE`:**

A slice is short when EITHER gate passes (lower-bar wins):
- AC count ≤ 6 (count `[ ]` lines in the slice file's Acceptance Criteria section), OR
- Builder handoff changed-files count ≤ 10 (count the files listed under `## Changed files`
  or equivalent in `BUILDER_HANDOFF_PATH`).

Cross-plugin slices are always treated as long regardless of the counts above.

```
SHORT_SLICE = (acCount ≤ 6  OR  changedFilesCount ≤ 10)  AND  NOT cross_plugin
```

`isShortSlice()` in `scripts/orchestrate-slice-classify.ts` implements this logic and can
be called directly:

```bash
node -e "
  import('./scripts/orchestrate-slice-classify.ts').then(m =>
    console.log(m.isShortSlice({ acCount: <N>, changedFilesCount: <M> }))
  );
"
```

**Derive `DISPATCH_ORDER`:**

| Condition | `DISPATCH_ORDER` | Effect |
|---|---|---|
| `SHORT_SLICE = true` AND `BEHAVIOR_CHANGED = true` | `validator_first` | Run Step 5 (validator) before Step 4 (reviewer); reviewer receives `VALIDATION_PATH` as additional input. |
| Any other combination (long slice, cross-plugin, `BEHAVIOR_CHANGED = false`) | `reviewer_first` | Run Step 4 (reviewer) before Step 5 (validator) — current default order. |

Print the outcome before proceeding:

```
SHORT_SLICE=<true|false>  DISPATCH_ORDER=<validator_first|reviewer_first>
```

---

### Step 4 — Reviewer

**When `DISPATCH_ORDER = validator_first`**: run Step 5 (validator) FIRST, store
`VALIDATION_PATH`, then return here. The reviewer prompt receives `VALIDATION_PATH` as
additional input so the reviewer can confirm validator findings rather than independently
re-verify.

**When `DISPATCH_ORDER = reviewer_first`** (default for long slices, cross-plugin slices,
>10 changed files AND ≥7 ACs): run this step first before Step 5.

Dispatch `crew:reviewer` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none">
UX spec: <UX_SPEC_PATH or "none">
Integration artifact: <INTEGRATION_PATH or "none">

When SPLIT_BUILD=true:
  Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
  Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
When SPLIT_BUILD=false:
  Builder handoff: <BUILDER_HANDOFF_PATH>

[When DISPATCH_ORDER=validator_first — include the following line:]
Validation result: <VALIDATION_PATH>

Review the implementation diff(s) for correctness, test coverage, regressions, and contract/UX/integration conformance per the rules in your agent prompt.

When a Validation result is provided: you may treat the validator's scenario evidence as
authoritative for runtime behavior and scope your review to code quality, contract
conformance, and test coverage rather than re-running scenarios independently.

Return the review-result artifact path.
```

Store the returned path as `REVIEW_RESULT_PATH`.

**If review returns `needs_fix`**: stop here. Surface the review-result path and tell the user to run `/crew:fix` before re-running orchestrate-slice.

---

### Step 5 — Validator

**Skip when `BEHAVIOR_CHANGED = false`.**

**When `DISPATCH_ORDER = validator_first`**: this step runs BEFORE Step 4. After
`VALIDATION_PATH` is stored, return to Step 4 to dispatch the reviewer.

**When `DISPATCH_ORDER = reviewer_first`** (default — long slices, cross-plugin, >10
changed files AND ≥7 ACs): this step runs after Step 4 as usual.

Dispatch `crew:validator` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff(s): <BUILDER_HANDOFF_PATH or BUILDER_FE_HANDOFF_PATH + BUILDER_BE_HANDOFF_PATH>
Review result: <REVIEW_RESULT_PATH or "none — validator running before reviewer (validator_first order)">
Integration artifact: <INTEGRATION_PATH or "none">

Validate that the implementation satisfies all acceptance criteria in the slice file. If an Integration artifact is provided with Outcome: PASS, you may short-circuit per your agent prompt's SPLIT_BUILD short-circuit rule. Otherwise, run the full scenario set.

Return the validation artifact path.
```

Store the returned path as `VALIDATION_PATH`.

---

### Step 6 — Document writer (CHANGELOG)

**Skip when `RELEASE_CONTENT = false`.**

Dispatch `loop:document-writer` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff: <BUILDER_HANDOFF_PATH>

Draft the CHANGELOG entry and release-notes section for this slice. Follow the format in CHANGELOG.md. Return the artifact path.
```

Store the returned path as `CHANGELOG_WRITER_PATH`.

---

### Step 7 — Document writer

**Skip when `DOCS_NEEDED = false`.**

Dispatch `loop:document-writer` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff: <BUILDER_HANDOFF_PATH>

Update any README, CHANGELOG, or architecture docs that this slice requires. Return the artifact path.
```

Store the returned path as `DOCWRITER_PATH`.

---

### Step 8 — Final synthesis

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-final-synthesis \
  --repo "$PWD" \
  --title "orchestrate-slice: <SLICE-NN title>" \
  --outcome "PASS" \
  --summary "<one-paragraph summary of what shipped, which specialists ran, CONTRACT_YAML_PATH, CHANGELOG_WRITER_PATH, and DOCWRITER_PATH if set>" \
  --changed-files "<comma-separated list of all files changed by builder>" \
  --external-deltas "none"
```

After the command succeeds, print:

```
Orchestration complete. Next: /loop:slice complete --id SLICE-NN
```
