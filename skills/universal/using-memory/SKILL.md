---
name: using-memory
prompt_id: using-memory
version: 1.0.0
tier: universal
description: Use at the START of substantial work (build, review, validate, design, debug, research) to ground yourself in prior memory before acting — read your agent track record (recurring lessons, decisions, and past corrections) and recall task-specific memory via the astramem MCP, then feed back which memory actually helped. Complements the deterministic SubagentStart profile hook (which loads your track record at dispatch) by adding active mid-task recall + usefulness feedback.
owner: astragenie
last_reviewed: 2026-07-15
triggers: ["recall", "prior lessons", "what did we decide", "have we hit this before", "use my memory", "agent profile", "submit feedback", "did we already try this"]
---

# Using Memory

Agents that ignore their own history re-learn the same things and repeat the same
mistakes. Two mechanisms give you memory here — use both:

1. **Load at dispatch (automatic).** The `SubagentStart` profile hook already
   prepends your track record (top lessons / recent decisions / **corrections**)
   to your context when you're dispatched. Read it — corrections are prior
   mistakes you must not repeat.
2. **Active recall + feedback (this skill).** During substantial work, pull
   *task-specific* memory and record what helped, via the astramem MCP tools.

The astramem MCP is opt-in (`MEMORY_API_URL` / `MEMORY_BEARER` in env). If its
tools aren't available, skip silently — memory is grounding, never a gate.

## When to Use

At the **start** of any substantial task — build, review, validate, design,
debug, research — before you write code, make a decision, or answer. Once per
task. Skip for trivial acknowledgements or pure chit-chat. Also trigger on an
explicit ask: "recall", "what did we decide", "have we hit this before", "load
my memory", "submit feedback".

## Step 1 — Load (at the start of real work)

- **Your track record** — call `agent_profile` with your agent/role name (e.g.
  `crew:reviewer`, `crew:backend-dev`) if it wasn't already injected at dispatch.
  Read `corrections` first (past reversals), then `recent_decisions`, then
  `top_lessons`.
- **This task's context** — call `recall_memory` (or `search_memory`) with a
  short query: the FEAT/slice, key file or component names, plus "decisions
  lessons failures". Scope with `project`/`repo` when known.

Both best-effort. Empty result or error → proceed with what you have.

## Step 2 — Use

Fold memory into how you work THIS task:
- `corrections` are guardrails — never repeat a reversed decision.
- `recent_decisions` are settled unless you have reason to revisit.
- `top_lessons` + recall hits inform your approach.
Track which memory `id`s you actually relied on — you need them for Step 3.

## Step 3 — Feed back (this is what makes memory smarter)

When a loaded memory genuinely changed what you did — you honored a correction,
reused a decision, a recalled fact shifted your approach — call `submit_feedback`
(or `mark_memory_used`) with that memory's `id`. Only credit memory you actually
used. This lifts useful memory up the ranking and lets noise fall away; without
it, `top_lessons` stays importance-ordered, not usefulness-ordered.

## Step 4 — Store what's new (optional, at the end)

If the task produced a durable lesson/decision or corrected a prior belief, call
`remember` (or the crew capture path) so the next agent inherits it. One crisp,
standalone sentence per item; skip transient detail.

## Fail-silent contract

Any unavailable tool, empty result, or error means "proceed without it" — never
surface an error or pause work because memory was unreachable.

## Done

You have satisfied this skill when, for the current task, you have either:

- loaded your profile + task recall, folded any `corrections`/`decisions` into
  your approach, and called `submit_feedback` for each memory that genuinely
  changed what you did; or
- confirmed the astramem tools are unavailable (opt-in env absent) and proceeded
  without them.

No feedback is owed when nothing loaded actually influenced the work.
