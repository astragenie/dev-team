---
feature: FEAT-158
status: active
---
# Run Brief: FEAT158 SLICE74: Move lead policy to workflow skills (lead.md slim-down)

- Created: 2026-06-13T17:43:43.618Z
- Tier: full
- Goal: Relocate four high-volume policy blocks out of `agents/lead.md` (currently **369 lines**, FEAT description's "278" is stale) into four new `skills/workflow/` skills, preserving the exact routing decisions verbatim. Target: lead.md ≤ **200 lines** after relocation; lead.md becomes the identity + Golden Path + cross-cutting boundary anchor, and the moved policy blocks become Skill-tool-loadable procedures.  This is **pure relocation** — no new orchestration features, no semantic change to routing 
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - 1. **Create 4 new workflow skills** under `skills/workflow/`:
   - `skills/workflow/lead-routing/SKILL.md` — relocates lead.md L161–190
     (`## Agent quick reference` table + Architect-mandatory note + the
     specialist routing examples paragraph).
   - `skills/workflow/risk-tier/SKILL.md` — relocates lead.md L130–142
     (`## Risk-based tier` lookup table + registry-fallback note) AND
     L144–150 (`## SLA caps` table — folded into the same skill because
     SLA caps are tier-derived). Confidence aggregation (L304–323) is
     ALSO folded here under a `## Confidence aggregation` section because
     the tier floors (LOW ≥0.6 / MEDIUM ≥0.7 / HIGH ≥0.8) are
     tier-keyed.
   - `skills/workflow/fan-out-review/SKILL.md` — relocates lead.md
     L153–159 (`## Fan-out review` paragraph
- Out Of Scope:
  - - **`delegation` skill (the 5th FEAT-158 candidate).** The
  `## Delegation thresholds` block + `### Model exception list`
  (L325–339
  - ~15 lines) is left in `agents/lead.md` this slice. Smaller
  block + tightly coupled to lead identity (cost discipline framing).
  If the post-slice count is still >200
  - add a follow-up FEAT to relocate
  it; the four skills shipped here are enough to clear the ba
- Planned Files: -
- Next Step: Begin implementation

