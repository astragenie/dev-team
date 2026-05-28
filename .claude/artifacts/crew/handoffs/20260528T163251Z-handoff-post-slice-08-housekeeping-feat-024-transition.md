# Task Handoff: Post-SLICE-08 housekeeping + FEAT-024 transition

- Created: 2026-05-28T16:32:51.711Z
- From: lead
- To: lead
- Objective: Close stale FEAT-025 entry (duplicate of FEAT-004/SLICE-08, already shipped in v0.3.10), then transition to FEAT-024 in hero-crew-autonomous-loop repo
- Allowed Scope: docs/backlog/pending/FEAT-025.md (move to done); hero-crew-autonomous-loop repo (FEAT-024 work)
- Forbidden Scope: hero-crew main repo — all work here is complete at v0.3.10; no new features here
- Deliverable: FEAT-025 closed; FEAT-024 slice opened in loop repo
- Changed Files:
  - docs/backlog/pending/FEAT-025.md
  - docs/backlog/pending/FEAT-024.md
- Confidence: high
- Risks: FEAT-024 is autonomous_safe:false (cross-repo, AC linter + slice template gates) — requires human-in-loop on review; coordinate between hero-crew and hero-crew-autonomous-loop
- Suggested Next Handoff: After FEAT-025 housekeeping, write loop-repo handoff for FEAT-024

## Context

Session closed mid-decision at "what's next?" question. State at pause:

- **v0.3.10 released** — SLICE-08/FEAT-004 (noImplicitAny) complete, tagged, pushed, cache synced
- **FEAT-025** (`docs/backlog/pending/`) — stale duplicate of FEAT-004. Same objective (noImplicitAny), created before FEAT-004 was tracked in the loop backlog. Needs status update to `done` and move to `docs/backlog/done/`.
- **FEAT-024** — real next P1 item. Loop-side AC linter + slice template test gates. Lives in `hero-crew-autonomous-loop` repo. `autonomous_safe: false`.

## Next Steps

1. Update `docs/backlog/pending/FEAT-025.md` status → `done`, note it was closed as FEAT-004/SLICE-08 v0.3.10.
2. Move to `docs/backlog/done/FEAT-025.md`.
3. Commit: `chore(backlog): close FEAT-025 — shipped as FEAT-004/SLICE-08 v0.3.10`.
4. Switch to `C:/work/mega/hero-crew-autonomous-loop`.
5. Run `/loop:start` there for FEAT-024.

