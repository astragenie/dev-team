# Task Handoff: FEAT-193 S2/S3 build-ready slice plan (human review required)

- Created: 2026-07-07T12:31:52.493Z
- From: researcher
- To: dispatcher
- Objective: FEAT-193 S1 shipped (2 commits, dual-write failure->trial bridge); S2 (cross-repo corpus aggregation) and S3 (human analyze-gate report) have no Given-When-Then ACs yet and no code exists — plan below is ready for human approval before /crew:build dispatch.
- Allowed Scope:
  - Read-only: located FEAT-193.md
  - traced S1 git history
  - mapped corpus storage surface (gepa trials
  - learnings.jsonl
  - MemoryProvider)
  - proposed S2/S3 file-level slice breakdown. No code or backlog files edited.
- Forbidden Scope: -
- Deliverable: Concrete S2 (gepa-corpus-sync) and S3 (gepa-corpus-report) slice plans: new modules, dedup contract, human-gate point, dependencies, and risk list — see full body below.
- Changed Files:
  - .claude/artifacts/loop/backlog/pending/FEAT-193.md
  - scripts/lib/gepa/capture-failure-trial.ts
  - scripts/lib/gepa/capture-failure-trial-guard.ts
  - scripts/lib/gepa/capture-tee.ts
  - scripts/lib/gepa/champion-provenance-writer.ts
  - scripts/lib/memory/drift-check.ts
  - .claude/artifacts/crew/gepa/trials/frontend-dev.jsonl
  - .claude/artifacts/loop/learnings.jsonl
- Confidence: medium
- Risks: S2/S3 ACs are thin (bullet points, not Given-When-Then) per the FEAT's own triage_notes — a human must draft real ACs before /crew:build dispatch, this plan is not a substitute. Two inherited open risks from S1 block S2/S3 safely consuming the corpus: (1) capture-failure-trial-guard.ts Promise.race does not bound real OS wall-time (dynamic import uncancellable), latent only while gepa-core resolves to 0.7.0 compiled dist; (2) fireCaptureTeeSilent in scripts/lib/artifacts/write.ts has zero timeout protection (review Required Follow-up #2, still unaddressed). champion-provenance-writer.ts dual-frontmatter bug blocks S3 auto-promote wiring. No sibling-repo inventory available in this read-only pass — S2 dedup contract unverified in practice, only in spec text.
- Suggested Next Handoff: Human reviews this plan + drafts Given-When-Then ACs for S2 and S3, then promotes FEAT-193 pending->triaged and dispatches S2 via /crew:build once ACs exist. S3 should NOT be dispatched autonomously — a human must review the digest/report output before gepa-optimize + promote runs downstream.

