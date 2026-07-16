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
   - tags include BOTH (`surface:ui` OR `stack:react`) AND (`surface:api` OR `surface:schema` OR `stack:csharp` OR `stack:node` OR `stack:python`) → `SPLIT_BUILD = true`
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

**Companion-file clobber guard (SPIKE-1).** `<FEAT-ID>-contracts.md` has two possible producers with two different section schemas, and this step must never blind-overwrite the other producer's schema:

- `crew:architect-feature` Step 2 writes the FEAT-level schema: five sections `## TypeScript Interfaces` / `## API Contracts` / `## Event Schemas` / `## Data Contracts` / `## Inferred Tags`.
- This step (orchestrate-slice Step 1) writes the companion-to-YAML schema per `skills/domain/architecture/openapi-authoring/SKILL.md`: Decision rationale + Data Contracts + Revisions sections only — no wire-type duplication.

Before the architect touches `CONTRACT_MD_PATH` (whether the YAML exists or not), it MUST read the existing `.md` file first if one is present. If it contains a `## Inferred Tags` section, that is the signature of architect-feature's FEAT-level schema — preserve all five of its sections verbatim and APPEND a `## Revision — SLICE-NN` subsection below them rather than replacing the file. If no `## Inferred Tags` section is present (companion schema already, or file absent), proceed with the companion schema as normal. This instruction is embedded in the dispatch prompt below so the architect enforces it, not just this command doc.

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

If the YAML already exists: read it, then add the new operations / schemas for this slice. Bump `info.version` (semver) if any public operation changes.
If the YAML does not exist: create it from scratch following `skills/domain/architecture/openapi-authoring/SKILL.md`.

Before writing the markdown companion (`CONTRACT_MD_PATH`): READ it first if it already exists on disk. If it contains a `## Inferred Tags` section, it was authored by architect-feature's FEAT-level schema (`## TypeScript Interfaces` / `## API Contracts` / `## Event Schemas` / `## Data Contracts` / `## Inferred Tags`) — do NOT overwrite it. Preserve all five sections verbatim and APPEND a `## Revision — SLICE-NN` subsection below them. Otherwise (no `## Inferred Tags` — companion schema already in place, or file absent), write/extend it using only the companion schema: Decision rationale + Data Contracts + Revisions, per `skills/domain/architecture/openapi-authoring/SKILL.md` — no wire-type duplication.

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

### Step 2.6 — Resolve builder model tier (REQUIRED — run before every builder dispatch below)

