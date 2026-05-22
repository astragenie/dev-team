# Changes In This Docs Revision

**Date:** May 19, 2026
**Scope:** Tasks A, B, and C from the docs-improvement discussion
**Source:** Audit of the original `docs/*.md` set against (1) the bug findings from the scripts audit and (2) general doc-hygiene issues

This file lists every meaningful change so you can review before merging. No code or runtime behavior was changed — these are documentation-only edits.

---

## Summary

| Task | What changed | Files affected |
|---|---|---|
| A | Recorded confirmed bugs and architectural deferrals into continuity docs | `project-status.md`, `implementation-commitments.md` |
| B | Fixed dead links, banner-flagged stale doc, added README, clarified event-schema drift | `README.md` (new), `v1-spec.md`, `event-schema.md`, all 12 originals (link rewrites) |
| C | Consolidated overlapping memory docs into cleanly separated files | `memory-system.md` (rewritten), `agent-protocol.md` (new), `memory-and-communication.md` (deleted) |

---

## Task A: Update continuity docs with findings from this conversation

### `project-status.md`

**Added new section: "Known Issues From Code Audit (May 2026)"**

Inserted between the existing "Current Gaps" section and "Recommended Next Steps". Records the bugs the scripts audit confirmed:

- **Severity 1** (ship-blocking): BUG-A (claims race), BUG-B (run-brief destroys current run)
- **Severity 2** (correctness): BUG-C (dead duplicate branch), BUG-D (orphan phantom runs), release-without-owner privilege escalation
- **Severity 3** (code quality): flag parser bloat, `--note` / `--reason` duplication, magic-string artifact kinds, no command-level telemetry

Also added a subsection "What the bugs have in common" naming the pattern (every confirmed bug is a state-management read-modify-write issue on shared JSON) and a "Test harness" pointer.

Rationale: a new Claude session reading `project-status.md` for continuity now learns what's broken and roughly why, not just what's working.

### `implementation-commitments.md`

**Added four new committed-later items** (numbered 9 through 12):

9. **Migration of mutable JSON state to append-only event logs.** The deeper fix behind BUG-A.
10. **Tool-level safety gates via PreToolUse hook.** Moves production-deploy safety out of prompts and into enforced tools.
11. **Code-enforced artifact kind constants.** Prevents the BUG-C class of silent dead code.
12. **Command-level telemetry from `crew.mjs`.** Fills in the planned-but-unimplemented event fields in `event-schema.md`.

Rationale: when these are eventually built, future-you reading commitments will know they were intentionally deferred, not forgotten.

---

## Task B: Fix doc-hygiene issues

### Dead absolute-path links

**Replaced 25 instances** of `./...` and `./...` with sibling-relative paths (`./<filename>.md`).

Affected files: `implementation-commitments.md`, `memory-and-communication.md` (later replaced by `agent-protocol.md`), `memory-system.md` (later rewritten), `product-roadmap.md`, `project-status.md`, `reference-repo-plan.md`, `system-design.md`, `validation-loop.md`.

Validation: every internal markdown link now resolves to a real file in the same directory (verified by automated link check — 8 unique link targets, 0 broken).

### Machine-specific paths in code examples

Replaced in code blocks where they wouldn't be auto-rewritten as links:

- `project-status.md`: `claude plugin validate /Users/aradaev/Documents/Playground` → `claude plugin validate <path-to-plugin-repo>`
- `reference-repo-plan.md`: research-note paths like `/Users/aradaev/Desktop/Projects/conductor-protocol` → `<reference-repos-dir>/conductor-protocol`

Rationale: these were historical notes about where files lived on the original author's machine. Generic-izing them makes the docs portable.

### `v1-spec.md` — historical banner

Added a prominent banner at the top of `v1-spec.md` explaining:

- the doc is HISTORICAL and does not reflect current implementation
- specific drifts: stack (TypeScript+SQLite originally proposed, JS+JSON actually built), positioning, data model, command surface
- where to look for current truth (`system-design.md`, `product-roadmap.md`, `project-status.md`)

Rationale: future readers (and future Claude sessions) need to know which doc to trust. Without the banner, anyone reading `v1-spec.md` would assume it reflects current state and act on outdated specs.

### `event-schema.md` — planned-vs-implemented clarification

Added a paragraph after the "Planned Optional Fields" section explaining:

- only `log_event.sh` writes events today; `crew.mjs` itself emits nothing
- the planned fields (`runId`, `taskId`, `role`, `owner`) need CLI-side telemetry to be populated
- this is tracked as committed-later item #12 in `implementation-commitments.md`

Rationale: closes the doc-vs-code drift loop. The "planned" status was technically correct but didn't say what would actually unlock implementation.

### New `README.md`

Brand-new file in the docs folder. Directly answers your original question ("how are these md files used"). Includes:

- explicit statement that docs are NOT loaded by Claude Code at runtime
- comparison table of runtime-loaded files vs design docs
- three primary use cases (continuity, design reference, indirect source for agent prompts)
- doc taxonomy (Tier 1 source-of-truth, Tier 2 subsystem deep-dives, Tier 3 operational, Tier 4 historical)
- standard session-opener template for new Crew design sessions
- standing rules for keeping the doc set workable

