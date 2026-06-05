# orchestrate-slice Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/crew:orchestrate-slice --id SLICE-NN` — a main-thread state-machine command that classifies a slice by FEAT tags and dispatches architect, uxdesigner, builder, reviewer, validator, copywriter, and doc-writer in sequence, with architect-owned contract artifacts shared across all downstream specialists.

**Architecture:** Command is a markdown file (`commands/orchestrate-slice.md`) whose body is the full dispatch ladder — no subagent lead, no hidden dispatches. Architect writes one immutable contract artifact per FEAT (`designs/FEAT-NNN-contracts.md`); uxdesigner and builder both read it before working. Classification logic lives in command prose (AI reads slice frontmatter at runtime via the Read tool).

**Tech Stack:** Node.js ESM (`node:fs/promises`, `node:test`), markdown command files, `scripts/crew.mjs` CLI for handoff/synthesis write-back.

**Scope:** Hero-crew repo only. Loop-side wiring (`slice-start.md` → emit orchestrate invocation, `dispatch.mts`, `MIN_CREW_VERSION` bump) is a follow-on plan.

**Decisions baked in:**
- Contract artifact: per-FEAT, immutable first write. Revisions require explicit re-dispatch; architect extends with dated `## Revision — SLICE-NN` subsection.
- Classification: in command markdown (AI reads frontmatter); no new `crew.mjs classify-slice` subcommand yet.
- Reviewer review-result: must include a `Contract Conformance` section when a contract artifact exists.
- `dev.stable` auto-commit: existing `build.md` auto-continue logic applies — no new wiring needed.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `commands/orchestrate-slice.md` | **CREATE** | Full state-machine dispatch ladder (Steps 0–8) |
| `agents/architect.md` | **MODIFY** | Add `## Contract artifact schema` section (lines 82–83 insertion point, before `## Report contract`) |
| `tests/orchestrate-slice.test.mjs` | **CREATE** | Structural tests: command file shape, architect schema section, required headers |

---

## Task 1: Create feature branch

- [ ] **Step 1: Create and switch to branch**

```bash
git checkout -b feature/orchestrate-slice-command
```

Expected: `Switched to a new branch 'feature/orchestrate-slice-command'`

- [ ] **Step 2: Verify clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Task 2: Write failing tests (TDD)

**Files:**
- Create: `tests/orchestrate-slice.test.mjs`

- [ ] **Step 1: Write the test file**

```js
// tests/orchestrate-slice.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMAND_PATH = path.join(repoRoot, "commands", "orchestrate-slice.md");
const ARCHITECT_PATH = path.join(repoRoot, "agents", "architect.md");

test("commands/orchestrate-slice.md exists", async () => {
  await assert.doesNotReject(fs.access(COMMAND_PATH), "command file must exist");
});

test("orchestrate-slice command has description frontmatter", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "file must start with a YAML frontmatter block");
  assert.match(match[1], /^description:\s*.+/m, "frontmatter must include non-empty description:");
});

test("orchestrate-slice command body contains Steps 0 through 8", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  for (let i = 0; i <= 8; i++) {
    assert.match(
      text,
      new RegExp(`Step ${i}`),
      `command body must contain "Step ${i}"`
    );
  }
});

test("orchestrate-slice command references all required specialist agents", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const required = ["crew:architect", "crew:uxdesigner", "crew:builder", "crew:reviewer", "crew:validator"];
  for (const agent of required) {
    assert.match(text, new RegExp(agent), `command must reference ${agent}`);
  }
});

test("agents/architect.md contains ## Contract artifact schema section", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  assert.match(text, /^## Contract artifact schema/m, "architect.md must have ## Contract artifact schema section");
});

test("architect contract artifact schema lists all four required sections", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  const required = [
    "TypeScript Interfaces",
    "API Contracts",
    "Event Schemas",
    "Data Contracts",
  ];
  for (const section of required) {
    assert.match(
      text,
      new RegExp(section),
      `architect.md contract schema must mention "${section}"`
    );
  }
});

test("architect contract artifact schema mentions immutable-first-write rule", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  assert.match(
    text,
    /immutable|do not overwrite|Revision.*SLICE/i,
    "architect.md must document the immutable-first-write rule for contract artifacts"
  );
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
node --test tests/orchestrate-slice.test.mjs
```

Expected: 7 failures — `ENOENT` on missing command file, assertion failures on missing sections.

---

## Task 3: Add contract artifact schema to architect.md

**Files:**
- Modify: `agents/architect.md` (insert after line 81, before `## Report contract` at line 83)

Current line 82 is blank, line 83 is `## Report contract`. Insert the new section between them.

- [ ] **Step 1: Add the contract artifact schema section**

