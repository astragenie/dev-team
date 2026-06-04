---
description: Design a feature or service before build.
---

# Design In The Lead Workflow

This is the preferred short entry point for the design phase.

Use it when the user wants to plan a feature or service before `/crew:build` starts. The output is a short, human-readable design doc artifact that the builder can implement from and the reviewer can review against.

For what counts as "substantial" below, see the canonical definition in `constitution.md`.

Workflow:

1. First verify the current workspace path:
   - `pwd`
2. Start by reading the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" wake-up --repo "$PWD"`
3. Explicitly confirm the returned `repoPath` matches the current working directory. If it does not, stop and correct the repo context before proceeding.
4. If a recent design doc already exists under `.claude/artifacts/crew/designs/`, read it and decide whether this session is extending it or starting a fresh one.
5. Frame the design task with the user:
   - what the user wants built
   - rough scope tag: `greenfield`, `existing-feature`, or `small-change`
   - what is in and out of scope
   - who will use it and how
6. For structural change (new contract / provider / cross-module refactor), dispatch the **`crew:architect`** agent for read-only design work and ADR drafts. The architect produces an architecture sketch the design doc references; the lead synthesizes both into the final design doc.
7. Design top-down, in conversation with the user:
   - start from the main thing the feature or service does
   - break it into components, then sub-components
   - describe how they work together — prefer a small visual (ASCII or mermaid block) over paragraphs of prose
   - list main technical decisions with one-line justifications
   - list edge cases the feature must handle
   - list fail modes and what happens when each fails
   - define what "working properly" means — observable signals
   - define what "done" means — a checklist the user can confirm against
   - collect any open questions that still need answers
8. Keep the detail proportional to the change:
   - `greenfield` → lighter, broader strokes, fewer decisions locked down
   - `existing-feature` → more detail on how it fits the current system
   - `small-change` → more specific, often a single component or contract
9. Take the user's perspective: give them what they need to know to trust the design, no more.

When the design is agreed, persist it:

1. Write the full design body to `.claude/artifacts/crew/designs/<short-slug>.md` using the structure described above. The slug should match the feature or service name and be filesystem-safe.
2. Record a run brief so the design surfaces in the next wake-up:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-run-brief --repo "$PWD" --title "design: <short title>" --goal "<one-paragraph summary>" --mode "assisted single-session"`
3. Reference the design doc path in any subsequent handoff instead of duplicating the design inline.

Design should be treated as a phase, not a ritual:

- the design doc is a mental model, not a spec dump — prefer clarity over completeness
- prefer visuals over code snippets
- keep the doc human readable; anyone picking up the repo later should understand the feature from this doc alone
- when the design is done, the recommended next step is usually `/crew:build`

The builder and reviewer read the design doc at the top of their run rather than expecting the handoff to duplicate it.

Design doc template (use as the structure of the persisted file):

- **Summary** — one paragraph: what and why
- **Mental Model** — plain-language description a user could read
- **Components** — top-down list (main components, then sub-components inline)
- **How It Works Together** — short prose plus a visual (ASCII / mermaid)
- **Key Technical Decisions** — each with a short justification
- **Edge Cases** — what unusual inputs or situations must be handled
- **Fail Modes** — what happens when each part breaks, and what the user sees
- **What Working Properly Means** — observable signals the feature is healthy
- **What Done Means** — a checklist a human can verify against
- **Open Questions** — what is not yet decided
- **Visuals** — ASCII diagrams, mermaid blocks, sketches

Note: `/crew:design` does NOT call `write-final-synthesis`. A pure design run terminates with the design doc + run brief. If the design is later promoted to implementation via `/crew:build` or `/crew:fix`, the synthesis gate applies there.
