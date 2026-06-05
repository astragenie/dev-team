# Architect Feature Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `commands/architect-feature.md` — a two-phase researcher+architect pipeline command that produces a contracts artifact and writes inferred tags back to FEAT frontmatter.

**Architecture:** Single new markdown command file (no scripts, no lib modules). Structural tests verify the command's required sections and agent references, following the same pattern as `tests/orchestrate-slice.test.mjs`. Document-only change — no runtime code.

**Tech Stack:** Node.js ESM `node:test`, `node:fs/promises`, markdown

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Create | `commands/architect-feature.md` | Full two-phase pipeline command |
| Create | `tests/architect-feature.test.mjs` | Structural shape tests |

---

## Task 1: Tests + command skeleton

**Files:**
- Create: `tests/architect-feature.test.mjs`
- Create: `commands/architect-feature.md`

- [ ] **Step 1: Create the test file**

```js
// tests/architect-feature.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMD = path.join(repoRoot, "commands", "architect-feature.md");

test("commands/architect-feature.md exists", async () => {
  await assert.doesNotReject(fs.access(CMD), "command file must exist");
});

test("architect-feature has description frontmatter", async () => {
  const text = await fs.readFile(CMD, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "file must start with YAML frontmatter");
  assert.match(match[1], /^description:\s*.+/m, "frontmatter must have non-empty description:");
});

test("architect-feature references crew:researcher in Phase 1", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /crew:researcher/, "command must dispatch crew:researcher");
});

test("architect-feature references crew:architect in Phase 2", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /crew:architect/, "command must dispatch crew:architect");
});

test("architect-feature documents ## Inferred Tags section requirement", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /Inferred Tags/, "command must reference ## Inferred Tags");
});

test("architect-feature documents tag write-back as additive", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(
    text,
    /additive|never remove|net.new/i,
    "command must document that tag write-back never removes existing tags"
  );
});

test("architect-feature documents --auto-start flag", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(text, /--auto-start/, "command must document --auto-start flag");
});

test("architect-feature documents FEAT-not-found error handling", async () => {
  const text = await fs.readFile(CMD, "utf8");
  assert.match(
    text,
    /not found|paths tried|halt/i,
    "command must document FEAT-not-found error case"
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
node --test tests/architect-feature.test.mjs
```

Expected: `Error [ERR_MODULE_NOT_FOUND]` or all 8 tests fail with file-not-found.

- [ ] **Step 3: Create `commands/architect-feature.md`**

