---
id: FEAT-005
status: pending
priority: null
category: null
target_release: null
created: 2026-06-05
updated: 2026-06-05
depends_on: []
slices: []
derived_from: null
---
# FEAT-005: Workflow badge awareness in all subagents

Add a 'Workflow badges' section to builder, reviewer, validator, deployer, and researcher agents. Currently only lead.md documents the blocked/escalated_to_human/*_skipped badge system. Subagents that hit external blockers have no harness-level vocabulary to signal them — they just write handoffs with risks text. Adding the mark-badge CLI call + when-to-use rules to all five agents closes this gap and makes blocks surface in brief-me/wake-up automatically.