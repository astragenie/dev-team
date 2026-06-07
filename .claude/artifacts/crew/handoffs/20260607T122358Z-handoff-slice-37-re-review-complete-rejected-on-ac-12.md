# Task Handoff: SLICE-37 re-review complete: rejected on AC-12

- Created: 2026-06-07T12:23:58.370Z
- From: reviewer
- To: lead
- Objective: AC-11 is fully resolved; AC-12 rejected — installGlobal() body is 38 lines, 8 over the <=30 line SRP threshold.
- Allowed Scope:
  - Re-verify AC-11 (Result types) and AC-12 (function length) fixes in global.ts
  - installer.ts
  - crew.mjs
- Forbidden Scope: -
- Deliverable: Review result artifact: rejected, with precise line-count evidence and specific remediation path
- Changed Files:
  - scripts/lib/installer/global.ts
  - scripts/lib/installer.ts
  - scripts/crew.mjs
  - .claude/artifacts/crew/reviews/20260607T122350Z-review-result-slice-37-re-review-ac-11-pass-ac-12-still-failing-38-lines.md
- Confidence: high
- Risks: Builder self-reported ~31 lines but actual count is 38; gap is material and reproducible
- Suggested Next Handoff: crew:build fix — extract writeGlobalFiles(paths, writes) from installGlobal() to bring body under 30 lines; resubmit to reviewer

