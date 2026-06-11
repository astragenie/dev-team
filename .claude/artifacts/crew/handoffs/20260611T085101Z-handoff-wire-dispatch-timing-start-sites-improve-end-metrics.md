# Task Handoff: Wire dispatch-timing start sites + improve end metrics

- Created: 2026-06-11T08:51:01.915Z
- From: builder
- To: lead
- Objective: Adds PreToolUse Agent hook to fire recordDispatchStart so dispatch-timing.jsonl is populated; improves end tap to parse coarse usage metrics from subagent return body.
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - hooks/lib/dispatch-timing-pre-tap.ts
  - hooks/pre-tool-use-agent.ts
  - hooks/lib/check-subagent-return.ts
  - hooks/hooks.json
  - tests/dispatch-timing-pre-tap.test.ts
  - tests/subagent-return.test.ts
- Confidence: high
- Risks: -
- Suggested Next Handoff: -

