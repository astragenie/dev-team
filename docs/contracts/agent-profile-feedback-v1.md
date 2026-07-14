# Agent-profile load + feedback — v1

**Status:** v1 · **Source:** `scripts/lib/memory/inject-profile.ts`,
`scripts/lib/memory/injected-atoms.ts`, `scripts/lib/memory/profile-feedback.ts`
(dev-team FEAT-188, agent-profile-load-feedback slices)
**Consumers:** dev-team dispatch sites (`commands/build.md`, `fix.md`,
`ship.md`, `orchestrate-slice.md`).

Sibling of [`recall-injection-v1.md`](./recall-injection-v1.md): recall is
per-slice/per-task context; this contract is per-**agent**, cross-repo, and
closes the loop with feedback. Both blocks are appended at the same dispatch
sites, recall first, then the agent's track record.

## What it does

At dispatch time, before handing a prompt to a specialist agent, dev-team
fetches that agent's astramem `AgentProfile` (its accumulated corrections,
recent decisions, and top lessons — scoped to the **agent**, not the repo or
slice, so it follows the agent across repos) and appends a
`## Your track record (<agent>)` block to the dispatch text. After the
dispatched agent's outcome is known, dev-team submits outcome-gated,
positive-only usefulness feedback for every atom that was injected into that
run, so future profile fetches can rank lessons by demonstrated usefulness
instead of importance alone.

Both halves are **disabled by default** and **fail-silent**: with default
config, or on any config/provider error, dispatch text is byte-identical to
the feature not existing.

## Config — `.claude/loop.json` → `memory.profile` / `memory.feedback`

```jsonc
{
  "memory": {
    // ... existing recall.* keys (see recall-injection-v1.md) ...
    "profile": {
      "enabled": false,        // default false — opt-in
      "topLessons": 10,        // cap on top_lessons entries formatted into the block
      "maxTokens": 400,        // shared token budget for the block; ~4 chars/token (maxChars = maxTokens * 4)
      "minFeedbackSample": 5   // warm-up gate — see below
    },
    "feedback": {
      "enabled": false,        // default false — opt-in, independent of memory.profile.enabled
      "mode": "outcome"        // v1: only "outcome" is implemented (see Feedback semantics)
    }
  }
}
```

All keys are optional; a missing/malformed `memory`, `profile`, or `feedback`
block resolves to the defaults above (`enabled: false` in both cases) rather
than throwing. `memory.profile.enabled` and `memory.feedback.enabled` are
independent switches — you can load profile context without submitting
feedback, or (once profile injection is on and has been running) turn on
feedback separately.

### `memory.profile`

- **`enabled`** (`boolean`, default `false`): gates the entire profile-block
  fetch. When `false`, `buildProfileBlock` short-circuits to
  `{ block: "", injectedIds: [] }` before ever resolving a provider.
- **`topLessons`** (`number`, default `10`): caps how many `top_lessons`
  entries from the fetched profile are formatted into the block (defensive —
  the astramem daemon already caps at 10 server-side).
- **`maxTokens`** (`number`, default `400`): a *shared* token budget for the
  formatted block, converted to a character budget as `maxTokens * 4`
  (matches the recall block's token/char convention). Truncation is
  deterministic: the header plus as many leading lines as fit, corrections
  first, decisions next, lessons last — never splitting a line.
- **`minFeedbackSample`** (`number`, default `5`): the warm-up gate. Until at
  least this many `top_lessons` entries carry a usefulness score that has
  moved off the Laplace-neutral `0.5` (i.e. real feedback has been recorded),
  lessons are labelled `lesson · importance-ranked` instead of `lesson`, so
  the block doesn't imply a live usefulness ranking before one exists.

### `memory.feedback`

- **`enabled`** (`boolean`, default `false`): gates `submitOutcomeFeedback`.
  When `false` (or when `memory.feedback` is absent/malformed), the feedback
  step is a no-op.
- **`mode`** (`string`, default `"outcome"`): v1 implements only the
  `"outcome"` mode — see below. Reserved for a future reference-detection
  mode (crediting only atoms actually cited in the agent's transcript,
  rather than every injected atom); not implemented in v1.

## Block format

Header `## Your track record (<agent>)`, one Markdown line per atom, in
**corrections → recent decisions → top lessons** order:

```
## Your track record (<agent>)
- **[correction invalidated]** <text> <!--atom:abc123-->
- **[decision]** <text> <!--atom:def456-->
- **[lesson]** <text> <!--atom:ghi789-->
```

- Corrections lead deterministically — they're immediately useful (a
  correction is inherently signal) even before any usefulness feedback has
  accumulated, unlike lessons which need the warm-up gate.
