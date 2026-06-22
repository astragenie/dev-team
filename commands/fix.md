---
description: Preferred short entry point for investigating and fixing broken behavior in the current repo.
---

# Fix — Dispatcher Workflow

You are the dispatcher for `/crew:fix`. Investigate first, then build and inspect per the routing table below.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

## Phase order

```
workspace verify + wake-up brief
   ↓
crew:investigator  (root cause analysis, read-only)
   ↓ investigator returns finding artifact
specialist builder (FEAT tag → builder, same routing as /crew:build)
   ↓ PASS (builder writes handoff)
parallel fan-out — single Agent-tool message with N=2 invocations:
   Inspector A (stack-specific)     Inspector B (generalist + lens)
      diff has .cs → crew:c-sharp-reviewer   crew:inspector with lens chosen by FEAT concern:*
      diff has .ts → crew:3rdparty:typescript-reviewer   concern:security → security
      no stack match → SKIP A, B uses code-quality lens   concern:perf → performance
   ↓                                         concern:correctness (default)
   └──────────────────┬───────────────────────┘
                      ↓ both review-result artifacts written
   fix_complete (both approved / approved_with_notes)
   if Inspector B next field names a tests-adequacy gap → dispatch crew:qa-expert
```

No verifier dispatch. Verifier defers to `/crew:ship`.

## Builder routing table

| FEAT tag                                            | Specialist          |
|-----------------------------------------------------|---------------------|
| stack:typescript + surface:ui                       | crew:frontend-dev   |
| stack:typescript + surface:backend                  | crew:backend-dev    |
| stack:typescript + surface:cross-layer              | crew:fullstack-dev  |
| stack:typescript + surface:plugin                   | crew:aiplugin-dev   |
| stack:csharp                                        | crew:backend-dev    |
| no clear tag                                        | crew:fullstack-dev  |

## Workflow

1. Verify the current workspace path:
   - `pwd`
2. Read the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. Confirm the returned `repoPath` matches `$PWD`. If not, stop and correct repo context before proceeding.
   For substantial work, do not start implementation until this step is complete.
4. Dispatch `crew:investigator` (read-only, no file changes):
   - Pass the bug description and any known repro path.
   - Read the returned finding artifact in full before proceeding.
5. Restate the root cause and frame the fix:
   - confirmed root cause (from investigator finding)
   - expected behavior
   - fix scope (in scope / out of scope)
   - whether the work should stay whole or be split into bounded sub-tasks
6. If the task is substantial enough that future wake-up context will matter, write a run brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "team run"`
7. Pick the specialist builder from the routing table above and dispatch via the `Agent` tool.
   - Set `size: standard` for substantive changes (requires `write-handoff` artifact).
   - Set `size: light` only for trivial one-line fixups (skips artifact, but builder still returns structured completion).
   - If this run references a design doc, pass the design doc path to the builder.
8. After the builder returns PASS, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" --from builder --to dispatcher --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "inspector fan-out"`
9. Fan out two inspectors in a **single Agent-tool message** (parallel dispatch):
   - **Inspector A** — stack-specific reviewer (see phase order diagram above for routing; skip A if no stack match).
   - **Inspector B** — `crew:inspector` with lens from FEAT concern tag (default: `correctness`).
   - Pass the builder handoff artifact path to both inspectors.
10. After both inspector artifacts land, write a review result for each:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <PASS|FAIL> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
11. If either inspector returns `rejected`, stop. Surface the findings to the user. Do not emit `fix_complete`.
12. If Inspector A is skipped, `fix_complete` requires only Inspector B to approve.
13. If both approved (or `approved_with_notes`), emit the completion badge:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge fix_complete`
14. Check Inspector B's `next` field. If it names a tests-adequacy gap, dispatch `crew:qa-expert`:
    - Pass the finding artifact and the changed files list.
    - Wait for `crew:qa-expert` to return before closing the run.
15. End with a clear synthesis for the user:
    - confirmed root cause
    - what changed
    - what was reviewed (Inspector A / B decisions)
    - residual risk
    - what happens next (e.g. `/crew:ship` when ready)
    Use this pre-done checkpoint before you call the fix complete:
    - did code change?
    - if yes, did both inspectors resolve (or A skipped + B approved)?
    - did the run leave the artifact trail it should?
16. For substantial work, write a final synthesis artifact:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>" --external-deltas "<off-repo changes required, or 'none'>"`
    - The CLI rejects missing `--external-deltas`. Enumerate sibling-config changes the fix depends on. Pass `--external-deltas none` explicitly if there are none.
