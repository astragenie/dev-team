# Agent-Profile Load + Feedback Loop — Design

- **Date:** 2026-07-14
- **Status:** design (awaiting user review before implementation planning)
- **Repos:** `plugins-common` (`@astragenie/memory-provider`), `dev-team`, `runner-plugin`
- **Related:** dev-team #235, astramem-local #184/#190, FEAT-188 (S1a/S2/S3a), FEAT-219/231/238
- **Reviews folded in:** `crew:architect` (inline), `crew:architect-reviewer` (`.claude/artifacts/crew/reviews/20260714T163327Z-review-result-agent-profile-load-feedback-loop-astramem-client-side.md`)

## Problem

Every fleet agent accumulates typed memories (lessons, decisions, and *corrections* — its own memories later invalidated/superseded), but starts every task cold. `crew:fullstack-dev` has 1,074 memories, `crew:reviewer` 1,047 — none loaded at dispatch. Agents re-learn the same things and repeat the same mistakes daily.

The daemon already serves the read side (`GET /agents/:agent/profile`, MCP `agent_profile`). The client side (dev-team + runner-plugin) never consumes it, and there is no path that reports back which recalled memory was actually *used*, so the usefulness signal that ranks the profile has never received input (0% used-over-served across 575 atoms, per #235).

**Goal:** at agent dispatch, load the agent's ranked track record (lessons / decisions / corrections) into its prompt, and feed back which loaded items were used — so agents stop repeating mistakes, reuse working patterns, and the ranking becomes real over time.

## Scope

- **In scope:** the consumer/client side — `dev-team` + `runner-plugin` dispatch injection, plus the shared `@astragenie/memory-provider` seam they both resolve through.
- **Out of scope:** the astramem-local daemon (extraction pipeline, ranking internals, profile query). External daemon changes are logged as named fast-follows, not done here.

## Grounded facts (verified 2026-07-14)

- `GET /agents/:agent/profile` (`astramem-local/src/server/routes/agents.ts:17`) is scoped by **agent only** — `ACTIVE_CLAUSE = 'agent = ? AND valid_to IS NULL AND archived = 0'` (`src/server/queries/agent-profile.ts:75`). No `project`/`repo` predicate. Returns `top_lessons` (≤10, ranked by `usefulnessScores()` = Laplace `(used+1)/(used+corrected+2)`, tie-break importance), `recent_decisions` (≤5), `corrections` (≤5), `counts`, `first_seen`/`last_active`. Returns **null** for an agent with zero rows (clean "omit block").
- Feedback verbs take a **single id**, no batch: MCP `submit_feedback` (`src/mcp/server.ts:677`) and REST `POST /memory/:id/used` (`src/server/routes/lifecycle.ts`). Feedback is **positive-only** — the Laplace denominator only drops via `invalidate`/`supersede` lifecycle events, never a "not used" call. `submit_feedback` v1 "feeds recall-usefulness rate… does not affect [semantic-recall fusion] ranking" — but `queryTopLessons` sorts directly by `usefulnessScores()`, so feedback **does** reorder the *profile*.
- Shared client `@astragenie/astramem-client` exposes only `rememberSilent` + `recallSilent` (fail-silent, 2s cap, provider resolution). `@astragenie/memory-provider` exposes `resolveProvider().recall(...)` — the seam `dev-team/scripts/lib/memory/inject-recall.ts` already uses to build the `## Prior context (from astramem)` block, wired into commands build/fix/ship/orchestrate-slice.
- `runner-plugin/src/scripts/lib/memory-context.mts` mirrors this, and already gates agent-scoped recall behind `scopeByAgent` (default **off**, citing #309: astramem's `--agent` is a **hard filter** that returns nothing before enough agent-tagged history exists). Profile has the identical hard-filter shape.
- `@astragenie/memory-provider` currently **fails to resolve in dev-team** (`require.resolve` throws — #185/#194/#220: `@astragenie/*` not installed from the plugin cache). This feature sits on top of that packaging blocker.

## Options considered

### A — Shared seam at the provider layer (**chosen**)
Add `profile(agent)` + `feedback(id, {used})` to the `@astragenie/memory-provider` `MemoryProvider` interface. Both dev-team and runner-plugin resolve the profile call through the *same* provider they already use for recall.
- **Why chosen:** guarantees both memory blocks resolve to the same provider (local vs SaaS); reuses config resolution, fail-silent, and cap machinery; no duplicated transport; no daemon change.
- **Cost:** depends on a plugins-common publish + the packaging fix (#185/#194/#220).

### B — Raw client seam (`@astragenie/astramem-client`) + interim direct-HTTP
Add the two calls to the low-level client, allow consumers to hit the daemon HTTP directly until the client publishes.
- **Why rejected:** bypasses the provider abstraction `inject-recall.ts` resolves through, so the profile block and the recall block could resolve to **different providers**; the interim direct-HTTP path reintroduces exactly the topology bug (`local-daemon-only`, breaks on SaaS/plugin-mediated) that the client package was extracted to close. Both reviewers rejected it.

### C — Plugin-local HTTP in each consumer, no shared seam
Each plugin implements its own profile/feedback fetch.
- **Why rejected:** duplicates transport + resolution across two repos (the drift the shared seam exists to prevent); same topology fragility as B.

## Design (v2)

### Components

1. **`@astragenie/memory-provider` (plugins-common)** — extend the `MemoryProvider` interface:
   - `profile(agent: string): Promise<AgentProfile | null>` → `GET /agents/:agent/profile`.
   - `feedback(atomId: string, opts: { used: boolean }): Promise<boolean>` → `POST /memory/:id/used` (fires only when `used === true`).
   - Add the `AgentProfile` type subset (`top_lessons`, `recent_decisions`, `corrections`, `counts`, `first_seen`, `last_active`). Both calls are **fail-silent** (null / false on any error or cap breach), matching the existing `recall` contract. `noop`/`file` providers return null / false.

2. **dev-team — `scripts/lib/memory/inject-profile.ts`** (sibling of `inject-recall.ts`):
   - `buildProfileBlock({ repoPath, agent }): Promise<string>` → resolves the provider, calls `profile(agent)`, formats a `## Your track record (<agent>)` block. **Order: corrections first, then decisions, then lessons.** Each line carries its atom `id` in a trailing marker for later feedback. Hard-capped inside the **shared** memory budget (see below).
   - Wired into the same 4 dispatch sites already calling `injectRecall` (build/fix/ship/orchestrate-slice), appended alongside the recall block.
   - Records injected atom ids to a per-run sidecar: `.claude/state/crew/injected-atoms/<runId>.json` (machine-local/ignored tree — deliberate; this is ephemeral per-run bookkeeping, not durable history).

3. **runner-plugin** — mirror in `memory-context.mts` / start-slice dispatch. Same block format, same sidecar convention.

4. **Feedback step (both repos)** — rides the **existing** capture events (`slice_close`, `review_fail`, `validation_fail`, … already in `.claude/loop.json` `capture.events`):
   - Read the run's injected atom ids from the sidecar.
   - **v1 tracking = outcome-backstop only:** on gate **PASS**, call `feedback(id, {used:true})` for each injected atom (looped single-id calls). No call on non-PASS.
   - **Reference-detection = documented phase-2:** scan the agent's return/artifact for atom id/text overlap and credit only matches. Deferred because the daemon is positive-only (under-detection = no signal, a safe direction), so the backstop is the more reliable v1 signal and reference-detection is marginal complexity for uncertain gain.

5. **Config** — extend the `memory` block in `.claude/loop.json`:
   - `profile.enabled` (default **`false`**), `profile.topLessons`, `profile.maxTokens`, `profile.minFeedbackSample` (warm-up gate, below).
   - `feedback.enabled` (default `false`), `feedback.mode` (`"outcome"` for v1).
   - Defaults off, mirroring the `scopeByAgent`/#309 precedent; flip to `"auto"` after `crew cost-watch` + warm-up validate.

### Cold-start / warm-up honesty

The existing dataset is at 0% usefulness, so `top_lessons` ordering is Laplace-neutral (≈ importance) until feedback accumulates. To avoid the "confidently random, looks like it works" harm (#235):

- The block **leads with `corrections`** (deterministic — populated by existing invalidate/supersede events regardless of feedback) and **importance-ranked lessons**.
- Usefulness-ranked "top" lessons are **not presented as usefulness-ranked** until a minimum-sample gate is met: at least `profile.minFeedbackSample` atoms for the agent have received ≥1 feedback event. Below the gate, the block is labelled as importance-ranked, not "most useful."

### Token budget

One **shared** memory budget across profile + recall (profile sub-allocates *inside* the existing recall cap of ~800 tokens), **not** an additive second cap. Rationale: two independently-capped blocks stack to ~1400 tokens on every dispatch across the fleet; repo grade snapshot (~0.5 ⚠ across dimensions) shows more context alone doesn't improve outcomes, and `crew cost-watch` exists to catch exactly this burn. Validate token/turn delta via `cost-watch` before widening rollout.

### Failure modes

- Provider unresolved / daemon down / cap exceeded → `profile()` returns null → block omitted → dispatch **byte-identical** to today. Same for `feedback()` (returns false, no effect).
- Cold agent (no rows) → daemon returns null → block omitted cleanly.
- `profile.enabled: false` (default) → no call, no block, zero change. This is the highest-value regression guard: the feature is invisible until explicitly enabled.

## Sequencing (chosen: build-in-parallel)

1. **plugins-common** — add `profile`/`feedback` to the `MemoryProvider` interface + astramem provider impl + types; publish + version bump. Runs in parallel with the packaging fix.
2. **Packaging fix (#185/#194/#220)** — resolve `@astragenie/*` not installing from the plugin cache, so the provider seam actually loads in dev-team/runner-plugin. Tracked separately; this feature cannot run end-to-end until it lands.
3. **dev-team + runner-plugin** — author `inject-profile` + feedback step + tests against the provider **interface** now; land once (1) and (2) are green.

Each repo is edited in its own worktree/session per the cross-repo rule.

## External dependencies / fast-follows (explicit, not silent)

- **No project filter on profile** → an agent working across many repos gets cross-repo lesson bleed *by design*, not just a tagging bug. Daemon fast-follow: an optional `project` WHERE-predicate on `buildAgentProfile` (columns already exist — small change, not a migration). Logged, out of scope here.
- **astramem-local #184** (subagent memories tagged `repo=agent-<worktreeid>`) does **not** slice the agent profile (profile filters on `agent`, which is correct; feedback routes by `id`). It **does** weaken the separate project-scoped *recall* block for subagent-authored atoms. Noted, out of scope.
- **#185/#194/#220** packaging blocker — the seam this feature builds on. Sequenced in parallel (above).

## Testing

- **plugins-common:** `profile`/`feedback` fail-silent (null/false on error + cap); happy path vs a mock daemon; `feedback` fires only for `used:true`; noop/file providers return null/false.
- **dev-team:** `buildProfileBlock` format (corrections-first ordering, id markers); `disabled → ""` byte-identical dispatch; shared-budget truncation; sidecar write/read; outcome-backstop feedback fires on PASS only; warm-up gate relabels lessons below `minFeedbackSample`.
- **runner-plugin:** mirror.

## Open questions (resolved)

- Load scope → agent-global profile + project-scoped recall (two blocks). ✔
- Tracking → outcome-backstop for v1; reference-detection deferred. ✔
- Seam → provider layer, not raw client; interim direct-HTTP dropped. ✔
- Build order → build against the provider interface in parallel with the packaging fix. ✔