Insert this block at line 82 (between the blank line after `## Operating rules` block and `## Report contract`):

```markdown

## Contract artifact schema

When dispatched for a slice that needs interface contracts, write to:

```
.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md
```

**Immutable first write.** Once written, this file is not overwritten. If a downstream agent (builder or uxdesigner) surfaces a gap, add a dated subsection:

```markdown
## Revision — SLICE-NN
<what changed and why>
```

**Required sections** (write "N/A — not applicable for this slice." when a section does not apply):

```markdown
## TypeScript Interfaces
<TS types and interfaces the implementation must satisfy>

## API Contracts
<HTTP routes, request/response shapes, status codes, auth requirements>

## Event Schemas
<async events, message payloads, queue shapes, topic names>

## Data Contracts
<DB table shapes, migration impact, config schema changes, frontmatter fields>
```

Downstream agents (uxdesigner, builder, reviewer) receive this file path in their dispatch prompt and MUST read it before starting work. Reviewer checks conformance and includes a `Contract Conformance` verdict in its review-result artifact.

```

- [ ] **Step 2: Run architect prompt length check**

```bash
node ./scripts/validate-agents.mjs
```

Expected: `ok — 0 errors` (architect.md must stay ≤ 300 lines per governance cap).

- [ ] **Step 3: Run partial test suite to verify architect tests now pass**

```bash
node --test tests/orchestrate-slice.test.mjs 2>&1 | grep -E "architect|PASS|FAIL|✓|✗"
```

Expected: architect-related tests (tests 5, 6, 7) now pass; command tests (1–4) still fail.

---

## Task 4: Write the orchestrate-slice command

**Files:**
- Create: `commands/orchestrate-slice.md`

- [ ] **Step 1: Write the command file**

```markdown
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
   - `needs_ux: true` → `NEEDS_UX = true`
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

---

### Step 8 — Final synthesis

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-final-synthesis \
  --repo "$PWD" \
  --title "orchestrate-slice: <SLICE-NN title>" \
  --outcome "PASS" \
  --summary "<one-paragraph summary of what shipped, which specialists ran, and the contract artifact path>" \
  --changed-files "<comma-separated list of all files changed by builder>" \
  --external-deltas "none"
```

After the command succeeds, print:

```
Orchestration complete. Next: /loop:slice complete --id SLICE-NN
```
```

- [ ] **Step 2: Run the full test suite**

```bash
node --test tests/orchestrate-slice.test.mjs
```

Expected: all 7 tests pass.

---

## Task 5: Run full CI suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass, no new failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: zero warnings, zero errors.

- [ ] **Step 3: Run format check**

```bash
npm run format:check
```

Expected: no formatting issues. If there are issues, run `npm run format` then re-check.

- [ ] **Step 4: Run manifest validation**

```bash
node ./scripts/validate-manifests.mjs
```

Expected: `crew@0.10.0` OK.

- [ ] **Step 5: Run agent validation (checks architect.md line cap)**

```bash
node ./scripts/validate-agents.mjs
```

Expected: 0 errors. Architect.md must stay ≤ 300 lines.

---

## Task 6: Commit

- [ ] **Step 1: Stage files**

```bash
git add commands/orchestrate-slice.md agents/architect.md tests/orchestrate-slice.test.mjs
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(crew): add /crew:orchestrate-slice command + architect contract schema"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `commands/orchestrate-slice.md` new command | Task 4 |
| Ladder Steps 0–8 with conditional logic | Task 4 Step 1 |
| Classification: frontmatter overrides + tag heuristics | Task 4 Step 1, Step 0 section |
| Architect contract artifact per-FEAT, immutable | Task 3 + Task 4 Step 1 |
| UX spec read contract before designing | Task 4 Step 2 |
| Builder reads contract + ux spec | Task 4 Step 3 |
| Reviewer requires Contract Conformance section | Task 4 Step 4 |
| Validator conditional on `behavior_changed` | Task 4 Step 5 |
| Copywriter + docwriter conditional | Task 4 Steps 6–7 |
| write-final-synthesis at Step 8 | Task 4 Step 8 |
| Tests cover file shape + required headers | Task 2 |
| CI gates pass | Task 5 |
| Architect.md updated with contract schema | Task 3 |

### Placeholder scan

No TBD, TODO, or "similar to Task N" patterns. All code blocks are complete.

### Type consistency

No shared types across tasks — each task is self-contained markdown/test file content.

---

> **Loop side (Plan B — separate plan):** After this ships: update `loop/commands/slice-start.md` to emit `/crew:orchestrate-slice --id SLICE-NN` as the `dispatchInstruction`; update `loop/src/scripts/lib/slice-linker/dispatch.mts`; bump `MIN_CREW_VERSION` to include this crew release.
