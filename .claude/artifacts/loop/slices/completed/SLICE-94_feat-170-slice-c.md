---
id: SLICE-94
feat: FEAT-170
status: completed
created: 2026-06-21
title: FEAT-170 SLICE-C — routing classifier surfaces FE_ONLY + BE_ONLY signals; orchestrator routes specialists
autonomous_safe: false
risk_band: 0.35
estimated_loc: 250
estimated_files: 4
line_budgets: ["{ path: \"scripts/orchestrate-slice-classify.ts\", max: \"+10 (FE_ONLY/BE_ONLY signals)\" }", "{ path: \"commands/orchestrate-slice.md\", max: \"+25 (replaced dispatch rules block)\" }", "{ path: \"docs/routing-table.md\", max: \"+20 (builder routing matrix callout)\" }", "{ path: \"tests/orchestrate-slice.test.ts\", max: \"+85 (4 new classifier tests)\" }"]
completed_at: 2026-06-29
updated: 2026-06-29
---
# SLICE-94: FEAT-170 SLICE-C — routing classifier surfaces single-stack signals

## Intent

Update the slice classifier to expose `FE_ONLY` and `BE_ONLY` signals alongside `SPLIT_BUILD`. Update orchestrate-slice.md Step 3 dispatch rules to use the new signals to default-route single-stack slices to specialist builders (`crew:backend-dev`, `crew:frontend-dev`), reserving `crew:fullstack-dev` for genuinely untagged or cross-layer slices.

`autonomous_safe: false` because routing surface affects every future slice dispatch — wide blast radius.

## Files touched

| Path | Action | Notes |
|---|---|---|
| `scripts/orchestrate-slice-classify.ts` | edit | Add `FE_ONLY` + `BE_ONLY` to the return shape. Compute: FE_ONLY = `FE && !BE && !SPLIT_BUILD`, BE_ONLY = `BE && !FE && !SPLIT_BUILD`. |
| `commands/orchestrate-slice.md` | edit | Replace Step 3 "Dispatch rules" block with new builder routing matrix using `FE_ONLY` / `BE_ONLY` / `SPLIT_BUILD` / untagged signals. Reserve fullstack-dev for untagged slices. |
| `docs/routing-table.md` | edit | Add "Builder routing matrix (FEAT-170 SLICE-C)" callout at top with the matrix table. |
| `tests/orchestrate-slice.test.ts` | edit | Add 4 new tests: BE_ONLY true on backend-only slice, FE_ONLY true on frontend-only slice, both false on untagged slice, both false when SPLIT_BUILD true. |

## Acceptance criteria

1. `classifySlice()` returns object including `FE_ONLY: boolean` and `BE_ONLY: boolean`.
2. `FE_ONLY = true` when slice has `surface:ui` or `stack:react` tag AND no BE tag AND `SPLIT_BUILD = false`.
3. `BE_ONLY = true` when slice has `surface:api` / `surface:schema` / `stack:csharp` / `stack:node` / `stack:python` AND no FE tag AND `SPLIT_BUILD = false`.
4. Both `FE_ONLY` and `BE_ONLY` are `false` when `SPLIT_BUILD = true` (mutual exclusion).
5. Both `FE_ONLY` and `BE_ONLY` are `false` when slice has no surface/stack tags (legitimate fullstack-dev case).
6. `tests/orchestrate-slice.test.ts` passes ≥20 tests (was 16 — added 4).
7. `commands/orchestrate-slice.md` Step 3 dispatch rules document specialist routing for FE_ONLY + BE_ONLY.
8. `docs/routing-table.md` carries the builder routing matrix at the top of the file.
9. All CI gates green: validate-manifests, validate-skills (65), validate-agents (18), validate-slices, lint, format:check, typecheck.

## Constraints

- **Additive only.** Do not change `SPLIT_BUILD` semantics. Existing dispatches that work today continue to work.
- **Backward compat.** Untagged slices keep routing to `crew:fullstack-dev` (the legitimate generalist case).
- **No agent prompt edits.** Builders' own prompts (`agents/backend-dev.md`, `agents/frontend-dev.md`, `agents/fullstack-dev.md`) untouched — the routing decision lives in the orchestrator, not the builder prompts.
- **No new deps.** No npm install.
- **No commits.** dev.stable: false. User reviews and commits manually.

## Out of scope

- Live re-eval of fullstack-dev under new routing (FEAT-171 candidate dispatch unblocks proper eval).
- CI regression gate → SLICE-D.
- Routing for review/validate/deploy phases — unchanged.

## Forbidden

- Modifying any `agents/*.md` file.
- Modifying `scripts/validate-*.ts`.
- Adding npm dependencies.
- Auto-commit. dev.stable: false.
- Release ceremony.
