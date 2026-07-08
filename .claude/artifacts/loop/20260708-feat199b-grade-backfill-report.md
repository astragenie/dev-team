---
kind: backfill-report
feature: FEAT-199b
ac: AC-3
created: 2026-07-08
---

# FEAT-199b AC-3 — grandfathered grade backfill report

## Summary

- **Work set:** 22 grandfathered grade files reported by `node ./scripts/validate-syntheses.ts .` (`grandfatheredGradeRot` list) as of 2026-07-08.
- **Regenerated (real, source-cited content):** 22
- **Unrecoverable (annotated, not fabricated):** 0
- **Post-backfill validator result:** `node ./scripts/validate-syntheses.ts .` reports 0 grandfathered grade files and 0 grade_incomplete errors. (The pre-existing, separately-tracked final-synthesis `stale placeholder` errors — ~70 files matching `/Grade missing/` or `/<timestamp>/` — are untouched; they are a different check, out of AC-3's grade-only scope.)

Every one of the 22 files had enough real, on-disk evidence (an independent review artifact, a validation artifact, a builder handoff with concrete gate results, a deployment artifact, or — for 5 files — only a self-reported but genuine git commit message) to regenerate honestly. None were fabricated; where evidence was thin (5 perf-win slices with no independent review), scores were kept in the 0.35–0.65 band and the gap was stated explicitly in the file's own "Inference sources" and "What went wrong" sections rather than papered over.

## Per-file detail

| Grade file | Slice | Feature | Action | Primary sources cited |
|---|---|---|---|---|
| `20260607T095232Z-slice17-grade.md` | SLICE-17 | FEAT-037 | regenerated | commit `1471a9a1` (self-reported only — no review/validation artifact exists) |
| `20260607T100006Z-slice18-grade.md` | SLICE-18 | FEAT-046 | regenerated | 4 task-level reviews (task-1/2/5, tasks-3-4 rev2, all approved) + 2 validations (task-2, task-5, both PASS) + builder handoff |
| `20260607T101427Z-slice19-grade.md` | SLICE-19 | FEAT-101 | regenerated | commit `056cd46e` (self-reported only); flagged that `DEC-007.md` is itself unfilled template rot (out of grade-only scope) |
| `20260607T101648Z-slice20-grade.md` | SLICE-20 | FEAT-102 | regenerated | commit `1e7f2555` (self-reported only); flagged `DEC-008.md` rot |
| `20260607T102100Z-slice21-grade.md` | SLICE-21 | FEAT-103 | regenerated | commit `d7c4b2df` (self-reported only); flagged `DEC-009.md` rot |
| `20260607T102346Z-slice22-grade.md` | SLICE-22 | FEAT-104 | regenerated | commit `5df9bee7` (self-reported only); flagged `DEC-010.md` rot |
| `20260607T225439Z-slice46-grade.md` | SLICE-46 | FEAT-124 | regenerated | review (rejected — manifest version gap) + deployment artifact confirming fix + PASS release v0.29.0 |
| `20260607T231914Z-slice47-grade.md` | SLICE-47 | FEAT-124 | regenerated | review (rejected, 3 RED findings, no re-review artifact found) + downstream design-doc citing this slice's rejection as root cause for later tooling; current-repo grep confirms end-state matches the fix |
| `20260608T053717Z-slice48-grade.md` | SLICE-48 | FEAT-126 | regenerated | review (approved_with_notes) |
| `20260608T161934Z-slice50-grade.md` | SLICE-50 | FEAT-126 | regenerated | review (approved, 0 findings) |
| `20260608T163558Z-slice51-grade.md` | SLICE-51 | FEAT-125 | regenerated | review (approved_with_notes, non-code); review itself flagged the slice-file template rot in real time |
| `20260608T164429Z-slice52-grade.md` | SLICE-52 | FEAT-122 | regenerated | review (approved_with_notes) |
| `20260608T165157Z-slice53-grade.md` | SLICE-53 | FEAT-123 | regenerated | review (approved_with_notes, non-code) |
| `20260608T213443Z-slice54-grade.md` | SLICE-54 | FEAT-029 | regenerated | review (approved_with_notes) + retroactive validation (PASS, run 2 days after implementation because the slice was never formally closed) |
| `20260608T214000Z-slice55-grade.md` | SLICE-55 | FEAT-127 | regenerated | review (approved, 0 findings) + retroactive validation (PASS with one noted minor AC gap: no direct unit test on the refactored helpers) |
| `20260608T214729Z-slice56-grade.md` | SLICE-56 | FEAT-128 | regenerated | review (approved_with_notes) + retroactive validation (PASS); both independently flagged the same untested failure-path gap |
| `20260608T215652Z-slice57-grade.md` | SLICE-57 | FEAT-129 | regenerated | review (approved, 0 findings, reviewer independently re-ran the full test suite) |
| `20260629T111628Z-slice107-grade.md` | SLICE-107 | FEAT-184 | regenerated | review (approved_with_notes, 1 MEDIUM AC-5 gap) + validation (passed_with_notes, confirms the MEDIUM gap was fixed before merge) + joint AC-3/AC-4 live-baseline artifact |
| `20260629T122311Z-slice108-grade.md` | SLICE-108 | FEAT-185 | regenerated | review (approved_with_notes, 1 MEDIUM dead-field finding, explicit security sweep 0 findings) + joint AC-3/AC-4 live-baseline artifact |
| `20260629T170523Z-slice94-grade.md` | SLICE-94 | FEAT-170 | regenerated | combined builder/lead handoff with per-AC verdict table + concrete gate results (no independent review/validation artifact found) |
| `20260629T170602Z-slice95-grade.md` | SLICE-95 | FEAT-170 | regenerated | same combined handoff as SLICE-94 |
| `20260707T153820Z-feat193-slice109-grade.md` | SLICE-109 | FEAT-193 | regenerated | S2 review (rejected → fixed → re-approved) + S3 review (approved, fixed once, re-approved with 0 findings) |

## Method

For each file: identified the slice/feature from filename + frontmatter, then searched `.claude/artifacts/crew/{reviews,validations,runs,cost,handoffs,deployments}/` and `.claude/artifacts/loop/{slices/completed,backlog/done,decisions}/` for matching artifacts by slice id / feature id / timestamp proximity. Where an independent review or validation artifact existed, scores were derived directly from its cited evidence (test counts, specific findings, PASS/FAIL/approved/rejected verdicts). Where none existed, the only real source was the implementation commit's own message (test counts, files touched, lint status) — these 5 slices (SLICE-19/20/21/22 and, more weakly, SLICE-17) were scored conservatively (0.35–0.65 band) with the absence of independent verification stated explicitly rather than silently assumed away.

Two known pre-existing auto-prefill errors were caught and corrected during this pass (not trusted as-is):
- SLICE-50's old frontmatter cited SLICE-49's review artifact for its `test_confidence` score (off-by-one slice mismatch).
- SLICE-46's old frontmatter cited a manifest-version review for a `security` score, and SLICE-47's old frontmatter cited an unrelated deployment artifact for `production_readiness` — neither citation matched what the cited artifact actually said.
- SLICE-109's old frontmatter cited a SLICE-107/108 validation artifact for its own `observability` score, despite that artifact never mentioning SLICE-109.

These mismatches reinforced the "never fabricate, always re-derive from primary evidence" approach for this backfill rather than trusting or extending the earlier partial auto-prefill.

## Validator self-verification

```
$ node ./scripts/validate-syntheses.ts .
(no grandfatheredGradeRot lines — 0 remaining)
(stale-placeholder errors listed are all final-synthesis files, unrelated to AC-3's grade-only scope)
```

One interaction issue surfaced and was fixed without weakening the rot detector: an early draft of the SLICE-19 regeneration quoted the literal template placeholder text (`Short decision title`) while *describing* the rot in a sibling `DEC-007.md` file — this tripped `GRADE_DECISION_TITLE_PLACEHOLDER` even though the grade file itself was fully filled in. Fixed by rephrasing the description to refer to "the grade template's unrendered decision-title placeholder" without reproducing the exact trigger string. No validator changes were needed or made.

## Scope confirmation

`git status --short` shows exactly 22 modified files, all under `.claude/artifacts/loop/grades/`, plus this report — no other files touched.
