---
kind: handoff
slice: SLICE-94 + SLICE-95
feat: FEAT-170
from: fullstack-dev
to: lead
status: complete
created: 2026-06-29
---

# FEAT-170 SLICE-94 + SLICE-95 — handoff

## Deliverable

Both slices shipped on feature branch `refactor/feat-170-routing-and-ci-gate`.

### SLICE-94 — routing fix
- **Commit:** `aa00c98 feat(routing): SLICE-94 — add TS_TOOLING_ONLY signal + pure-TS-tooling BE-default routing`
- **Files:**
  - `scripts/lib/slice-shape-classify/` — `TS_TOOLING_ONLY` signal added; classifier defaults pure-TS-tooling slices to `backend-dev`
  - `docs/routing-table.md` — new row documenting BE-default
  - `CLAUDE.md` — routing note refresh
  - Slice-shape classifier unit tests — BE-default for pure-TS, fullstack-dev for mixed BE+FE

### SLICE-95 — CI regression gate
- **Commit:** `9a0076a feat(ci): SLICE-95 — label-gated eval regression workflow + CI promotion plan doc`
- **Files:**
  - `.github/workflows/agent-eval-regression.yml` — label-gated workflow (trigger: `run-evals` label on PR)
  - `docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` — extended with "CI promotion plan" section
- **Promotion timeline:** advisory-first; promote to blocking after 2-week stability baseline (`2026-07-13` checkpoint)

## PR
- **#130** — `https://github.com/astragenie/dev-team/pull/130`
- Base: `main`, head: `refactor/feat-170-routing-and-ci-gate`
- Title: `feat(routing+ci): FEAT-170 SLICE-94 + SLICE-95 — pure-TS-tooling BE-default + eval regression CI gate`

## Per-AC verdict

Per the FEAT-170 body's per-slice decomposition table:

- **SLICE-94 (C):** routing classifier defaults pure-TS-tooling slices to backend-dev ✅
- **SLICE-95 (D):** `.github/workflows/agent-eval-regression.yml` exists, label-gated, advisory ✅

## Gates

- `bun run lint` — 0 warnings ✅
- `bun run format:check` — clean ✅
- `bun run typecheck` — clean ✅
- `bun run test` — 1047 pass / 117 skip / 0 fail ✅
- `bun run evals --dry-run --prompt fullstack-dev` — no regression vs SLICE-93 baseline ✅

## Carry-forward

1. **2-week stability window** before promoting the CI gate from advisory to blocking. Checkpoint: `2026-07-13`.
2. **Live judge upgrade:** workflow currently runs `--dry-run`. Promote to live judge when FEAT-171's `--candidate-live` is wired into the eval framework (FEAT-171 closed but `--candidate-live` glue may still need surface area in the workflow).
3. **Operator action:** review + merge PR #130 (autonomous_safe=false because SLICE-94 touches routing surface that affects all builders).

## Risks

- Routing change is **additive** (new default for narrow `TS_TOOLING_ONLY` case); cross-layer slices route to `fullstack-dev` unchanged. Backward routing compatibility preserved.
- CI gate is advisory; if it fires noisy false-positives during the 2-week baseline, demote / refine before promotion.

## Handoff context

Builder hit cutoff after both commits landed but before PR open or handoff write. Main thread (lead) finished the post-commit ceremony: branch push, PR #130 open, this handoff artifact.

## Next handoff

Operator reviews PR #130 → merge → `/loop:slice complete --id SLICE-94` then `--id SLICE-95` (close ceremonies for both). FEAT-170 status moves triaged → done after both slices close.
