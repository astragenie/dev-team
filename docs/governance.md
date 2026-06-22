# Governance

How this plugin is maintained, who owns what, and when to introduce
new agents / skills / routes. Companion to
[`docs/architecture/architecture.md`](architecture/architecture.md);
the architecture doc describes the shape, this doc describes the
discipline.

---

## Skill ownership

| Field           | Convention                                                                          |
| --------------- | ----------------------------------------------------------------------------------- |
| `owner`         | GitHub handle or team name responsible for keeping the skill correct                |
| `last_reviewed` | ISO date; `scripts/validate-skills.mjs` warns when older than 180 days              |
| `triggers`      | Globs, signals, or keywords used by the dispatcher to decide whether to suggest the skill |
| `stack`         | Domain skills only; e.g. `dotnet`, `flutter`, `terraform`                           |

**Why:** an unowned skill rots silently. A stale `last_reviewed` is a
visible nag that prompts a quick re-read.

**How to apply:** before merging a new skill, confirm the four fields
are populated. The validator catches missing `name` / `tier` /
`description` and surfaces the recommended fields as warnings.

---

## Agent prompt size bar — **≤ 350 lines (default)**

**Why:** every line of an agent prompt is always-on context cost. Big
prompts amortise badly across the long tail of small tasks. The
350-line cap balances room for cross-cutting sections (context
efficiency, shell pre-check, depth control) against bloat — pushes
domain specifics into skills the agent invokes on demand.

**How to apply:** `scripts/validate-agents.ts` is the hard CI gate
(FEAT-035). If `agents/<role>.md` exceeds the cap, push specifics
into a skill the agent can invoke on demand. A per-agent `maxLines:`
frontmatter field overrides the default when justified (the dispatcher carries
extra routing + autonomous-resolution policy). The role prompt should
carry identity, boundaries, escalation policy, and cross-cutting
rules (context efficiency, shell pre-check, report contract, handoff
discipline); skills carry the procedural knowledge.

**Cap history:**

- ≤200 was the original soft bar (governance-only, no validator).
- FEAT-035 raised to ≤300 and added `validate-agents.mjs` as a
  hard CI gate so the cap is enforced rather than aspirational.
- Raised to ≤500 default + `maxLines:` per-agent override when
  reviewer absorbed code-reviewer duties (commit `e43462d`).
- Lowered to ≤350 default after specialist split shrank scope back
  (builder-fe / builder-be / reviewer-validator) — 500 was over-generous.

Lead is the canonical example: routing decisions live in
`docs/routing-table.md`, skill-tier conventions live in
`docs/architecture/architecture.md`, and the agent prompt itself
points at them rather than restating them.

---

## Routing-table monthly review

**Why:** routing heuristics drift. New task patterns appear; obsolete
rows accumulate.

**How to apply:**

- `brief-me` surfaces a reminder when `docs/routing-table.md` mtime
  is older than 30 days.
- The review is a human task: cross-check the table against the last
  ~30 runs in `.claude/artifacts/crew/runs/`. Look for: misroutes,
  patterns that fired no row, rows that fired no traffic.
- Refresh + commit. `last_reviewed` for the table = the commit
  timestamp.

---

## Artifact retention

| Artifact kind                            | Lifetime                     | Why                                       |
| ---------------------------------------- | ---------------------------- | ----------------------------------------- |
| Run briefs                               | Indefinite                   | Continuity signal for compaction recovery |
| Handoffs                                 | Indefinite                   | Audit trail of ownership transitions      |
| Review / validation / deployment results | Indefinite                   | Compliance + post-mortem                  |
| Final synthesis                          | Indefinite                   | The "what happened" anchor                |
| Cost reports                             | Indefinite                   | Trend signal for cost-advisor             |
| `workflow-state.json`                    | Live + rolling 5 recent runs | Active state; older runs archived inline  |

