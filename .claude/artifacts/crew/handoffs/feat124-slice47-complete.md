---
kind: handoff
objective: Slice SLICE-47 complete — grade + start next slice
owner: lead
slice: SLICE-47
feature: FEAT-124
phase: null
created_at: 2026-06-07
confidence: high
next_handoff: grade-and-continue
---
# Handoff — SLICE-47 complete
**Feature:** FEAT-124 · **Slice:** SLICE-47
## Objective
Slice SLICE-47 closed with acceptance criteria PASS. Capture lessons + decisions via grading, then resume Cross-Slice Continuation.
## Allowed scope
- Run `/loop:slice grade --id SLICE-47` to draft grade file.
- Edit `.claude/artifacts/loop/grades/SLICE-47-grade.md` (scores, lessons, decisions, narrative).
- Run `/loop:slice grade-write --id SLICE-47` to extract decisions + emit telemetry.
- Pick next slice via Cross-Slice Continuation HARD RULE.
## Forbidden scope
- Starting next slice before grade is written (loses self-improvement signal).
## Deliverable
- `.claude/artifacts/loop/grades/SLICE-47-grade.md` populated + grade-write'd
- Any extracted `.claude/artifacts/loop/decisions/DEC-NNN.md` files
## Changed files / evidence
- slice file (completed): `docs/ai-loop/slices/completed/SLICE_47_FEAT-124-HERO-CREW-HARD-CUT-COPYWRITER.md`
## Confidence
High — slice + feature moves atomic; spec reconciliation idempotent.
## Risks or open questions
- Grading skipped → no retrospective signal for this slice.
## Suggested next handoff
After grade-write, lead picks next slice + opens new builder handoff.