---
kind: handoff
created_at: 2026-06-04
scope: builder-workflow-improvement
status: awaiting-user-decision
gate: option-selection
related_commits:
  - ccb7650 (v0.8.0 Bundle 1)
  - 57ee689 (Bundle 2 cost-report + CI)
  - tag v0.8.0
---
# Handoff — builder workflow improvement (decision gate)

## Objective

User observed builder hangs/pauses on wide-scope slices and asked how to incorporate uxdesigner/architect into build flow to offload work.

## Audit findings (chat turn)

Builder paused mid-dispatch on 5 of 14 session dispatches. Pause threshold around 48–55 tool uses. Builder frontmatter: `model: sonnet, effort: high, maxTurns: 40` — real cap empirically ~50.

Wide-scope slices that hit the cap had mixed concerns (skills + docs + tests + manifests) — currently all routed to single builder dispatch even though uxdesigner / architect / copywriter exist as agents.

Tools used: Read, Edit, Write, Bash, Grep — vanilla. No exotic patterns.

## Three options presented in chat

| Option | What | Effort | Trade-off |
|---|---|---|---|
| **A. Pre-dispatch decomposition** (recommend) | Lead audits slice scope → splits by role concern → parallel dispatch | 30 min | Root-cause fix; uses new roles as intended; slight token-cost overhead per agent |
| **B. Raise builder maxTurns** to 60–80 | 1-line frontmatter edit | 1 min | Treats symptom; perpetuates mono-agent bottleneck; risks context-budget exhaustion |
| **C. Pre-flight scope check** | Helper script estimating file count + line count; mandates split when > threshold | 1 h | Strong with A; redundant alone |

## Lead recommendation

**Option A** alone, with **C as future enhancement** if A's discretionary rule misses cap-hits in practice.

## Concrete rule for Option A (proposed lead.md addition)

```markdown
### Pre-dispatch decomposition rule

Before dispatching builder, audit the slice scope:

1. List files in scope.
2. Group by role concern:
   - Docs/README/CHANGELOG → copywriter
   - ADR/diagram/policy/governance/workflow → architect
   - UI flow/UX/wireframe → uxdesigner
   - Code/test/refactor/manifest → builder
3. If ≥2 groups have substantive work → split. Dispatch each role's bundle in parallel.
4. Reserve single-agent dispatches for mono-concern slices.
```

Plus a worked-example block citing this session's cap-hitters as the motivating cases.

## What's next

1. User picks A / B / C / A+C / different.
2. If A or A+C: dispatch `crew:builder` for the lead.md + workflow.md edits. ≤300 line cap on lead.md preserved (current 252).
3. Per session pattern: implement → commit → push.

## Current uncommitted state

- Working tree clean at `57ee689`.
- v0.8.0 tag live on origin.
- All session commits pushed.
- No active workflow gates.

## References

- v0.8.0 release polish handoff: `.claude/artifacts/crew/handoffs/2026-06-04-v0.8.0-release-polish-decision-gate.md`
- Per-session builder dispatch counts captured in this handoff's audit section.
- `agents/builder.md` frontmatter (maxTurns: 40).
- `agents/lead.md` has the Bundle-1-added dispatch decision rule (advisory) at lines ~50–55. The new rule would extend that with explicit "if multi-concern → split" mandate.