**Archive policy:** when `.claude/artifacts/crew/runs/` exceeds the
project's comfort line, move older items into a versioned subdir
(e.g. `archived/2026Q1/`) rather than deleting. The runs are
inexpensive markdown; the loss case is bigger than the storage cost.

---

## Lessons → standards pipeline

When the **same lesson** appears in 3+ grade artifacts or
retrospectives, promote it from "noticed pattern" to canonical
standard:

| Where the lesson lives now    | Where it should land                                  |
| ----------------------------- | ----------------------------------------------------- |
| Skill-specific tactic         | `skills/<tier>/<skill-name>/SKILL.md` (extend or add) |
| Cross-cutting code convention | `docs/standards/code-conventions.md`                  |
| Routing pattern               | `docs/routing-table.md`                               |
| Agent boundary clarification  | `agents/<role>.md`                                    |
| Workflow gate or badge        | `scripts/lib/workflow-state.mjs` + this doc           |

**Why:** without the promotion step, lessons live in artifacts no one
re-reads. Promotion makes them load-bearing for future runs.

**How to apply:** when reading a grade or retrospective and you
notice "this matches what I saw before", grep prior artifacts; if
the count hits 3, open a backlog FEAT to promote it.

---

## autonomous_safe policy for agent prompts

Agent prompt files in `agents/` are **agent identity definitions** — they govern how an agent reasons, scopes its work, and communicates. Edits to them are not bounded code changes; they carry outsized risk of drift or scope confusion across every run.

The following agent prompt files are declared `autonomous_safe: false` and require human-in-loop review even when picked by the autonomous loop:

- `(removed v0.41)` — user-facing coordinator; any change affects framing + gate decisions.
- `agents/architect.md` — design + ADR output contract; prompt changes affect what artifacts get produced.
- `agents/uxdesigner.md` — UX flow + component spec output contract; same risk class as architect.
- `agents/copywriter.md` — docs + release-notes output contract; same risk class as architect.

The reviewer must not be the same person (or agent session) that authored the change. A human must approve before any of these files are merged to `main`.

All other agent prompts (`builder`, `reviewer`, `validator`, `deployer`, `researcher`, `refactor`) follow the same policy — they are also `autonomous_safe: false` because they define team trust boundaries (review independence, validation evidence, deployment gates).

---

## Specialist agent admission — the three-test rule

A new agent earns its keep **only when all three hold:**

1. **Different tool surface.** Needs different MCP servers, different
   file-access scopes, or different command permissions than any
   existing agent.
2. **Different output contract.** Returns a different artifact shape
   or gate semantics than any existing agent. (Validator's evidence,
   deployer's environment proof, reviewer's independence-from-author
   each pass this test.)
3. **Independent ownership required for trust.** Some other agent
   could implement the same logic, but trust would suffer (e.g.
   reviewer must be independent from implementor).

If any one of the three fails: **author a skill instead.** Specialist
"languages-as-agents" (csharpbuilder, flutterbuilder, etc.) fail all
three. Use `skills/domain/<stack>/` for those.

**Why:** every agent prompt is permanent context overhead and a new
disambiguation surface for the dispatcher. The bar is high on purpose.

**How to apply:** before opening a "new agent" FEAT, write a one-line
answer to each of the three tests. If you can't justify all three,
re-cast the work as a skill.

---

## When in doubt — defer

The default for any new mechanism is **defer until observed.** Vector
memory until grep slows. Artifact index until directory listing
slows. New badge until the same workflow gap appears twice. New
skill until the same context pattern appears twice.

**Why:** speculative mechanism is the most expensive kind of
mechanism. It has the same maintenance cost as a real one, with none
of the validating signal that it's actually wanted.

---

## See also

- [`docs/architecture/architecture.md`](architecture/architecture.md) — composition, skill tiers, memory tiers, anti-patterns.
- [`docs/routing-table.md`](routing-table.md) — signal-to-role map.
- [`docs/standards/code-conventions.md`](standards/code-conventions.md) — ESM / Node conventions.
