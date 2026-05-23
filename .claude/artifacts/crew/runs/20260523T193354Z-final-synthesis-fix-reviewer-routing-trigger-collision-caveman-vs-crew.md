# Final Synthesis: fix reviewer-routing trigger collision (caveman vs crew)

- Created: 2026-05-23T19:33:54.145Z
- Owner: lead-session
- Outcome: completed
- Summary: Crew /crew:review could route to caveman:cavecrew-reviewer instead of crew:reviewer because (1) commands/review.md step 7 did not name the reviewer agent, and (2) caveman declared 'review this PR' / 'review my diff' trigger phrases in its description that match the Crew review phase. Fixed with three defense layers: (a) commands/review.md step 7 now names crew:reviewer explicitly and forbids generic review agents; (b) docs/routing-table.md reviewer row names exact agent + flags the collision; (c) new .claude/engineering-os/lead.md repo override with the dispatch pattern and rationale. Saved feedback memory at C:/Users/serge/.claude/projects/C--work-mega-hero-crew/memory/feedback_reviewer_dispatch.md. All CI gates green (manifests, skills, lint, typecheck, prettier, 49 tests). Commit: ab997f5. Upstream caveman fix (narrow its description to ad-hoc spot-checks only) recommended as a follow-up not actionable from this repo.
- Changed Files / Evidence: -
- Run / Test Steps: -
- Risks: -
- Next Step: -

