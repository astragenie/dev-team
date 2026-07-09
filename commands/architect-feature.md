---
description: Feature-level researcher+architect pipeline — produces a contracts artifact and infers surface/stack/concern tags written back to FEAT frontmatter. Run once per FEAT before slice 1. Safe to re-run (additive). Optional --auto-start transitions to first pending slice.
---

# Architect Feature

Run before the first slice to produce a feature-level contracts artifact and infer
dispatch tags. Tags are written back to the FEAT frontmatter additively — the loop
plugin propagates them to slices at creation time.

## Usage

    /crew:architect-feature FEAT-NNN
    /crew:architect-feature FEAT-NNN --auto-start

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

````
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
````

Store the returned path as `RESEARCH_PATH`.

---

### Step 2 — Architecture

Dispatch `crew:architect` with:

````
FEAT: <FEAT-ID>
FEAT file: <absolute path>
Spec file: <absolute path, or "none">
Researcher findings: <RESEARCH_PATH>
Contract artifact target: .claude/artifacts/crew/designs/<FEAT-ID>-contracts.md

Read the researcher findings, FEAT file, and spec before producing anything.

Before deciding whether the contract artifact "already exists", READ it first if
present and check which schema it uses (companion-file clobber guard, SPIKE-1):

- **FEAT-level schema (this command's own)** — has a `## Inferred Tags` section
  alongside `## TypeScript Interfaces` / `## API Contracts` / `## Event Schemas` /
  `## Data Contracts`.
- **Companion schema (orchestrate-slice Step 1's)** — Decision rationale + Data
  Contracts + Revisions sections only, per
  `skills/domain/architecture/openapi-authoring/SKILL.md`, with NO `## Inferred
  Tags` section. This is orchestrate-slice's markdown companion to a FEAT's
  `<FEAT-ID>-contracts.openapi.yaml`, not a completed FEAT-level artifact.

If the file has the FEAT-level schema already: add a ## Feature Revision —
<today's date> subsection to each relevant section. Do NOT remove or overwrite
existing sections. (Use the "Feature Revision" prefix to distinguish from
orchestrate-slice's "## Revision — SLICE-NN" subsections.)

If the file is absent, OR present but only in the companion schema (no
`## Inferred Tags`): do NOT treat its presence as "already done" — a companion
file is not a substitute for the FEAT-level artifact. Preserve any existing
companion content (Decision rationale / Data Contracts / Revisions) verbatim,
and add the five FEAT-level sections around/after it (write "N/A — not
applicable." for any section that does not apply):
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
````

Store the returned path as `CONTRACT_PATH`.

---

### Step 3 — Tag write-back

1. Read `CONTRACT_PATH`. Find the `## Inferred Tags` section.
2. Parse the `tags:` YAML list from that section.
   - If the section is absent AND the file otherwise matches the companion
     schema (Decision rationale + Data Contracts + Revisions, no FEAT-level
     sections at all — i.e. Step 2's merge did not run or was skipped): print
     `"Note: <CONTRACT_PATH> is orchestrate-slice's companion schema (no FEAT-level sections yet) — Step 2 should have merged in ## Inferred Tags; re-run architect-feature if it did not."`
     This is a distinct, documented case from a genuine missing-tags condition
     below — it means Step 2's merge guard was expected to add the section and
     didn't, not that no tags apply.
   - If the section is absent for any other reason (FEAT-level sections present
     but tags genuinely not inferred): print
     `"Warning: ## Inferred Tags not found in contracts artifact — FEAT frontmatter unchanged"`
     and continue to Step 4 (FEAT frontmatter unchanged). Exit 0 after Step 4.
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

    node scripts/loop.mjs slice start --id <SLICE_ID>

If the command exits non-zero: halt and print the full error output. Do not proceed.

On success: invoke `orchestrate-slice <SLICE_ID>` from the main thread.

---

## Error handling

| Condition | Action |
|---|---|
| FEAT file not found | Halt, print four paths tried |
| No slice files found (Step 1) | Continue — researcher works from FEAT + spec alone |
| `parent_spec` absent | Continue — architect notes absence in contracts artifact |
| `## Inferred Tags` absent from contracts | Skip write-back, print warning, exit 0 |
| FEAT has no `tags:` key | Create `tags: []`, then merge |
| `loop.mjs slice start` fails | Halt, print error, do not invoke orchestrate-slice |
| No pending slice (`--auto-start`) | Print message, exit 0 |

## Idempotency

- **Contracts artifact:** architect adds `## Feature Revision — <date>` rather than overwriting.
- **Tag write-back:** additive merge — net-new tags only, never removes existing.
- **`--auto-start`:** safe re-run — only triggers if a pending slice exists.
