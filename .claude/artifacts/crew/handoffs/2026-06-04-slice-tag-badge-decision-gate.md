---
kind: handoff
created_at: 2026-06-04
scope: slice-tag-badge-frontmatter
status: awaiting-user-decision
gate: option-selection
related_commits:
  - fea5e8b (lead pre-dispatch decomposition rule)
---
# Handoff — slice tag/badge frontmatter (decision gate)

## Objective

User asked whether adding type/domain badges to triaged slices (ux, c#, api, doc-writing) makes sense, and what badges loop already emits.

## Audit findings (chat turn)

**Current loop frontmatter on FEATs:**
- `priority` (P0–P3)
- `category` (12 values observed: foundation, feature, docs, governance, observability, performance, quality, quality-gate, skill, tooling, types, workflow)
- `target_release`
- `autonomous_safe`
- `phase`
- `depends_on`, `slices`, `derived_from`
- `github_issue` / `github_milestone` (optional)

**PM-triage scoring:** 5 dimensions per `loop:pm-triage` skill — customer demand, strategic alignment, technical complexity, cost/ROI, risk.

**Gap:** `category` is workflow-flavored, not role-flavored. Nothing today tells the lead *which agent* should pick up the FEAT. The pre-dispatch decomposition rule (`fea5e8b`) still requires manual file-by-file audit at slice-start.

## Four options presented

| # | Option | Effort | Trade-off |
|---|---|---|---|
| 1 | **`suggested_agent:` enum** (builder / architect / uxdesigner / copywriter / researcher / multi) — recommended | 2–3h | Single new field; directly automates the pre-dispatch decomposition rule |
| 2 | `tags: []` array (stack + surface + concern) | 3–5h | Multi-tag flexibility; useful for backlog filtering; overkill until reporting need is concrete |
| 3 | Extend existing `category:` enum with domain values | 1–2h | No new field; overloads category (mixes workflow-concept + stack-concept) |
| 4 | Status quo | 0 | Pre-dispatch rule remains manual every slice |

## Lead recommendation

**Option 1** — single new `suggested_agent` field, computed by `loop:pm-triage` from FEAT description + linked SPEC content. Smallest schema delta, biggest impact on dispatch quality. Pairs cleanly with the just-shipped pre-dispatch decomposition rule. Option 2 is the additive upgrade path if filtering becomes a real need later.

## What's next

1. User picks 1 / 2 / 3 / 4 / hybrid.
2. If 1: dispatch `crew:builder` to extend `loop:pm-triage` agent logic + add `suggested_agent` field to FEAT validator + write tests + spec doc.
3. Per session pattern: implement → commit → push.

## Current uncommitted state

- Working tree clean at `fea5e8b`.
- v0.8.0 tag live on origin.
- No active workflow gates.

## References

- Pre-dispatch decomposition rule commit: `fea5e8b`.
- Builder-workflow-improvement handoff: `.claude/artifacts/crew/handoffs/2026-06-04-builder-workflow-improvement-decision-gate.md` (parent context).
- Existing FEAT frontmatter shape: `docs/backlog/done/FEAT-001.md`.
- `loop:pm-triage` skill: triages all pending FEATs across 5 dimensions; current output sets `priority` + `autonomous_safe` + moves pending→triaged.
