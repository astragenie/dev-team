---
description: Orchestrate the full specialist ladder for a slice — classify by FEAT tags, dispatch architect (contracts), uxdesigner (UI spec), builder, reviewer, validator, copywriter, doc-writer in sequence. Every dispatch is visible in the main thread.
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

   **AC-text heuristics (fallback when no tags):**
   - ACs mention both "frontend" and "backend" or "API" → `NEEDS_CONTRACT = true`
   - ACs mention "UI", "screen", "page", "component", "user sees" → `NEEDS_UX = true`

   **Derive behavior/release flags:**
   - `BEHAVIOR_CHANGED = true` when: ACs mention "returns", "emits", "user sees", "command outputs", "test passes", "endpoint responds". Default: `true` (safer).
   - `RELEASE_CONTENT = true` when: tags include `surface:docs` OR ACs mention "CHANGELOG" or "release notes".
   - `DOCS_NEEDED = true` when: slice or FEAT body mentions "README", "architecture doc", "ADR", or "CHANGELOG" update required.

4. Print a one-line classification summary before any dispatch:
   ```
   Classification: NEEDS_CONTRACT=<true|false> NEEDS_UX=<true|false> BEHAVIOR_CHANGED=<true|false> RELEASE_CONTENT=<true|false> DOCS_NEEDED=<true|false>
   ```

---

### Step 1 — Architect (contract artifact)

**Skip when `NEEDS_CONTRACT = false`.**

Locate the FEAT ID from the slice frontmatter (`feat:` field or `FEAT-NNN` in the title). If none, derive from the slice ID (SLICE-NN → look up which FEAT owns this slice in the slice file body).

Check whether `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md` already exists:
- **Exists**: instruct architect to read it and extend with a `## Revision — SLICE-NN` subsection rather than overwrite.
- **Does not exist**: instruct architect to create it from scratch.

Dispatch `crew:architect` with this prompt (fill in `<...>` placeholders from slice data):

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
FEAT ID: <FEAT-ID or "unknown">
FEAT tags: <tags array as comma-separated string>
Acceptance criteria:
<paste the full AC section text>

Contract artifact target: .claude/artifacts/crew/designs/<FEAT-ID>-contracts.md

If the file already exists: read it, then add a ## Revision — SLICE-NN subsection with any new or changed interfaces. Do NOT remove existing sections.
If the file does not exist: create it with these four sections (write "N/A — not applicable for this slice." for sections that do not apply):
  ## TypeScript Interfaces
  ## API Contracts
  ## Event Schemas
  ## Data Contracts

Be concrete — use real type names, route paths, and field names from the ACs. Avoid generic placeholders.
Return ONLY the artifact path on a single line.
```

Store the returned path as `CONTRACT_PATH`.

---

### Step 2 — UX designer (UI spec)

**Skip when `NEEDS_UX = false`.**

Dispatch `crew:uxdesigner` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
FEAT tags: <tags array>
Contract artifact: <CONTRACT_PATH or "none — no contract artifact for this slice">
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

Return ONLY the artifact path on a single line.
```

Store the returned path as `UX_SPEC_PATH`.

---

### Step 3 — Builder

Dispatch `crew:builder` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Contract artifact: <CONTRACT_PATH or "none">
UX spec: <UX_SPEC_PATH or "none">

Read the contract artifact and UX spec before writing any code. Your implementation must satisfy both. If you find a gap or conflict in either artifact, surface it in your handoff as a help_request — do not invent a resolution on your own.

Implement all acceptance criteria in the slice file. Follow TDD: write failing tests first, then implementation. Return the handoff artifact path.
```

Store the returned path as `BUILDER_HANDOFF_PATH`.

---

### Step 4 — Reviewer

Dispatch `crew:reviewer` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Contract artifact: <CONTRACT_PATH or "none">
Builder handoff: <BUILDER_HANDOFF_PATH>

Review the implementation diff for correctness, test coverage, and regressions.

When a contract artifact is provided, your review-result artifact MUST include a "Contract Conformance" section with one of:
  PASS — implementation conforms to all interfaces and shapes in the contract artifact.
  FAIL — <list specific deviations: which interface/route/type differs from the contract and how>

Return the review-result artifact path.
```

Store the returned path as `REVIEW_RESULT_PATH`.

**If review returns `needs_fix`**: stop here. Surface the review-result path and tell the user to run `/crew:fix` before re-running orchestrate-slice.

---

### Step 5 — Validator

**Skip when `BEHAVIOR_CHANGED = false`.**

Dispatch `crew:validator` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff: <BUILDER_HANDOFF_PATH>
Review result: <REVIEW_RESULT_PATH>

Validate that the implementation satisfies all acceptance criteria in the slice file. Run tests, check CLI output, or exercise the changed behavior as appropriate. Return the validation artifact path.
```

Store the returned path as `VALIDATION_PATH`.

---

### Step 6 — Copywriter

**Skip when `RELEASE_CONTENT = false`.**

Dispatch `crew:copywriter` with this prompt:

```
Slice: <SLICE-NN title>
Slice file: <absolute path>
Builder handoff: <BUILDER_HANDOFF_PATH>

Draft the CHANGELOG entry and release-notes section for this slice. Follow the format in CHANGELOG.md. Return the artifact path.
```

Store the returned path as `COPYWRITER_PATH`.

---

### Step 7 — Document writer

**Skip when `DOCS_NEEDED = false`.**

If the `loop:document-writer` agent is available (check `agents/` for `document-writer.md` or equivalent), dispatch it. Otherwise dispatch `crew:copywriter`. Prompt:

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
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-final-synthesis \
  --repo "$PWD" \
  --title "orchestrate-slice: <SLICE-NN title>" \
  --outcome "PASS" \
  --summary "<one-paragraph summary of what shipped, which specialists ran, CONTRACT_PATH, COPYWRITER_PATH, and DOCWRITER_PATH if set>" \
  --changed-files "<comma-separated list of all files changed by builder>" \
  --external-deltas "none"
```

After the command succeeds, print:

```
Orchestration complete. Next: /loop:slice complete --id SLICE-NN
```
