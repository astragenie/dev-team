# Task Handoff: Tasks 5-7: cost-hotspot investigation scratch files (citylive, authentic, hcal)

- Created: 2026-06-02T21:48:02.651Z
- From: researcher
- To: lead
- Objective: Read-only triage of three cost-report hotspots complete; 3 scratch findings files written under hero-crew/.claude/artifacts/crew/handoffs/ for Tasks 8-10 aggregation.
- Allowed Scope:
  - Tasks 5-7 of docs/superpowers/plans/2026-06-02-consumer-bump-and-investigation.md: read cost reports + cost-advise in citylive
  - authentic
  - hcal; check sourceProject directories; write scratch files.
- Forbidden Scope: -
- Deliverable: 3 scratch investigation files: 20260602T170000Z-investigation-citylive-scratch.md, 20260602T170001Z-investigation-authentic-scratch.md, 20260602T170002Z-investigation-hcal-scratch.md
- Changed Files:
  - .claude/artifacts/crew/handoffs/20260602T170000Z-investigation-citylive-scratch.md
  - .claude/artifacts/crew/handoffs/20260602T170001Z-investigation-authentic-scratch.md
  - .claude/artifacts/crew/handoffs/20260602T170002Z-investigation-hcal-scratch.md
- Confidence: high
- Risks: 1. hcal file_reread_count frontmatter field is absent — the 32.7-avg/315-max expectation from pre-analysis is unconfirmed; reread data only available in cost-advise bodies, not sortable by frontmatter. 2. Authentic USD-missing expectation (9/10) is contradicted by evidence — all 65 reports have usd field; the real hotspot is the 90 SLICE-052 spike. 3. citylive cost-advise references FEAT001 SLICE01, not the slice that triggered it — advise targeting may be misaligned. 4. hcal CREW_COST_HYGIENE check: grep of *.jsonl returned no match but only session-level grep was run, not a full env-var scan.
- Suggested Next Handoff: Tasks 8-10: lead or builder reads the 3 scratch files and writes docs/investigations/2026-06-02-consumer-cost-hotspots.md filling in the evidence from these scratch files.