**Do NOT let Step 3 / 3a / 3b's Agent-tool dispatch inherit the session model.** Resolve the tier explicitly, once per orchestrate-slice run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" resolve-model --repo "$PWD" --phase build
```

Store the printed value (e.g. `sonnet`) as `BUILD_MODEL`. **If it prints `inherit` (model routing disabled), OMIT the `model:` argument on every builder dispatch** — each agent's own `model:` frontmatter (`agents/*.md`) then governs; do not substitute a model yourself. Otherwise pass `BUILD_MODEL` as the `model:` argument on every builder Agent-tool call in Steps 3 / 3a / 3b below (`crew:fullstack-dev`, `crew:frontend-dev`, `crew:backend-dev` — uxdesigner is not a builder and is unaffected). If a shape classifier is available for this slice (mechanical doc-only / config-only / test-only / single-module edit), pass `--shape <shape>` too — it overrides the phase tier and takes priority over `BUILD_MODEL`.

**Honest limitation:** this is an orchestrator-honored instruction, not a hook-enforced one. The autonomous wave path (`runner-plugin`'s `model-router`, `resolveWaveDispatchModel`) sets the dispatch model programmatically before the subagent spawns — there is no equivalent hard gate here. A `PreToolUse` hook on `Agent` that injects the resolved model when `model:` is absent (tracked as a possible S2b follow-up) would close this gap; it is intentionally out of scope for this instruction wiring.

### Step 2.7 — Recall injection (FEAT-188 S3a)

Fetch a recall block per builder variant BEFORE dispatching (same CLI surface
`commands/build.md` / `commands/fix.md` / `commands/ship.md` use):

```bash
# SPLIT_BUILD = true
FE_RECALL_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block \
  --repo "$PWD" --agent crew:frontend-dev --tags "<FEAT tags csv>" 2>/dev/null | jq -r '.block // empty')

BE_RECALL_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block \
  --repo "$PWD" --agent crew:backend-dev --tags "<FEAT tags csv>" 2>/dev/null | jq -r '.block // empty')

# SPLIT_BUILD = false
SINGLE_RECALL_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block \
  --repo "$PWD" --agent <resolved single-variant builder agent> --tags "<FEAT tags csv>" 2>/dev/null | jq -r '.block // empty')
```

Each block is `""` when memory is not configured (`provider:none` or
`recall.enabled:false`), nothing matched, or the CLI call fails — the CLI's
own best-effort guard (`scripts/lib/memory/inject-recall.ts`) never throws.
Treat empty as "no block — proceed without it". The builder dispatch prompts
in Step 3 / 3a / 3b prepend the block (already the shared
`## Prior context (from astramem)` format) when non-empty, after the Step
2.5 skills block, omit otherwise.

---

### Step 2.7a — Profile injection (agent-profile-load-feedback)

Immediately after the Step 2.7 recall blocks, fetch each builder variant's track record
(best-effort, empty when disabled), passing the current slice id as the run-id so the
later profile-feedback call (Conflict-rule section, Step 4 & 5) can attribute atoms back
to this run:

```bash
# SPLIT_BUILD = true
FE_PROFILE_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-block \
  --repo "$PWD" --agent crew:frontend-dev --run-id "<SLICE-NN>" 2>/dev/null | jq -r '.block // empty')

BE_PROFILE_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-block \
  --repo "$PWD" --agent crew:backend-dev --run-id "<SLICE-NN>" 2>/dev/null | jq -r '.block // empty')

# SPLIT_BUILD = false
SINGLE_PROFILE_BLOCK=$(node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-block \
  --repo "$PWD" --agent <resolved single-variant builder agent> --run-id "<SLICE-NN>" 2>/dev/null | jq -r '.block // empty')
```

Each block is `""` when `memory.profile.enabled` is not `true`, the configured provider
has no `profile()` method (today's shipped `fileProvider` — see the CLI's own fail-silent
guard in `scripts/lib/memory/inject-profile.ts`), nothing matched, or the CLI call fails.
Treat empty as "no block — proceed without it". The builder dispatch prompts in Step 3 /
3a / 3b append the block (already the `## Your track record (<agent>)` format) after the
Step 2.7 recall block, when non-empty, omit otherwise.

**Dispatch-memory-credit-loop (opt-in, `memory.feedback.creditLoop.enabled`):** when
enabled, `profile-block`'s returned block additionally carries a `## Recall (memory
credit loop)` section — recall hits with `<!--atom:id-->` markers, k≤5. Each id is a
candidate for the specialist's OPTIONAL `memories_used` report; when a `write-handoff`
call in a later step names ids the specialist relied on, pass
`--memories-used <id1,id2>` to credit them. Never required, never gated. See
`docs/contracts/dispatch-memory-credit-loop-v1.md`.

---

### Steps 2 + 3 — UX designer + Builder (parallel when both fire)

`crew:uxdesigner` and `crew:fullstack-dev` both consume the FEAT-scoped contracts artifact (Step 1's `CONTRACT_YAML_PATH` + `CONTRACT_MD_PATH`) but NOT each other's output. Builder works from contracts + slice ACs; uxdesigner produces UX spec for reviewer to check separately. Both fire concurrently.

**Dispatch rules:**

**Builder routing (FEAT-170 SLICE-C — single-stack specialization):**

The classifier now exposes `FE_ONLY` and `BE_ONLY` alongside `SPLIT_BUILD`. Single-stack slices route to specialist builders; `crew:fullstack-dev` reserved for legitimately cross-cutting or untagged slices. This is the authoritative signal-level implementation of the policy summarized in `docs/routing-table.md`'s "Builder routing matrix" (generated from `docs/routing-table.yaml`) — keep both in sync when adding a new signal here.

| Signals | Builder dispatch |
|---|---|
| `SPLIT_BUILD = false` AND `NEEDS_UX = false` AND `BEHAVIOR_CHANGED = false` | No implementation. Skip Steps 2 + 3, jump to Step 4. |
| `SPLIT_BUILD = false` AND only `NEEDS_UX = true` | `crew:uxdesigner` only. |
| `BE_ONLY = true` AND `BEHAVIOR_CHANGED = true` | `crew:backend-dev` only (no UX needed). |
| `FE_ONLY = true` AND `BEHAVIOR_CHANGED = true` AND `NEEDS_UX = false` | `crew:frontend-dev` only. |
| `FE_ONLY = true` AND `NEEDS_UX = true` | `crew:uxdesigner` + `crew:frontend-dev` in single parallel message. |
| Untagged (`FE_ONLY = false` AND `BE_ONLY = false` AND `SPLIT_BUILD = false`) AND `TS_TOOLING_ONLY = true` AND `BEHAVIOR_CHANGED = true` | `crew:backend-dev` only (pure-TS tooling default — all changed files are `.ts`/`scripts/`/`tests/`/`evals/`, none are `.tsx`/`.css`/`src/components/`). |
| Untagged AND `TS_TOOLING_ONLY = false` AND `BEHAVIOR_CHANGED = true` | `crew:fullstack-dev` only (generalist path — agent/skill/script/hook/doc edits without surface tags). |
| Untagged AND BOTH `NEEDS_UX` + `BEHAVIOR_CHANGED` true | `crew:uxdesigner` + `crew:fullstack-dev` in single parallel message. |
| `SPLIT_BUILD = true` | Single parallel message with THREE Agent calls: `crew:uxdesigner` + `crew:frontend-dev` + `crew:backend-dev`. All consume the same FEAT-scoped OpenAPI YAML. Handoffs scoped by role: `builder-fe-<SLICE>.md` and `builder-be-<SLICE>.md`. |

Rationale: `fullstack-dev` previously ate every untagged slice + every single-stack slice — generalist agent paid the cost of every dispatch including ones a specialist handles better. SLICE-C routes specialists when the FEAT declares `surface:api / surface:schema / stack:csharp / stack:node / stack:python` (→ backend-dev) or `surface:ui / stack:react` (→ frontend-dev). For untagged slices, `classifyChangedFiles()` detects pure-TS-tooling work (scripts/tests/evals) and routes to backend-dev. fullstack-dev keeps the legitimate use case: untagged slices with agent/skill/hook/doc edits plus explicit cross-layer slices that skip SPLIT_BUILD.

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

#### Step 3 prompt — `crew:fullstack-dev`

Prepend `${SINGLE_BLOCK}` from Step 2.5 when non-empty, then `${SINGLE_RECALL_BLOCK}` from Step 2.6 when non-empty, then `${SINGLE_PROFILE_BLOCK}` from Step 2.7a when non-empty. Omit any when empty.

**Agent-tool dispatch: pass `model: ${BUILD_MODEL}`** (from Step 2.6) explicitly — do not inherit the session model.

```
<SINGLE_BLOCK from Step 2.5 — omit when empty>

<SINGLE_RECALL_BLOCK from Step 2.6 — omit when empty>

<SINGLE_PROFILE_BLOCK from Step 2.7a — omit when empty>

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

##### Step 3a — `crew:frontend-dev`

Prepend `${FE_BLOCK}` from Step 2.5 when non-empty, then `${FE_RECALL_BLOCK}` from Step 2.6 when non-empty, then `${FE_PROFILE_BLOCK}` from Step 2.7a when non-empty. Omit any when empty.

**Agent-tool dispatch: pass `model: ${BUILD_MODEL}`** (from Step 2.6) explicitly — do not inherit the session model.

```
<FE_BLOCK from Step 2.5 — omit when empty>

<FE_RECALL_BLOCK from Step 2.6 — omit when empty>

<FE_PROFILE_BLOCK from Step 2.7a — omit when empty>

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

##### Step 3b — `crew:backend-dev`

Prepend `${BE_BLOCK}` from Step 2.5 when non-empty, then `${BE_RECALL_BLOCK}` from Step 2.6 when non-empty, then `${BE_PROFILE_BLOCK}` from Step 2.7a when non-empty. Omit any when empty.

**Agent-tool dispatch: pass `model: ${BUILD_MODEL}`** (from Step 2.6) explicitly — do not inherit the session model.

```
<BE_BLOCK from Step 2.5 — omit when empty>

<BE_RECALL_BLOCK from Step 2.6 — omit when empty>

<BE_PROFILE_BLOCK from Step 2.7a — omit when empty>

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

### Step 4.5 — Concurrent gate dispatch and tier classification

After builder PASS, determine slice tier and dispatch reviewer and validator.

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

**Classify tier (telemetry only — does not change gate dispatch; see `RISK_GATE` below):**

- `tier: full` — long slices, cross-plugin, >10 changed files AND ≥7 ACs.
- `tier: light` — short slices with `SHORT_SLICE = true` AND `BEHAVIOR_CHANGED = true`.

Tier is recorded in the slice-progress tracking via `write-run-brief --tier <light|full>` (invoked by loop's internal machinery; may be logged for reference).

**Compute `RISK_GATE`** (FEAT-202 / SLICE-112 — lean review gate). Post-builder gate composition is governed by risk, not tier. `RISK_GATE = true` when ANY of:

- slice frontmatter `risk: high` (case-insensitive), OR
- FEAT tags include `concern:security` OR `concern:performance`, OR
- `SPLIT_BUILD = true` (from Step 0 classification)

`RISK_GATE = false` otherwise — the LOW/MEDIUM-risk common case.

Print the outcome before proceeding:

```
SHORT_SLICE=<true|false>  TIER=<light|full>  RISK_GATE=<true|false>
```

---

### Step 4 & 5 — Reviewer and Validator (risk-gated)

After builder PASS, dispatch the post-builder gate. Composition is governed by `RISK_GATE` (Step 4.5), not tier.

#### Dispatch selection

**`RISK_GATE = false` (LOW/MEDIUM risk — the default):** dispatch exactly **one** `crew:reviewer` (Step 4 prompt below). Do **not** dispatch a dedicated `crew:verifier`. Validation for the close-time gate is delegated to the reviewer's evidenced approval artifact plus the CI full-suite gate (`.github/workflows/test.yml`), which runs the whole-repo suite independently of this dispatch — see `.claude/loop.json` `loop.validation.satisfiedByReview: true` and `skills/workflow/validator-gate/SKILL.md`. (The `pre-push-verifier` hook only checks for a PASS artifact behind a default-off flag; CI is the actual full-suite runner.)

**`RISK_GATE = true` (HIGH risk, OR FEAT tags `concern:security` / `concern:performance`, OR `SPLIT_BUILD = true`):** dispatch the heavy path in one parallel message — a 2nd reviewer per `skills/workflow/fan-out-review/SKILL.md` AND/OR a dedicated `crew:verifier` (Step 5 prompt below). This is the explicit override condition for this gate; do not apply the heavy path outside these three signals. **Single-message contract (FEAT-203 / SLICE-113):** every reviewer (1st + 2nd, or up to 4 on the security+performance scale-up) AND the dedicated `crew:verifier` MUST be emitted in that ONE parallel Agent-tool message — no message between dispatches, no wait-for-one-before-dispatching-the-next.

**Stack-lens 2nd reviewer (FEAT-203 / SLICE-113).** When picking the 2nd reviewer for the heavy path, apply `skills/workflow/fan-out-review/SKILL.md`'s stack-lens rule instead of a second generic `crew:reviewer`: diff whose changed files are ≥60% `.cs` → `crew:csharp-reviewer`; ≥60% `.ts`/`.tsx` → `crew:typescript-reviewer`; otherwise fall back to generic `crew:reviewer`. The 1st reviewer is always `crew:reviewer` (correctness/regression lens); only the 2nd lens's identity changes.

**Parallel-dispatch telemetry (FEAT-203 / SLICE-113).** `.claude/loop.json` sets `reviewers.strictParallel: true` and `reviewers.serialTimingThresholdMs: 90000`. If the reviewer artifacts for this slice land more than `serialTimingThresholdMs` apart (timestamps parsed from the `.claude/artifacts/crew/reviews/` filenames), runner-plugin's `complete-slice` ceremony (`recordSerialReviewerWarning` in `slice-linker/complete-slice.mts`, reading `config.reviewers.serialTimingThresholdMs`) stamps a `serial-reviewer-warning` badge on slice close and appends a grade observation — silent serialization of this single-message contract is flagged automatically, not just documented as an intent. `reviewers.strictParallel` is declared in the shared preset schema (`preset-schema.mts`) as a forward-compat flag but has no runtime consumer branching on it yet in the installed runner-plugin version — it does not currently change dispatch or gating behavior; only `serialTimingThresholdMs` is live today.

(Historically both tiers always dispatched `crew:reviewer` + `crew:verifier` concurrently regardless of risk. FEAT-202 / SLICE-112 replaced that with the `RISK_GATE` switch above, ported from runner-plugin's lean post-builder-fanout model, which runs `reviewers.ladder: ["A"]` by default in production and delegates validation to `deriveValidationGate`'s `satisfiedByReview` path.)

#### Step 4 prompt — `crew:reviewer` (both tiers; parallel)

Dispatch with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Review lens: <correctness/regression | security | performance | tests-adequacy — omit for single-lens mode>
OpenAPI YAML: <CONTRACT_YAML_PATH or "none">
UX spec: <UX_SPEC_PATH or "none">
Integration artifact: <INTEGRATION_PATH or "none">

When SPLIT_BUILD=true:
  Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
  Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
When SPLIT_BUILD=false:
  Builder handoff: <BUILDER_HANDOFF_PATH>

Review the implementation diff(s) for correctness, test coverage, regressions, and contract/UX/integration conformance per the rules in your agent prompt. Re-run the builder's affected-class test set (named in the handoff's `## Deferred to validator` line) to confirm it is green and covers the changed classes; the full suite runs at the CI gate (`.github/workflows/test.yml`) (or, when `RISK_GATE=true`, also at the dedicated verifier).

When `RISK_GATE=true` a dedicated `crew:verifier` is running concurrently and may provide evidence you can reference. When `RISK_GATE=false` (the default), your approval is the evidenced artifact the close-time validation gate delegates to (`loop.validation.satisfiedByReview: true`) — write it so it stands alone as proof of behavior, not just style.

Return the review-result artifact path.
```

Store the returned path(s) as `REVIEW_RESULT_PATH` (or the aggregated set when fanning out multi-lens).

#### Step 5 prompt — `crew:verifier` (RISK_GATE=true only)

**Dispatch only when `RISK_GATE = true`** (Step 4.5: HIGH risk, OR `concern:security` / `concern:performance` tags, OR `SPLIT_BUILD = true`). On the `RISK_GATE = false` default, skip this dispatch entirely — the mandatory full gate (whole-repo lint, `format:check`, the complete test suite, `verify:all`) is owned by CI (`.github/workflows/test.yml`) instead of a per-slice dedicated agent; see `skills/workflow/validator-gate/SKILL.md`.

Dispatch with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>

When SPLIT_BUILD=true:
  Builder-fe handoff: <BUILDER_FE_HANDOFF_PATH>
  Builder-be handoff: <BUILDER_BE_HANDOFF_PATH>
When SPLIT_BUILD=false:
  Builder handoff: <BUILDER_HANDOFF_PATH>

Integration artifact: <INTEGRATION_PATH or "none">

Run the mandatory full gate FIRST (lint, format:check, full test suite, verify:all) per your agent prompt — this is where the complete suite runs, since builders only ran affected-class tests. Then validate that the implementation satisfies all acceptance criteria in the slice file. If an Integration artifact is provided with Outcome: PASS, you may short-circuit the scenario set per your agent prompt's SPLIT_BUILD short-circuit rule (the full gate still runs regardless).

Concurrently, the reviewer is running code-quality checks; you focus on behavior and gates.

Return the validation artifact path.
```

Store the returned path as `VALIDATION_PATH`.

> **Tier no longer changes gate composition.** `RISK_GATE` (Step 4.5) is now the sole switch between the single-reviewer default and the heavy 2nd-reviewer/verifier path — light and full tier slices both use the same `RISK_GATE` dispatch selection above. The former combined `reviewer-validator` light-tier prompt was removed.

#### Conflict rule: reviewer needs_fix invalidates validation

If any dispatched reviewer returns `needs_fix`:

1. If `RISK_GATE = true` and a `VALIDATION_PATH` was produced: mark it stale — `node scripts/crew.ts mark-badge --repo "$PWD" --badge validation_stale --note "invalidated by review needs_fix"`. When `RISK_GATE = false` (no dedicated verifier ran), skip this sub-step — there is no separate validation artifact to invalidate; the reviewer's own `needs_fix` result is the signal.
2. **Profile feedback (agent-profile-load-feedback):** record the fail outcome for the builder(s) profile-blocked in Step 2.7a, best-effort, using the SAME `<SLICE-NN>` run-id:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-feedback --repo "$PWD" --run-id "<SLICE-NN>" --outcome fail`
3. Re-dispatch builder with review findings (run `/crew:fix` flow).
4. After builder PASS on the fix bounce: re-dispatch the same gate composition selected in Step 4.5 (single reviewer on `RISK_GATE = false`; reviewer + 2nd reviewer/verifier on `RISK_GATE = true`).
5. Proceed to Step 6 after all dispatched gates PASS.

If all dispatched gates return PASS (or approved_with_notes / passed_with_notes): record the pass outcome the same way (`--outcome pass`, same `<SLICE-NN>` run-id), then proceed to Step 6.

---

### Step 6 — Document writer (CHANGELOG)

**Skip when `RELEASE_CONTENT = false`.**

Dispatch `crew:document-writer` with this prompt:

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

Dispatch `crew:document-writer` with this prompt:

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
  --summary "<one-paragraph summary of what shipped, which specialists ran, CONTRACT_YAML_PATH, CHANGELOG_WRITER_PATH, and DOCWRITER_PATH if set>" \
  --files "<comma-separated list of all files changed by builder>" \
  --external-deltas "none"
```

After the command succeeds, print:

```
Orchestration complete. Next: /loop:slice complete --id SLICE-NN
```