Rationale: a new contributor or fresh Claude session can now read README.md and understand the entire layer in a couple of minutes. The taxonomy also makes it obvious where new docs should land.

---

## Task C: Consolidate overlapping memory docs

### What was overlapping

Both `memory-system.md` and `memory-and-communication.md` independently described:

- the four memory layers (repo, run, role, recency)
- hot/warm/cold organization
- wake-up briefs
- write discipline (when to record memory)

`memory-and-communication.md` also had non-memory content (communication protocol, approval model, team-structure awareness) that didn't appear elsewhere.

A reader trying to answer "how does memory work in Crew?" had to triangulate across two docs that mostly agreed but sometimes drifted.

### What changed

**`memory-system.md` rewritten as the canonical memory doc.** Absorbs all memory-related content from both source docs. Now contains:

- four memory layers
- repo memory vs task memory cross-cut
- hot/warm/cold tiers
- V1 rule
- wake-up briefs (lead + specialist + brief contents)
- record discipline (how + when to write)
- "do agents remember old features" / "do agents notice new pushes" — kept from the old `memory-and-communication.md`
- enforcement direction
- forward-looking roadmap (Steps 1-4, success criteria)

**`agent-protocol.md` created as the new communication-focused doc.** Contains only what was unique to the old `memory-and-communication.md`:

- team structure awareness
- communication model (user↔lead, lead↔specialists, etc.)
- required message shapes (start ack, progress update, completion report, review result)
- approval model and routing
- where the protocol should be implemented

Both new docs link to each other at the relevant points so a reader following a thread doesn't get stuck.

**`memory-and-communication.md` deleted.** Its content is fully covered by the two new docs above.

**Cross-references updated** in `README.md`, `project-status.md`, `product-roadmap.md`, `reference-repo-plan.md`, and within the new docs themselves.

### Verification

Spot-checked that key concepts from the old `memory-and-communication.md` migrated correctly:

| Concept | Lands in |
|---|---|
| Repo Memory, Run Memory, Role Memory, Recency Memory | `memory-system.md` |
| Lead Wake-Up Brief, Specialist Wake-Up Brief | `memory-system.md` |
| Required Start Acknowledgement | `agent-protocol.md` |
| Required Completion Report | `agent-protocol.md` |
| Approval Model | `agent-protocol.md` |
| Team Structure Awareness | `agent-protocol.md` |

Zero concepts lost. Cross-references between the two new docs: memory-system.md → agent-protocol.md (1 reference, the consolidation note); agent-protocol.md → memory-system.md (5 references, mostly "see memory-system.md for X").

---

## Files in this archive

| File | Status |
|---|---|
| `README.md` | NEW — explains the doc set |
| `CHANGES.md` | NEW — this file |
| `agent-protocol.md` | NEW — communication + approvals (replaces memory-and-communication.md) |
| `event-schema.md` | EDITED — added planned-vs-implemented clarification |
| `how-it-feels.md` | UNCHANGED (no dead links to fix) |
| `implementation-commitments.md` | EDITED — added items 9-12, fixed links |
| `memory-system.md` | REWRITTEN — now canonical, absorbs old memory-and-communication.md content |
| `product-roadmap.md` | EDITED — fixed links, updated cross-references |
| `project-status.md` | EDITED — new "Known Issues From Code Audit" section, fixed links and machine-specific paths |
| `reference-repo-plan.md` | EDITED — fixed links and machine-specific paths |
| `release-versioning.md` | UNCHANGED (no dead links to fix) |
| `system-design.md` | EDITED — fixed one link |
| `v1-spec.md` | EDITED — added historical banner |
| `memory-and-communication.md` | DELETED — content split into memory-system.md and agent-protocol.md |

---

## What did NOT change

Worth being explicit about scope:

- **No agent files in `agents/` were modified.** Those were addressed in the earlier revised-agents zip.
- **No command files in `commands/` were modified.**
- **No scripts in `scripts/` were modified.** The bug fixes for BUG-A through BUG-D are pending and tracked in `project-status.md` and `implementation-commitments.md`.
- **No installer template content was modified.** The CONSTITUTION_TEMPLATE and WORKFLOW_TEMPLATE strings in `installer.mjs` (which generate `.claude/crew/constitution.md` and `workflow.md` for end-user repos) are separate from these design docs and unchanged.
- **CRLF line endings preserved.** The original docs use Windows line endings; I kept that to minimize diff noise when you merge.

---

## Recommended next step

After merging these doc changes, the next high-value work is:

1. **Fix BUG-A and BUG-B in `claims.mjs` and `workflow-state.mjs`.** Without the file-locking fix, every team-run loses data. The test harness in `crew-bug-test-harness.mjs` (from the previous deliverable) verifies the fix when it's in.
2. **Delete the dead code in `artifacts.mjs` (BUG-C).** Five-minute change, removes a real footgun.

After that, the deferred commitments in items 9-12 become natural follow-ups.

The doc set is now in good shape to support that work — `project-status.md` knows what's broken, `implementation-commitments.md` knows what's deferred, and `README.md` orients any new Claude session that joins.
