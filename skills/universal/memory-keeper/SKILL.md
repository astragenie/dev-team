---
name: memory-keeper
prompt_id: memory-keeper
version: 1.0.0
tier: universal
description: Universal memory discipline for every agent. Recall prior decisions + lessons BEFORE substantial work; record durable decisions and resolved errors AFTER, to the astramem semantic store. Keeps hard-won knowledge out of the compaction void and out of the next agent's blind spot. Load when starting a substantial task, at a real decision point, or after hitting + fixing a non-obvious error.
owner: astra
last_reviewed: 2026-07-05
maxLines: 200
triggers: ["record decision", "remember this", "memory", "lesson learned", "why did we", "did we already try", "recall", "prior decision", "post-mortem", "avoid repeating"]
---

# Memory Keeper

Agents are amnesiac across sessions and compaction. Decisions and error-fixes that
live only in a transcript are lost the moment context rolls. The astramem store is
the durable, **semantically-searchable** memory that survives. Use it.

Two memory layers exist — know which is which:

| Layer | What | When |
|---|---|---|
| **astramem** (MCP, semantic) | vector + FTS recall over decisions/lessons/facts across sessions | the working memory this skill governs |
| file `MEMORY.md` (index) | one-line pointers loaded at session start | human-readable index; the operator maintains it |

This skill is about **astramem** — the searchable layer agents read + write.

**Scope note (astramem plugin v0.6):** astramem routes every call through a
**provider selector** to a **local daemon or SaaS** backend — the plugin owns
transport, so reach it via the MCP tools (or `/astramem:recall` / `/astramem:remember`),
**never a raw `astramem` CLI**. With a **local** provider a memory persists across
*your* sessions on this machine only; a **SaaS** provider can share memories across
machines/teammates when paired to the same dashboard. Every write defaults to
`personal` scope; `promote_memory(id, "team"|"org")` marks a memory shareable.
Confirm which provider this workstation is paired to (`get_health` / `astramem connect`)
before assuming a teammate will recall what you wrote.

## The discipline — two directions

### 1. RECALL before you decide (read) — required at task start

Before substantial work, a real decision, or repeating something that smells
familiar, **search first**. This is not optional: the loop is
`recall → act → record`, and skipping the first step is how a lesson already
paid for gets re-learned the hard way.

- `recall_memory({ query, k, project, agent, type })` — top-K semantic recall.
- `search_memory({ query, ... })` — hybrid FTS + vector when you need exact terms.

Ask: *did we already decide this? did we already hit this error? is there a lesson?*
One recall call costs almost nothing; re-deriving a burned decision costs a whole
session. **Scope your recall** — filter by `project` (this repo's memories) and, when
you want your own role's prior lessons, `agent` (e.g. `agent: "crew:reviewer"`).

### 2. RECORD after you learn (write)

After a durable decision or a resolved non-obvious error, **write it back**:

- `remember({ text, type, metadata })`.

Pick the `type` honestly:

| type | Use for |
|---|---|
| `decision` | a choice with rationale that constrains future work ("chose X over Y because Z") |
| `lesson` | what a bug/error/failure taught — the trap + how to avoid it next time |
| `fact` | a stable truth about the system not derivable from the code |
| `event` | a notable thing that happened (a release, a migration, an incident) |
| `note` / `todo` / `command` | lighter-weight; use sparingly — never the *only* record of a load-bearing decision |

**A "keeper" memory (one meant to survive and be recalled later) REQUIRES:**

- `type` in `{decision, lesson, fact}` — not `note`/`todo`/`event` for anything load-bearing.
- Non-empty **why** — the rationale, not just the outcome.
- Non-empty **how-to-apply** — what the next agent should *do* differently because of it.
- `metadata { project, repo, agent, importance, confidence }` — all five present.
- `importance >= 0.6` — below that it isn't a keeper; don't inflate the score to
  qualify it, and don't write it as a keeper type either.

Missing why, missing how-to-apply, or `importance < 0.6` means: this isn't a keeper
— downgrade to `note` or skip the write. This bar is the enforcement lever against
distiller-style noise (low-signal auto-generated fragments); see "What is NOT a
durable memory" below.

## Examples

**RECALL before deciding** — e.g. `crew:reviewer` about to judge a stack pattern it
half-remembers arguing about:

```
recall_memory({ query: "EF Core migration pattern for multi-tenant schema", k: 5,
  project: "dev-team", agent: "crew:reviewer", type: "decision" })
```

When semantic recall isn't enough and you need an exact term:

```
search_memory({ query: "biome cognitive-complexity threshold", project: "dev-team" })
```

**RECORD after a decision or a fixed error** — the `text` carries the *why*, not just
the *what*:

```
remember({
  text: "Decision: bumped biome.json cognitive-complexity threshold 10 -> 15. Why: " +
        "10 was the migration-original value, not Biome's default, and over-flagged " +
        "dispatch tables that read fine at 15. How to apply: don't re-lower without a " +
        "concrete new hotspot.",
  type: "decision",
  metadata: { project: "dev-team", repo: "dev-team", agent: "crew:fullstack-dev",
              importance: 0.6, confidence: 0.9 }
})
```

**Slash-command equivalents** — same discipline when you'd rather not hand-write the
MCP call:

- `/astramem:recall EF Core migration pattern for multi-tenant schema`
- `/astramem:remember Decision: bumped biome threshold 10->15 because it over-flagged dispatch tables`

## What to record (and what NOT to)

**Record:**
- A decision + its *why* (the why is the load-bearing part — code shows the what).
- A non-obvious error and the fix (so the next agent doesn't burn a session on it).
- A gotcha the repo/code does not make obvious (a flag, a lockout, an ordering rule).

**Do NOT record:**
- What the code, git history, or CLAUDE.md already state — that's noise.
- Secrets, tokens, keys — ever.
- Transient chatter only this turn cares about.

**What is NOT a durable memory** (the auto-distiller's low-signal failure modes —
don't hand-write these either):
- Ephemeral status ("trunk green", "tests passing right now") — true this instant,
  stale by the next commit.
- Git-derivable facts (a commit SHA, a branch name, a file's current line count) —
  `git log` / `grep` answers this faster and more accurately than a stored memory.
- Vacuous negatives ("nothing unusual happened", "no issues found") — no why, no
  how-to-apply, so it can never inform a future decision.
- Bare todos with no decision or lesson attached ("fix this later") — that's a
  todo-list entry, not a memory; if a real gotcha is behind it, write the lesson.

If asked to remember something the repo already records, capture instead *what was
non-obvious about it* and record that.

## Write discipline (keep the store clean)

- **One memory = one fact/decision.** Atomic. Don't pack five things into one.
- **Recall before writing** — if a near-duplicate exists, prefer `supersede_memory`
  (correct the old one) over adding a second, drifting copy.
- **State it as it was true when written.** A memory naming a file/flag reflects the
  moment; the reader must verify it still holds before acting on it.
- Wrong memory → correct it (`supersede_memory`) or drop it (`invalidate_memory`).

## Minimal loop (required at task start and at every real decision point)

```
start task → recall_memory({query, project, repo})   → act with prior context
decision made / error fixed → remember({text, type, metadata}) meeting the keeper bar above
```

Cheap to do, expensive to skip. A team that records its decisions and errors stops
paying for the same mistake twice.
