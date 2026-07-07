---
id: FEAT-188-S5
feat: FEAT-188
status: completed
created: 2026-07-07
title: FEAT-188 S5 — eval interaction + memory hygiene
autonomous_safe: false
risk_band: 0.4
estimated_loc: 940
estimated_files: 13
completed_at: 2026-07-07
updated: 2026-07-07
---
# FEAT-188-S5: Eval interaction + memory hygiene

## Intent

Close the remaining S2/S4 hygiene gaps in the MemoryProvider capture/recall loop
and add the with/without-memory GEPA judge-score-delta measurement: (1)
astramem<->JSONL drift-check + backfill so the fire-and-forget astramem
source-of-truth can be reconciled against its synchronous JSONL duplicate; (2)
the `fileProvider.recall()` tail-read window fix (S2 review MEDIUM note — was
reading only the last 64KB of `learnings.jsonl`); (3) 45-day recall decay with
critical-exempt and unconditional exclusion of superseded/invalidated entries;
(4) a `--live`-gated GEPA fixture measuring judge-score delta with vs without
the injected memory block.

## Scope

- `scripts/lib/memory/drift-check.ts` (new) — compares JSONL entries against
  astramem over a window and reports/backfills gaps; best-effort, fails closed.
- `scripts/lib/memory/file-provider.ts` — raise `tailReadJsonl` window from
  64KB to 16MB/unbounded record cap.
- `scripts/lib/memory/ranking.ts` — 45-day decay (critical-exempt);
  superseded/invalidated never recalled regardless of age.
- `scripts/lib/memory/astramem-provider.ts` — optional `RemoteLoaderOverrides`
  test seam only; production transport path unchanged (DEC-172: plugin/MCP,
  no `resolveCli`, no hand-rolled HTTP).
- `evals/memory-delta.ts` (new) — with/without-memory GEPA judge-score-delta
  harness, `--live` gated per the SLICE-107/FEAT-184 AC-3 operator-credential
  pattern (defaults to a safe stub print, no faked score, when no credential
  is present).
- `scripts/lib/memory/index.ts`, `scripts/crew.ts`, `package.json` — wiring.
- Tests: `tests/memory-capture-sigkill-parity.test.ts` (new),
  `tests/memory-drift-check.test.ts` (new),
  `tests/memory-provider-decay.test.ts` (new),
  `tests/memory-provider-astramem-resolver.test.ts` (new),
  `tests/memory-provider-file.test.ts` (+tail-window case).

## Acceptance criteria

- [x] **AC-1: Capture-parity golden test incl. SIGKILL.** Given a capture is
  issued and the process is SIGKILLed mid-capture-loop, When the JSONL store
  is inspected afterward, Then every line parses and `recall()` never throws
  (corruption-free or safely dropped). Verified by
  `tests/memory-capture-sigkill-parity.test.ts` (spawns a real Bun child
  process and SIGKILLs it mid-loop).
- [x] **AC-2: With/without-memory GEPA judge-score-delta fixture.** Given one
  GEPA v1 agent's eval fixture run with vs without the injected memory block,
  When judge scores are compared, Then the delta is measured and reported.
  Implemented in `evals/memory-delta.ts`; the live-judge comparison itself is
  `--live` gated on an operator credential (e.g. `GROQ_API_KEY`) and deferred
  in this review, matching the FEAT-184/SLICE-107 AC-3 precedent — the
  harness code and stub-mode behavior are verified, the live numeric delta is
  not yet captured.
- [x] **AC-3: 45-day recall decay, critical-exempt.** Given an entry older
  than 45 days and not `critical`, When `recall()` runs, Then it is excluded;
  given superseded/invalidated, Then it is never returned regardless of age.
  Verified by `tests/memory-provider-decay.test.ts` (5 cases incl. the 44/46
  day boundary, and independent critical/supersede/invalidate exclusions).
- [x] **AC-4 (S2 review MEDIUM note): tail-read full-window fix.** Given a
  large `learnings.jsonl` store, When `fileProvider.recall()` runs, Then it no
  longer silently misses entries older than the previous 64KB tail window (now
  16MB/unbounded record cap). Verified by
  `tests/memory-provider-file.test.ts` (+ buried-critical-entry case).
- [x] **AC-5 (S4 review accepted-risk note): astramem<->JSONL drift
  detection.** Given astramem writes are fire-and-forget and the JSONL append
  is synchronous, When `drift-check.ts` runs, Then it compares JSONL entries
  against astramem over a window and surfaces/backfills entries missing from
  astramem, so the source-of-truth can be reconciled against the derived
  duplicate. Verified by `tests/memory-drift-check.test.ts` (fails closed on
  error, never calls `remember()`/writes beyond the reconciliation path).

## Out of scope

- Cross-repo S1b/S3b (runner-plugin) — separate slices, separate repo/session.
- Promoting `evals/memory-delta.ts`'s live-judge comparison to a blocking CI
  gate — stays an operator-run, `--live`-gated harness for now.

## Risks

- `evals/memory-delta.ts`'s judge-score-delta AC is only exercised with an
  operator-supplied live judge credential via `--live` — explicitly documented
  in-file, not a silent gap, but unverified as of the review that motivated
  this slice-close.
- `drift-check.ts`'s presence check is a semantic `recall()`-based
  approximation, not an exact id lookup — called out in the code's own doc
  comment as a known limitation, scoped as a diagnostic rather than an
  authoritative reconciliation tool.

## Closing notes

This slice file is reconstructed post-implementation (mirrors the
`SLICE-95_feat-170-slice-d.md` precedent) to satisfy the runner's
slice-complete schema — FEAT-188's slices (S1a, S1b, S2, S3a, S3b, S4, S5, S6)
were authored and built directly against the FEAT body's acceptance criteria
rather than run through `slice from-feature` / `slice plan`. The actual code
landed in `7787fe02 feat(memory): FEAT-188 S5 — eval interaction + hygiene`,
merged to main as `79bc2e44 Merge FEAT-188 S5 — eval interaction + memory
hygiene`. Independent review: approved_with_notes
(`.claude/artifacts/crew/reviews/20260707T075143Z-review-result-feat-188-s5-review.md`).
FEAT-188 parent stays in-progress: only cross-repo S1b/S3b (runner-plugin)
remain.
