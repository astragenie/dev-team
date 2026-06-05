# Review Result: FEAT-046 Tasks 3-4: agent prompt edits

- Created: 2026-06-05T11:21:49.208Z
- Reviewer: reviewer
- Decision: rejected
- Summary: Three defects block commit: DONE_WITH_CONCERNS has no harness mechanism, standard tier missing from lead.md model mapping, and a formatting break before ## Context efficiency.
- Evidence Checked:
  - agents/builder.md lines 166-175 read; agents/lead.md lines 252-262 read; scripts/lib/scope-estimate.mjs tier thresholds verified (light/standard/heavy); scripts/crew.mjs mark-badge enum confirmed (no DONE_WITH_CONCERNS badge); write-handoff flags confirmed (no --concerns); validate-agents.mjs run (9 OK); FEAT-046.md AC-2/AC-3 verified; scope-estimate CLI exercised
- Files Reviewed:
  - agents/builder.md
  - agents/lead.md
- Test Adequacy: 376/376 pass, validate-agents OK — both files within 300-line cap (builder=201, lead=299)
- Risks: DONE_WITH_CONCERNS is a convention-only string with no CLI enforcement path; builder has no concrete command to fulfill steps 1-2; standard tier (most common real-world case) has no model guidance in lead.md
- Required Follow-up: 1) Add blank line before ## Context efficiency in lead.md. 2) Add standard→Sonnet mapping to lead.md line 260. 3) Either wire DONE_WITH_CONCERNS as a concrete mark-badge value and --concerns flag on write-handoff, OR reword builder.md step 1 to use an existing mechanism (e.g. mark-badge blocked + note) and step 2 to put ceiling detail in handoff --risks.