- Each line ends with an HTML-comment marker `<!--atom:<id>-->` — invisible
  in rendered Markdown, machine-readable by the feedback step. This is how
  `injectedIds` are derived for the sidecar (see below).
- Empty profile (no corrections/decisions/lessons) → `""`, no header, no
  injected whitespace — same "empty means nothing, ever" convention as the
  recall block.

## Sidecar — per-run injected-atoms record

`scripts/lib/memory/injected-atoms.ts` writes a fire-and-forget JSON sidecar
at `.claude/state/crew/injected-atoms/<runId>.json` (machine-local,
gitignored per `.claude/state/` in the "What is committed vs ignored"
policy) recording `{ runId, ids }` — the atom ids injected into that run's
profile block. The feedback step reads this sidecar back by the same
`runId` so it can attribute usefulness without re-fetching or re-deriving
the profile. Read/write are both fail-silent (`fire-and-forget`) — a missing
or corrupt sidecar resolves to `[]`, never a throw.

## Feedback semantics (`mode: "outcome"`, v1)

Outcome-gated, **positive-only**:

- On a `pass` outcome: every atom id in that run's injected-atoms sidecar is
  credited via the provider's `feedback(id, { used: true })`.
- On a `fail` outcome: no-op. v1 deliberately does not penalize on fail —
  atoms injected into a failed run aren't necessarily the *cause* of the
  failure, so crediting only the positive signal avoids mis-attributing
  blame.
- Per-atom-id and whole-call failures are swallowed silently
  (`{ credited: [] }` on any error) — feedback submission never blocks or
  alters the caller's outcome-reporting flow.

## CLI surface

```
node scripts/crew.ts profile-block --repo <path> --agent <name> [--run-id <id>]
  → { block: string, injectedIds: string[] }
  # writes the injected-atoms sidecar when --run-id is given

node scripts/crew.ts profile-feedback --repo <path> --run-id <id> --outcome <pass|fail>
  → { credited: string[] }
```

Dispatch sites call `profile-block` immediately after the recall block
(`commands/build.md`, `fix.md`, `ship.md`, `orchestrate-slice.md`), reusing
the resolved `runId` (from `.claude/state/crew/workflow-state.json`
`currentRun.slice`, or the `SLICE-NN` id in the orchestrate-slice
multi-builder case) for the matching `profile-feedback` call once the
dispatched agent's outcome is known.

## Provider seam (external dependency, tracked separately)

`buildProfileBlock`/`submitOutcomeFeedback` call the resolved provider's
*optional* `profile(agent)` / `feedback(atomId, { used })` methods (see
`ProfileCapableProvider` in `scripts/lib/memory/profile-types.ts`). Both
methods are currently a **local mirror** of the upstream
`@astragenie/memory-provider` contract — the published package hasn't shipped
them yet. Until it does, a provider lacking `profile()`/`feedback()`
resolves to the same empty/no-op result as `enabled: false`. Follow-on work
(tracked outside this task): implement `profile()`/`feedback()` on the
astramem provider in `plugins-common` (via `resolveAstramemRemote()` — `GET
/agents/:agent/profile`, `POST /memory/:id/used`), publish + version bump,
then swap dev-team's local `profile-types.ts` import for the package export.

## Invariants (mirrors `recall-injection-v1.md` §Invariants)

1. **Best-effort, never throws.** Config parse error, provider error, missing
   `profile()`/`feedback()`, or a null profile → empty block / no-op
   feedback, never blocks or alters dispatch.
2. **Byte-identical when off.** `memory.profile.enabled: false` (or absent)
   → no profile block appended; `memory.feedback.enabled: false` (or absent)
   → no feedback submitted. Default config is fully off.
3. **Empty → `""`.** No corrections/decisions/lessons → empty string, no
   header, no injected whitespace.
4. **Agent-scoped, cross-repo.** The profile is keyed by `agent`, not by repo
   or slice — the same agent's track record follows it across repos that
   share the same astramem instance.
5. **Positive-only feedback in v1.** Only `pass` outcomes credit atoms;
   `fail` is always a no-op. Reference-detection (crediting only
   transcript-cited atoms) is an explicitly deferred phase-2 refinement, not
   a v1 gap.

## Refs

- `docs/contracts/recall-injection-v1.md` — sibling recall-block contract
  (per-slice/task, not per-agent).
- FEAT-188 backlog item (agent-profile-load-feedback slices).
