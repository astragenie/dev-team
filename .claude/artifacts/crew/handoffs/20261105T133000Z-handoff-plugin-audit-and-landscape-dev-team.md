# Task Handoff: Crew plugin audit + GitHub landscape research + Codex cross-review

- Created: 2026-11-05T13:30:00Z
- From: dispatcher (main session, Fable 5.1)
- To: owner (user) / next session in `astragenie/dev-crew`
- Objective: audit the crew plugin for defects and drastic-improvement opportunities; research what shipped on GitHub in the same space May to Nov 2026 and what to adopt; obtain an independent Codex review of the synthesis.
- Owner: dispatcher
- Allowed Scope: read-only audit of `agents/ commands/ hooks/ scripts/ skills/ tests/ docs/ .claude/`; web research; artifacts under `.claude/artifacts/crew/`; `docs/memory.md` write-back.
- Forbidden Scope: any edit to product source, commits, pushes. Honoured.
- Deliverable:
  - `.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md` (synthesis: 53 ranked findings, measurements, 11 research areas, 3-horizon plan, Codex section, revised Horizon 1 order)
  - `.claude/artifacts/crew/reviews/20261105T132500Z-codex-review-of-plugin-audit.md` (Codex verbatim)
  - `.claude/artifacts/crew/reviews/20261105-audit-sources/` (16 per-agent reports)
  - `.claude/artifacts/crew/runs/20261105T000000Z-run-brief-plugin-audit-and-landscape.md`
  - `docs/memory.md` "Current release" entry superseded (archive status, devcrew successor, skill count 71, modelRouting disabled)
- Changed Files: only the artifacts above and `docs/memory.md`. Pre-existing untracked: `.gitleaks.toml` (staged), `scripts/windows/`, one July handoff.
- Confidence: medium-high on the repo findings (Codex confirmed 13 of 17 spot-checked, overstated 3, count-corrected 1); medium on landscape research (each researcher marked UNVERIFIED items; star counts look inflated ecosystem-wide); low on devcrew cross-check (grep-level only, no devcrew test run).
- Risks / open questions:
  1. Repo is archived; all fixes belong in `astragenie/dev-crew`, which has no local checkout.
  2. Skill auto-discovery in an installed consumer repo was never verified live (finding #19).
  3. Fresh-cache `node_modules` crash (#41) reproduced on a copy by the scripts auditor, not by Codex.
  4. Six P1 items came only from Codex (#48 to #53); re-verify #51 (last-writer-wins review state) with a test before fixing.
  5. Codex's first pass timed out at 580 s; the verdict came from a resumed session at medium effort.
- Suggested Next Handoff: clone `astragenie/dev-crew`, open defect tickets for Horizon 1 items 1 to 5 in the revised order (CI exemption, gate verdict aggregation, builder pre-review publish, packaging smoke test, broken references), then `/crew:fix` per ticket with the audit row as the acceptance criterion.
