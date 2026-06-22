---
description: Preferred short entry point for investigating and fixing broken behavior in the current repo.
---

# Fix — Dispatcher Workflow

You are the dispatcher for `/crew:fix`. Detect light-path eligibility first; otherwise route via investigator → builder → parallel inspectors.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

## Light-path detection (run BEFORE investigator dispatch)

Match ALL of the following for the light path:

1. **Size**: `git diff --stat HEAD` → ≤2 files changed AND ≤50 lines added/removed
2. **No semantic markers** in the diff additions (escalates to standard ladder if matched):
   ```bash
   git diff HEAD | grep -E '^\+' | grep -vE '^\+\+\+' | \
     grep -qE '\b(async|await|Task|Promise|IQueryable|Include|use[A-Z][a-z]+)\b|\btry\s*\{|\bcatch\s*\('
   # exit 1 (no match) = light path eligible
   ```
3. **No release-sensitive files**: diff does NOT touch `package.json` / `plugin.json` / `marketplace.json` / `hooks/**` / `.claude-plugin/**`
4. **Root cause is obvious from the diff** (typo / off-by-one / null check / wrong constant) — no upstream investigation needed
5. User did NOT pass `--full` flag

If matched → light path (no investigator, no parallel A+B fan-out):

```
crew:dev-lite (mechanical 1-2 file fix, compressed diff receipt)
  ↓
crew:inspector-lite (single review pass, auto-loads stack skill from diff extensions)
  ↓ PASS (decision: approved or approved_with_notes)
mark-badge fix_complete
mark-badge inspected
```

If `inspector-lite` returns `rejected` (semantic complexity detected, MEDIUM+ finding requiring code change) → fall through to the standard ladder below (re-dispatch via investigator + FEAT tag).

If not matched → standard ladder below.

## Phase order (standard ladder)

### Triage step — pick the right investigation tool

Before dispatching anything, triage the bug report:

| Bug report state | Right dispatch |
|---|---|
| "Where is X called?" / "List every caller of Y" / "Map this module" — **location only, no causation reasoning** | `crew:investigator` (haiku, cheap, no handoff artifact, dies with turn) |
| "Why does this fail?" / "What's the root cause?" / multi-file causal reasoning / need confidence + evidence trail + reproduction path in a persistent artifact | `crew:researcher` (sonnet, scopes: normal/wide, writes findings with confidence + risks) |
| Root cause already obvious from bug report (typo, off-by-one, known regression in commit X) | **Skip both — go directly to builder** |
| Cause known, multi-site fix scope unknown | `crew:investigator` to enumerate sites, then builder |

**Common mistake:** dispatching `crew:investigator` for root cause analysis. Investigator's own prompt says: *"Refuses to suggest fixes; escalate to crew:researcher when findings must persist with confidence + risks."* The haiku model + `maxTurns: 12` + no-handoff design cannot deliver root-cause artifacts with confidence + evidence — it will die at the cap. Use researcher.

```
workspace verify + wake-up brief
   ↓
TRIAGE (table above) → investigator | researcher | skip
   ↓ optional finding artifact (researcher only — investigator output dies with turn)
specialist builder (FEAT tag → builder, same routing as /crew:build)
   ↓ PASS (builder writes handoff)
parallel fan-out — single Agent-tool message with N=2 invocations:
   Inspector A (stack-specific)     Inspector B (generalist + lens)
      diff has .cs → crew:c-sharp-reviewer   crew:inspector with lens chosen by FEAT concern:*
      diff has .ts → crew:3rdparty:typescript-reviewer   concern:security → security
      no stack match → SKIP A, B uses code-quality lens   concern:perf → performance
   ↓                                         concern:correctness (default)
   └──────────────────┬───────────────────────┘
                      ↓ aggregate both decisions
   any rejected? ─── yes ─→ retry loop below
   both approved / approved_with_notes:
     mark-badge fix_complete
     if Inspector B next field names a tests-adequacy gap → dispatch crew:qa-expert
```

No verifier dispatch. Verifier defers to `/crew:ship`.

## Auto-fix retry loop (when Inspector rejects)

Symmetric with `/crew:ship`'s auto-fix loop. When either Inspector A or Inspector B returns `rejected`:

1. Read both review-result artifacts for the aggregated FAIL findings.
2. Re-dispatch the same specialist builder with the findings as fix scope.
3. Increment retry counter.
4. Re-run the parallel inspector fan-out.
5. Retry < N (default 2 from `.claude/crew/deployment.md` `fix.retry_limit`)? Loop. Else halt.

On N exhausted:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge fix_blocked \
  --note "<aggregated FAIL summary>"
```

Escalate to user with both artifact paths + findings. Do not silently keep trying.

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
