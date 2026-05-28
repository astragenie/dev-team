# Final Synthesis: cost-hygiene reread-hook brainstorm — 7 Qs locked, approaches presented, mid-flight

- Created: 2026-05-28T19:33:43Z
- Session lead: lead (interactive, single-session continuation of the AC5+TS-port+cost-hygiene session)
- Mode: brainstorming (superpowers:brainstorming skill active)
- Workflow run: none opened (brainstorm session; design dialogue only, no code changes for this workstream)

## Session Objectives — Outcomes

| # | Objective | Outcome |
|---|---|---|
| 1 | Pivot from TS-port brainstorm to cost-hygiene work | ✅ done (user directive: "lets switch to cost hygiene work") |
| 2 | Investigate existing reread detection in repo | ✅ done — detector + recommendation already exist in cost-advisor; reactive only |
| 3 | Scope the intervention type | ✅ user chose "PreToolUse hook — active block/warn" |
| 4 | Brainstorming skill — clarify, propose, design, spec, plan | 🔄 mid-flight — 7 of 7 clarifying Qs locked; Approach B approved; design-sections presentation next |

## Clarifying Q&A (Q1–Q7 locked)

The 7 questions ladder from intervention shape outward to surface details. All locked:

| # | Question | Locked answer |
|---|---|---|
| Q1 | Action type | Warn-only |
| Q2 | Trigger | Every reread |
| Q3 | Distribution | Crew plugin, default-on |
| Q4 | Language | Node ESM |
| Q5 | Format | Inline content in `<system-reminder>` |
| Q6 | State cap | 50KB/file, 2MB/session, LRU |
| Q7 | Edit exception | mtime stat-based suppress |

The Q5 decision is the prevention lever: prior recommendations ("Trust prior Read results") in memory + cost-advisor weren't enough. Quoting the actual prior content into a system-reminder-tagged block forces the model to see the answer is already in its context — eliminates the "but I might need fresh content" rationalization.

## Approaches Presented

- **A**: single-file hook — fast to ship, hard to test.
- **B (recommended)**: hook + `scripts/lib/cost-hygiene/{state,decide}.mjs` + 2 test files. Pure `decide()` lets warning-format be the testable unit.
- **C**: reuse `session-cost.mjs` filesRead — dropped (timing mismatch: transcript parsing is post-hoc, hook needs synchronous state).

**Approach B approved** by user at 2026-05-28T19:34Z (single-character reply: "b").

## Decisions Made

| ID | Decision | Rationale |
|---|---|---|
| Session-2026-05-28-D | Pivot from TS-port to cost-hygiene this session, parking TS-port mid-flight | User directive; TS-port already had 5 open Qs waiting on user, cost-hygiene unblocks the F-grade signal that the rest of the work runs against |
| Session-2026-05-28-E | Intervention = PreToolUse hook (not skill prompt rule, not brief-me escalation, not investigation-first) | User picked option 1 from the cost-hygiene scoping AskUserQuestion. Strongest direct lever; memory rule had failed to prevent (114 rereads in last session). |
| Session-2026-05-28-F | Warning format = inline content quote in `<system-reminder>` (Q5) | Prior recommendations ("Trust prior Read results") in cost-advisor.mjs:502 and memory `feedback_cost_discipline.md` did not prevent the rereads. Inline-content forces the model to see the answer is already in its context. Cost trade-off accepted (warning size ≈ file size). |
| Session-2026-05-28-G | Approach B recommended over A | Plugin constraint (CLAUDE.md): "Hooks should stay small and auditable." Approach A mixes state IO + decision + stdout into one file. B isolates the pure decide() for table-driven test coverage of Q1–Q7 decision matrix. |

## Open Items at Session End

1. **Section 1 (Architecture) DELIVERED**, awaiting user approval. Full content captured in companion handoff under "Section 1 — Architecture (delivered, awaiting approval)".
2. **Sections 2–5** (Components, Data flow, Error handling, Testing) — pending, outlined in companion handoff under "Pending sections (not yet presented)".
3. **Spec write** at `docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md` — blocked on full design approval.
4. **`superpowers:writing-plans`** — blocked on spec approval.
5. **TS-port brainstorm** — parked mid-flight at sibling handoff `20260528T190032Z`. 5 Error Handling Qs still pending user answers.

## Risks / Notes for Next Session

- **Two parked brainstorms now.** Both have full handoffs. Next session's `crew brief-me` will show TS-port as `latestArtifact`'s `handoff` field; cost-hygiene is the newer parking. Lead must explicitly choose which workstream resumes — they are independent.
- **The hook itself adds tokens** when it fires. If the brainstorm goal (eliminate 114 rereads) holds, net win is large. If model ignores the system-reminder (precedent: existing recommendation didn't prevent), we'll have spent tokens on warnings AND still paid for rereads. Test plan must include a way to dogfood the hook in this repo before promoting to plugin default.
- **Per cost-discipline memory**: This session used Sonnet for tool dispatch (brief-me, grep, edits) and Opus for the clarifying-question dialogue + approach proposal. Continue that split when this brainstorm resumes; Opus for design-section dialogue (architecture, error handling), Sonnet for spec text write.
- **Stop hook fired 4 times this session.** Pattern: lead writes substantial chunk → stop hook flags missing artifact → lead writes artifact. This synthesis + sibling handoff are the response to the 4th fire. Future sessions: write handoff before any natural pause, not after stop-hook prompt.

## Artifacts Trail (this session, cost-hygiene workstream only)

- Synthesis: `.claude/artifacts/crew/runs/20260528T193343Z-final-synthesis-cost-hygiene-reread-hook-brainstorm-mid-flight.md` (this file)
- Handoff: `.claude/artifacts/crew/handoffs/20260528T193343Z-handoff-brainstorming-cost-hygiene-reread-hook-approaches-presented.md`

## Handoff Pointer

Resume from: `.claude/artifacts/crew/handoffs/20260528T193343Z-handoff-brainstorming-cost-hygiene-reread-hook-approaches-presented.md`
