# Run brief — Crew plugin audit + GitHub landscape research

- Created: 2026-11-05
- Dispatcher: main session (Fable 5.1)
- Objective: (1) audit the crew plugin (agents/commands/hooks/scripts/skills/tests/docs) for issues and drastic-improvement opportunities; (2) fan out up to 10 researchers on what shipped on GitHub in the same space (Claude Code plugins, multi-agent coding orchestration, autonomous loops, review gates, evals, cost/observability, memory, guardrails, competing harnesses) and what to adopt; (3) send the synthesized report to Codex for independent review.
- Mode: team run, read-only. No source edits. Artifacts only.
- Context caveat: repo archived 2026-08-19, superseded by astragenie/dev-crew (subtree prefix `crew/`, tag `pre-devcrew-baseline`). dev-crew is not checked out locally. Findings here are portable to dev-crew's `crew/` subtree.
- Owners: 6 audit agents (agents, commands, hooks, scripts/lib, skills, tests+CI+docs+telemetry); 10 research agents; dispatcher synthesizes; Codex reviews.
- Deliverable: `.claude/artifacts/crew/reviews/<ts>-plugin-audit-and-landscape.md` + Codex review artifact.