```markdown
---
description: Feature-level researcher+architect pipeline — produces a contracts artifact and infers surface/stack/concern tags written back to FEAT frontmatter. Run once per FEAT before slice 1. Safe to re-run (additive). Optional --auto-start transitions to first pending slice.
---

# Architect Feature

Run before the first slice to produce a feature-level contracts artifact and infer
dispatch tags. Tags are written back to the FEAT frontmatter additively — the loop
plugin propagates them to slices at creation time.

## Usage

```
/crew:architect-feature FEAT-NNN
/crew:architect-feature FEAT-NNN --auto-start
```

## Workflow

### Step 0 — Locate FEAT

Parse the argument to extract FEAT-ID (format: `FEAT-NNN`). Find the FEAT file in
order:
- `docs/backlog/triaged/<FEAT-ID>.md`
- `docs/backlog/in-progress/<FEAT-ID>.md`
- `docs/backlog/pending/<FEAT-ID>.md`
- `docs/backlog/done/<FEAT-ID>.md`

If not found: halt and print the four paths tried.

Read the FEAT file. Extract:
- `frontmatter.parent_spec` — path to linked spec (may be absent)
- `frontmatter.tags` — current tags array (may be absent; treat as `[]`)

Find existing slice files for this FEAT:
1. Glob `docs/ai-loop/slices/pending/*` — keep files where frontmatter `feat:` equals
   `<FEAT-ID>` OR filename contains `<FEAT-ID>`
2. Glob `docs/ai-loop/slices/completed/*` — same filter
3. Collect all matches as `SLICE_FILES` (may be empty — continue regardless)

---

### Step 1 — Research

Dispatch `crew:researcher` with:

```
FEAT: <FEAT-ID>
FEAT file: <absolute path>
Spec file: <absolute path from parent_spec, or "none — parent_spec not set">
Existing slice files: <newline-separated absolute paths, or "none found">

Read the FEAT file, any linked spec, and all existing slice files listed above.

Identify and summarise:
1. Surface types in scope — API routes, UI screens/components, schema changes, CLI output
2. Interface boundaries — what calls what, what data flows between layers
3. Behavior changes — observable outputs, side effects, events emitted
4. Data contracts — shapes passed between layers, stored, or returned to callers
5. Stack signals — language/framework indicators that imply surface:* or stack:* tags

Return findings artifact at:
  .claude/artifacts/crew/runs/<FEAT-ID>-arch-research.md

Return ONLY the artifact path on a single line.
```

Store the returned path as `RESEARCH_PATH`.

---

### Step 2 — Architecture

Dispatch `crew:architect` with:

```
FEAT: <FEAT-ID>
FEAT file: <absolute path>
Spec file: <absolute path, or "none">
Researcher findings: <RESEARCH_PATH>
Contract artifact target: .claude/artifacts/crew/designs/<FEAT-ID>-contracts.md

Read the researcher findings, FEAT file, and spec before producing anything.

If the contract artifact already exists: add a ## Revision — <today's date> subsection
to each relevant section. Do NOT remove or overwrite existing sections.

If the contract artifact does not exist: create it with these five sections (write
"N/A — not applicable." for any section that does not apply):
  ## TypeScript Interfaces
  ## API Contracts
  ## Event Schemas
  ## Data Contracts
  ## Inferred Tags

The ## Inferred Tags section MUST be a YAML list using values from
docs/standards/feat-tag-schema.md:
  tags:
    - surface:api
    - stack:typescript
    - concern:ux

Be concrete — use real type names, route paths, and field names from the researcher
findings and ACs. Avoid generic placeholders.
Return ONLY the artifact path on a single line.
```

Store the returned path as `CONTRACT_PATH`.

---

### Step 3 — Tag write-back

1. Read `CONTRACT_PATH`. Find the `## Inferred Tags` section.
2. Parse the `tags:` YAML list from that section.
   - If the section is absent: print
     `"Warning: ## Inferred Tags not found in contracts artifact — FEAT frontmatter unchanged"`
     and skip to Step 4.
3. Read the FEAT file frontmatter. If `tags:` key is absent, treat current value as `[]`.
4. Compute `net_new = inferred_tags - existing_tags` (set difference — additive only,
   never remove existing tags).
5. Write updated FEAT frontmatter with `tags: [<existing>, <net_new>]`.
6. Print: `Tags added to <FEAT-ID>: [<net_new list>]`
   Or: `No new tags inferred for <FEAT-ID>` when net_new is empty.

---

### Step 4 — Auto-start

**Skip when `--auto-start` flag is absent.**

Find the first pending slice for this FEAT:
1. Glob `docs/ai-loop/slices/pending/*` — return first file (alphabetical) where
   frontmatter `feat:` equals `<FEAT-ID>`
2. Fallback: glob `docs/ai-loop/slices/pending/*<FEAT-ID>*` — take first match
3. If still none: print
   `"No pending slices for <FEAT-ID> — create slices first, then re-run with --auto-start"`
   and exit 0.

Extract `SLICE_ID` from matched file's `id:` frontmatter field or its filename stem.

Run slice start ceremony:
```bash
node scripts/loop.mjs slice start --id <SLICE_ID>
```

If the command exits non-zero: halt and print the full error output. Do not proceed.

On success: invoke `orchestrate-slice <SLICE_ID>` from the main thread.

---

## Error handling

| Condition | Action |
|---|---|
| FEAT file not found | Halt, print four paths tried |
| No slice files found (Step 1) | Continue — architect works from FEAT + spec alone |
| `parent_spec` absent | Continue — architect notes absence in contracts artifact |
| `## Inferred Tags` absent from contracts | Skip write-back, print warning, exit 0 |
| FEAT has no `tags:` key | Create `tags: []`, then merge |
| `loop.mjs slice start` fails | Halt, print error, do not invoke orchestrate-slice |
| No pending slice (`--auto-start`) | Print message, exit 0 |

## Idempotency

- **Contracts artifact:** architect adds `## Revision — <date>` rather than overwriting.
- **Tag write-back:** additive merge — net-new tags only, never removes existing.
- **`--auto-start`:** safe re-run — only triggers if a pending slice exists.
```

- [ ] **Step 4: Run all 8 tests**

```
node --test tests/architect-feature.test.mjs
```

Expected: 8 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add commands/architect-feature.md tests/architect-feature.test.mjs
git commit -m "feat(commands): add architect-feature pipeline command + tests"
```

---

## Task 2: Final gates

**Files:** none additional

- [ ] **Step 1: Full test suite**

```
node --test
```

Expected: all tests pass, 0 fail

- [ ] **Step 2: Lint**

```
npm run lint
```

Expected: exit 0, 0 warnings

- [ ] **Step 3: Format check**

```
npm run format:check
```

If fails: run `npm run format`, then re-run. Expected: exit 0.

- [ ] **Step 4: Validate skills + agents**

```
node ./scripts/validate-skills.mjs && node ./scripts/validate-agents.mjs
```

Expected: all OK

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: exit 0

- [ ] **Step 6: Commit format fixes if needed**

```bash
git add -A
git commit -m "chore: format fixes after architect-feature command"
```

Only if format auto-fixed anything.
