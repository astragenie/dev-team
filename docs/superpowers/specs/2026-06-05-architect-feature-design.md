---
title: crew:architect-feature — feature-level architecture pass
date: 2026-06-05
status: approved
author: lead
related_feats: []
---

# crew:architect-feature — Feature-Level Architecture Pass

## Goal

Run a researcher + architect pipeline at the FEAT level before any slice starts.
Produces a contracts artifact and infers surface/stack/concern tags written back
to the FEAT frontmatter. When `--auto-start` is set, transitions immediately into
the first pending slice's orchestration.

## Architecture

### Command: `commands/architect-feature.md`

Single new command file. No new agents, no new scripts. Pipeline is two subagent
dispatches from the main thread, then a frontmatter patch, then optional slice start.

---

## Phase 1 — Research

Dispatch `crew:researcher` with:

- FEAT file (absolute path)
- Linked spec file at `parent_spec:` frontmatter value, if present
- All existing slice files for this FEAT (glob `docs/ai-loop/slices/**/*` filtered to
  files whose frontmatter `feat:` matches FEAT-ID, or filename contains FEAT-ID)

Researcher focus prompt:
```
Read the FEAT file, any linked spec, and all existing slice files for FEAT-NNN.

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

Store returned path as `RESEARCH_PATH`.

---

## Phase 2 — Architecture

Dispatch `crew:architect` with:

- Researcher findings at `RESEARCH_PATH`
- FEAT file (absolute path)
- Spec file (if present)

Architect prompt:
```
Read the researcher findings, FEAT file, and spec (if provided) for FEAT-NNN.

Produce a contracts artifact at:
  .claude/artifacts/crew/designs/<FEAT-ID>-contracts.md

If the file already exists: add a ## Revision — <date> subsection. Do NOT remove
existing sections.

If the file does not exist: create it with these five sections. Write
"N/A — not applicable." for sections that do not apply:

  ## TypeScript Interfaces
  ## API Contracts
  ## Event Schemas
  ## Data Contracts
  ## Inferred Tags

The ## Inferred Tags section MUST contain a YAML list of recommended tags using
values from docs/standards/feat-tag-schema.md. Example:
  tags:
    - surface:api
    - surface:ui
    - stack:typescript
    - concern:ux

Be concrete — use real type names, route paths, field names from the ACs and
researcher findings. Avoid generic placeholders.
Return ONLY the artifact path on a single line.
```

Store returned path as `CONTRACT_PATH`.

---

## Tag write-back

1. Read `## Inferred Tags` YAML block from `CONTRACT_PATH`.
2. Parse the `tags:` list.
3. Read current FEAT frontmatter.
4. Merge: union of existing tags + inferred tags (additive — never remove existing tags).
5. Write patched frontmatter back to the FEAT file.
6. Print one-line summary: `Tags added to FEAT-NNN: [list of net-new tags]`

If `## Inferred Tags` is absent from the contracts artifact: skip write-back, print
`"Warning: architect did not produce ## Inferred Tags — FEAT frontmatter unchanged"`.

If FEAT frontmatter has no `tags:` key: create `tags: []` then merge.

---

## Auto-start (--auto-start flag)

After tag write-back, when `--auto-start` is set:

1. Find first pending slice for this FEAT. Try in order:
   - Glob `docs/ai-loop/slices/pending/*` — filter to files whose `feat:` frontmatter matches FEAT-ID
   - Glob `docs/ai-loop/slices/pending/*<FEAT-ID>*` — filename match fallback
2. If no pending slice found: print
   `"No pending slices for FEAT-NNN — create slices first, then re-run with --auto-start"`
   and exit cleanly.
3. If found: run slice start ceremony:
   ```bash
   node scripts/loop.mjs slice start --id <SLICE-NN>
   ```
   If this returns an error: halt and surface the error. Do not proceed to orchestrate-slice.
4. On success: invoke `orchestrate-slice <SLICE-NN>` from the main thread.

---

## Idempotency

Safe to re-run at any time:
- Contracts artifact: architect always adds a `## Revision — <date>` section rather than overwriting.
- Tag write-back: additive merge — existing tags are never removed.
- `--auto-start`: only triggers if a pending slice exists; if the slice is already in-progress or completed, the glob returns no results and the command exits cleanly.

---

## Error handling

| Condition | Action |
|---|---|
| FEAT file not found | Halt, print paths tried |
| No slice files found (Phase 1) | Continue — architect works from FEAT + spec alone |
| `parent_spec:` absent | Continue — architect notes gap in contracts artifact |
| `## Inferred Tags` absent from contracts | Skip tag write-back, print warning, exit 0 |
| FEAT frontmatter has no `tags:` key | Create `tags: []`, then merge |
| `loop.mjs slice start` fails | Halt, surface error, do not invoke orchestrate-slice |
| No pending slice (--auto-start) | Print message, exit 0 |

---

## Usage

```bash
# Architecture-only (default)
/crew:architect-feature FEAT-042

# Architecture + auto-start first slice
/crew:architect-feature FEAT-042 --auto-start
```

---

## Acceptance criteria

- [ ] AC-1: `commands/architect-feature.md` exists and describes the two-phase pipeline
- [ ] AC-2: Phase 1 researcher prompt includes FEAT file, linked spec, and existing slice files
- [ ] AC-3: Phase 2 architect prompt includes researcher findings and produces `## Inferred Tags` section
- [ ] AC-4: Tag write-back is additive — never removes existing FEAT tags
- [ ] AC-5: `--auto-start` flag finds first pending slice by frontmatter `feat:` match, runs slice start, then orchestrate-slice
- [ ] AC-6: `--auto-start` exits cleanly with message when no pending slice found
- [ ] AC-7: Re-run is safe — contracts artifact extended, tags merged
- [ ] AC-8: All error conditions in the table produce the documented output and correct exit behavior
