# Subagent-lifecycle reliability — design pass (Wave-B0)

**Date:** 2026-07-10
**Type:** Read-only design (no source edited)
**Cluster:** issues #187, #174, #169, #154, #162, #205
**Prior art consulted:** `docs/research/2026-07-06-agent-mid-job-death-analysis.md`,
`docs/research/2026-07-06-token-burn-patch-plan.md`, `skills/workflow/builder-ceremony/SKILL.md`
("Turn discipline — dev-team#171/#198/#162"), `hooks/lib/check-reviewer-decision.ts` (dev-team#199).

---

## 0. Headline finding before the design: #205 is already half-shipped here

`hooks/pre-tool-use-model-enforce.ts` + `hooks/lib/model-routing-enforce.ts`, wired into
`hooks/hooks.json` (`PreToolUse` → `Agent` matcher), **is** the FEAT-194-S2b hook #205 asks
for — it landed 2026-07-06 (commits `99e4cc97`, `0381b29f`, `90bffdf5`, dev-team#176) four
days **before** #205 was filed (2026-07-10T09:25Z). It hard-injects the resolved
`loop.modelRouting` tier via `updatedInput` for the five builder-tier agents
(`fullstack-dev`, `backend-dev`, `frontend-dev`, `aiplugin-dev`, `dev-lite`) whenever a
dispatch omits `model:`, with a `systemMessage` fallback in case `updatedInput` isn't
honored by the running harness build.

What #205 actually evidences is a **different, cross-repo gap**: the sequential loop path
lives in `astragenie/runner-plugin`'s `start-slice.mts:19`, which calls
`resolveOrchestratorModel` only — never `resolveModel`/`resolveArchitectModels` — so a
`/loop:slice start` → dispatch that never goes through an `Agent`-tool call inside a
dev-team-hook-covered session (e.g. a pure orchestrator-side model resolution before any
subagent spawns) never hits this hook. That file does not exist in this repo. See §4 below
for scoping.

---

## 1. deliver-before-die (#187 / #174)

### Root cause

Two distinct failure shapes, already partially instrumented:

- **#174 (harness cutoff mid-turn):** the harness enforces some undocumented tool-call/wall-clock
  budget on a single dispatch (~65–85 tool calls / ~18–22 min, per the 2026-07-06 analysis).
  Nothing in this repo reads or predicts that cutoff — `agents/*.md`'s `maxTurns`/`maxMinutes`
  are advisory frontmatter, grep-confirmed unread by any script or hook. **This part is
  harness-owned, not plugin-fixable** — flagging out of scope per the analysis doc's explicit
  rejection of "self-timing ceremony" (an agent has no clock tool, and turn-count ≠ wall-clock).
- **#187 (empty-template artifact):** the agent writes the artifact scaffold, then the
  fill-in/synthesis step is what gets cut off — so `status: completed` reaches the parent
  with a blank Verdict/Findings body. This **is** plugin-fixable: it's a write-order and
  gate problem, not a harness-timing problem.

### What's already shipped (don't re-build)

| Mechanism | File | Status |
|---|---|---|
| Periodic checkpoint nudge every N tool calls post-first-edit | `hooks/checkpoint-cadence.ts` / `hooks/lib/checkpoint-cadence.ts` | Shipped (dev-team#174). Advisory `systemMessage` only. |
| Inline-return-without-artifact detector (pure, reusable) | `scripts/lib/subagent-return/incomplete-detector.ts` | Shipped (FEAT-188 S1a AC-4). **Detection only** — `hooks/lib/check-subagent-return.ts` line ~215 always returns `decision: "approve"`, never blocks. |
| **Precedent for a real blocking gate at agent-idle time** | `hooks/check-reviewer-decision.ts` + `hooks/lib/check-reviewer-decision.ts` (dev-team#199) | Shipped, reviewer-tier only. `SubagentStop` hook returns `decision: "block"` + a `reason` when a reviewer goes idle with no decision line and no artifact path. Guards re-entry via `stop_hook_active`. |

The 2026-07-06 analysis's **Quick Win #1** ("make the inline-return hook a real gate for
builder-tier agents, not just a warning") was never implemented. It is the single highest-leverage
fix in this whole cluster, for three reasons: the detection logic already exists
(`incomplete-detector.ts`), the blocking mechanism already exists and is proven in this exact
codebase (`check-reviewer-decision.ts`, one existing PR, no new primitive), and it only requires
changing what the existing signal *does*, not building new plumbing.

### Proposed mechanism

**1a — Generalize dev-team#199's pattern to builder-tier agents (primary fix).**
New `SubagentStop` hook (sibling of `check-reviewer-decision.ts`), or extend that hook's agent
list — cleaner as a sibling since the "delivered" definition differs (builders don't have a
`decision:` line, they have `STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}` per
`agents/fullstack-dev.md`'s Report contract):

- New file `hooks/check-builder-terminal-state.ts` + `hooks/lib/check-builder-terminal-state.ts`,
  reusing `hasTerminalStatusMarker` / `detectSubagentIncomplete` from
  `scripts/lib/subagent-return/incomplete-detector.ts` (already built for exactly this — its
  header literally says "#162 owns the blocking/lockfile enforcement layer on top of this").
- Agent list: the same `BUILDER_TIER_AGENTS` constant `hooks/lib/model-routing-enforce.ts`
  already exports (`fullstack-dev`, `backend-dev`, `frontend-dev`, `aiplugin-dev`, `dev-lite`) —
  reuse the export, don't duplicate the list a third time.
- On `SubagentStop` for a builder-tier agent with `stop_hook_active !== true`, no terminal
  status marker, and no artifact path in `last_assistant_message`: return
  `{"decision":"block","reason":"..."}` telling the agent to either (a) finish writing its
  handoff artifact and report a `STATUS:` line, or (b) commit WIP + report `STATUS: BLOCKED`
  with what's left. One retry turn only — same re-entry guard as #199
  (`stop_hook_active` short-circuits to pass-through, handing off to dispatcher-level resume).
- Feature flag: `crew.json features["builder-terminal-state-guard"]`, default on, mirroring
  `reviewer-decision-guard`'s toggle convention.

**1b — Keep checkpoint-cadence as the "make death cheap" backstop, don't touch it.**
`checkpoint-cadence.ts` already solves "if the cutoff lands mid-task, is there something to
resume from" independently of 1a (it fires on tool-count, not on stop). The two mechanisms are
complementary, not overlapping: 1a guards the *terminal* message, 1b guards the *middle* of a
long dispatch. No shared file.

**1c — Explicitly out of scope, flag and close as "harness limitation, not fixable here":**
predicting or extending the harness cutoff itself (#174's literal ask #2, "runtime-enforced
budget nudge... converting advisory limits into an actual soft-landing signal"). The 2026-07-06
analysis already tested and rejected this ("Auto-checkpoint framed as approaching the harness
cutoff... only the dumb periodic form is buildable" — which is exactly `checkpoint-cadence.ts`,
already shipped). Don't re-open it; 1b is the buildable form of that ask.

### Files touched

- New: `hooks/check-builder-terminal-state.ts`, `hooks/lib/check-builder-terminal-state.ts`,
  `tests/check-builder-terminal-state.test.ts`
- Edit: `hooks/hooks.json` (add to `SubagentStop` array), `.claude/crew.json` (feature flag
  default), `docs/standards/agent-playbook.md` (document the new terminal-state contract
  builders must satisfy)
- Reused, unedited: `scripts/lib/subagent-return/incomplete-detector.ts`,
  `hooks/lib/model-routing-enforce.ts` (import `BUILDER_TIER_AGENTS` only)

### Disjoint / shared

**Disjoint** from items 2–4 — new files, only shared edit is `hooks.json` (additive array
entry, low collision risk) and `.claude/crew.json` (additive key). Can be its own PR/slice.

### autonomous_safe

`true` — mechanical extension of an already-proven pattern (#199), pure hook-logic +
frontmatter doc update, no runtime behavior change to any agent's actual work, fail-open by
construction (same `stop_hook_active` / malformed-input pass-through as its precedent).

### Acceptance criteria

- AC1: A builder-tier agent (`crew:fullstack-dev`) that goes idle with a bare inline message
  and no artifact path is blocked once with a reason naming the missing terminal state; a
  second consecutive stop (simulating `stop_hook_active: true`) passes through.
- AC2: A builder-tier agent that reports `STATUS: BLOCKED — <reason>` is NOT blocked (blocked
  is itself a valid terminal state — this must not become a forced-completion trap).
- AC3: A non-builder-tier agent (e.g. `crew:researcher`) going idle mid-thought is unaffected
  (hook is agent-list-scoped, same as #199).
- AC4: `crew.json features["builder-terminal-state-guard"].enabled=false` fully disables the
  hook (verified via the shared `isEnabled`/`readCrewConfig` helper, no separate code path).
- AC5: Unit tests cover: malformed JSON input, missing `last_assistant_message` (fail-open,
  logged), terminal marker present, artifact path present, neither present (blocks).

---

## 2. worktree-isolation (#169 / #154)

### Root cause

`EnterWorktree`'s own tool description confirms the harness already has a "pinned at launch"
cwd primitive for subagents ("from agents whose working directory was pinned at launch
(subagent isolation or explicit cwd)... the target must be a worktree under
`.claude/worktrees/` of the same repository"). That means **the harness-native fix for #169
already exists as the `Agent` tool's `isolation: "worktree"` parameter** — the incident in
#169 describes a dispatch that named a worktree path in prompt text instead of passing
`isolation: "worktree"`, which is a **dispatch-discipline gap**, not a missing primitive.
#154 is a distinct but related problem: even same-dir (non-isolated) parallel builders, which
is a legitimate mode for genuinely disjoint file ownership, produce whole-project `tsc` runs
that observe each other's half-written files.

### Proposed mechanism

**2a — Dispatch-discipline fix (primary, cheap, plugin-fixable).** Update dispatch guidance in
`commands/build.md`, `commands/parallel.md`, `agents/architect.md` (peer-dispatch), and any
`Agent` dispatch instructions authored by `crew:document-writer`'s orchestration paths: true
parallel/background dispatch into a separate working tree MUST use `isolation: "worktree"`
(or `EnterWorktree`'s `path:` form to attach to a pre-existing worktree), never a prompt-text
"operate in `<path>`" instruction alone. This closes #169's actual repro shape at the source.
Doc-only change, no hook needed for this half.

**2b — Concurrent-same-dir registry (for #154's detection half, and shared substrate for
item 3).** Extend `hooks/lib/dispatch-timing-pre-tap.ts`'s existing pattern — it already parses
`session_id` + `subagent_type` on every `PreToolUse` `Agent` call and persists a handle via
`hooks/lib/dispatch-handle-store.ts` (`.claude/state/crew/dispatch-timing/<session_id>.json`,
already solving the exact cross-process Pre↔Post correlation problem this needs). Add a
sibling store, `.claude/state/crew/active-dispatches/<session_id>.json`, written at the same
`PreToolUse`/`Agent` hook site with `{subagentType, isolation, cwd, startedAt}`, deleted at
`SubagentStop`/`PostToolUse`. A new lightweight helper (`hooks/lib/concurrent-dispatch-registry.ts`)
answers "how many other active dispatches share this `cwd` with `isolation !== "worktree"`
right now" — a pure count, not a lock.

**2c — Reviewer/verifier caveat injection.** When `check-subagent-return.ts` or the
review/validation gate sees a builder-tier return AND the registry shows ≥2 concurrent
same-dir non-worktree dispatches were active during this dispatch's window, append a
`systemMessage`/artifact note: "same-dir concurrent build — whole-project typecheck is
advisory only for this dispatch; the dispatcher MUST re-run the gate after all siblings land
before trusting green" (this directly operationalizes #154's ask #3, "require evidence, not
assertion," by making the caveat automatic instead of relying on the builder to self-disclose
it under time pressure).

**2d — Do NOT build a hard cwd-assertion block.** A PreToolUse `Edit`/`Write`/`Bash` hook that
blocks writes outside an "expected" worktree was considered and is **not recommended**: with
`isolation: "worktree"` actually in use (2a), the harness already pins cwd — a plugin-side
re-check is redundant. Without it, the "expected worktree" has no reliable source (prompt text
is not available to most `PreToolUse` hook payloads without a transcript read, which is
expensive per-call and was rejected as a per-tool-call cost in the 2026-07-06 analysis for a
similar reason). Fix the dispatch discipline (2a) instead of compensating downstream.

### Files touched

- Edit (doc-only): `commands/build.md`, `commands/parallel.md`, any peer-dispatch sections
  in `agents/architect.md` / `agents/uxdesigner.md` / `agents/document-writer.md` (per the
  "Peer dispatch (v0.36+)" section in `.claude/crew/constitution.md`) that name worktree
  paths in prose
- New: `hooks/lib/concurrent-dispatch-registry.ts`, `tests/concurrent-dispatch-registry.test.ts`
- Edit: `hooks/lib/dispatch-timing-pre-tap.ts` (add the registry write alongside the existing
  handle write — same hook invocation, same input already parsed), `hooks/lib/check-subagent-return.ts`
  (consume the registry for the 2c caveat)

### Disjoint / shared

**Shared with item 3** at the substrate level: both want a "what dispatches are active right
now, keyed by session/cwd" registry. Recommend building the registry (2b) once, in one slice,
with item 3's lock as a second consumer — see §5 sequencing. **Disjoint** from item 1 (no file
overlap) and item 4 (no file overlap).

### autonomous_safe

`true` for 2a/2c (doc + additive consumption of an existing hook's already-parsed input);
`true` for 2b (new additive files, one small edit to an existing pre-tap that already owns
this exact I/O shape) — but review should confirm the registry write doesn't measurably slow
the `PreToolUse Agent` hot path (it fires on every dispatch).

### Acceptance criteria

- AC1: `commands/build.md` and `commands/parallel.md` explicitly state `isolation: "worktree"`
  is required for background dispatches into a separate tree; a grep for a prompt-text
  "operate in `<worktree path>`" pattern without an accompanying `isolation:` field is called
  out as the anti-pattern this closes (#169 repro shape).
- AC2: Registry correctly records N concurrent same-cwd non-worktree dispatches in a
  synthetic multi-dispatch test (fixture-driven, no live parallel agents needed).
- AC3: A builder-tier `SubagentStop`/return during a detected same-dir-concurrent window
  carries the advisory-typecheck caveat; a solo or worktree-isolated dispatch does not.
- AC4: Registry entries are cleaned up on `SubagentStop` (no unbounded growth of
  `.claude/state/crew/active-dispatches/`); a stale-entry sweep (e.g. entries older than 1h
  with no matching stop) is documented even if not built this slice.

---

## 3. dup-completion guard (#162)

### Root cause

Confirmed and already scoped in two places: `skills/workflow/builder-ceremony/SKILL.md`
("Turn discipline — dev-team#171/#198/#162": "Idle with a dirty tree and no report is the
silent third state that forks execution when the dispatcher nudges") documents the *policy*,
and `docs/research/2026-07-06-token-burn-patch-plan.md` P2-2 already specs the *mechanism*:
"#162 dispatch-identity lockfile — task-id-keyed, worktree-root-hashed lock (extend gepa-core
`fileLockManager`) so a nudge/resume can't fork a second worker doing duplicate work." Neither
the SKILL.md doc nor P2-2 have been implemented as enforcement — item 1's new hook (§1) closes
the "idle without terminal state" half by *forcing* a report before stop, which independently
shrinks #162's window (an agent that can't go idle without reporting is less likely to still
be "live" when a nudge arrives) but does not close the fork itself: two copies can still both
be mid-flight and both reach a terminal state.

### Proposed mechanism

**3a — Dispatch-identity lock, built on item 2's registry, not gepa-core's `fileLockManager`
directly.** `scripts/lib/gepa/run-with-lock.ts` is the right *pattern* to copy (acquire →
run → release-in-finally, `lock_held` as a distinct non-error outcome) but the wrong
*dependency* — `fileLockManager`'s `phase` parameter is a closed enum (`"eval" | "optimize"`
today, widened only for gepa-core's own eval/optimize domain; SLICE-104 already had to ask for
an enum widening for its own narrower need). Overloading that enum for dispatch identity
conflates two unrelated lock domains. Build a small sibling,
`hooks/lib/dispatch-identity-lock.ts`, using plain `fs` exclusive-create semantics
(`fs.open(path, "wx")` / write-then-rename) against a key of
`hash(taskId ?? sessionId, worktreeRoot)`, stored under
`.claude/state/crew/worktree-locks/<hash>.json` — same directory family as item 2's registry
(`.claude/state/crew/active-dispatches/`), same session-keyed JSON convention as
`dispatch-handle-store.ts`. This is new code, but small (< 100 LOC) and has three precedents
in-repo to copy the shape from (`dispatch-handle-store.ts` for the file-per-key convention,
`run-with-lock.ts` for the acquire/release contract, `check-reviewer-decision.ts` for the
"detect, don't silently allow" blocking posture).

**3b — Where the lock is checked.** At `SubagentStop` (extending the same hook family as §1's
builder-terminal-state guard, or as a third sibling hook), before honoring a *completion*
report (terminal `DONE`/artifact-path present): acquire the lock keyed on `(taskId,
worktreeRoot)`. If already held by a different `session_id`, this is the fork scenario
(#162's exact repro) — log it, and emit a `systemMessage` telling the LATER-arriving copy
"another session already claimed completion for this dispatch; treat your local changes as
redundant, do not commit, defer to the earlier report" rather than blocking silently (a hard
block at `SubagentStop` can't stop a session that's already writing files — this is a
detect-and-warn control, not a mutex on filesystem writes, which is an important limitation to
be explicit about). If not held, acquire it and let the stop proceed normally.

**3c — Peer-stop capability is out of scope, flag as harness-dependent.** #162's ask #3 ("no
peer stop... lead has TaskStop but nothing signals which copy is authoritative") wants one
running agent to be able to terminate its sibling. `TaskStop` exists but per #162's own
evidence is orchestrator/lead-scoped, not peer-scoped ("could not force-stop the stray copy —
task ownership restriction"). This is a harness authorization-model question, not something a
hook can grant. Document the residual: 3b's lock makes the fork *detectable and loud*, but the
lead/dispatcher is still the only party that can `TaskStop` the loser. Recommend codifying the
existing informal recovery (SendMessage nudge → verify worktree state before building on top,
already noted as "saved us here" in #162) as an explicit dispatcher-facing skill step, not new
code.

### Files touched

- New: `hooks/lib/dispatch-identity-lock.ts`, `tests/dispatch-identity-lock.test.ts`
- Edit: the builder-terminal-state hook from §1 (`hooks/check-builder-terminal-state.ts`) to
  additionally acquire/check the lock on a DONE-shaped stop — OR a new dedicated
  `hooks/check-dispatch-completion-lock.ts` if keeping §1 single-purpose is preferred (see §5
  sequencing note on why dedicated is recommended)
- Edit: `skills/workflow/builder-ceremony/SKILL.md` (point the existing "Turn discipline"
  section at the now-real enforcement instead of prose-only), dispatcher-facing doc (likely
  `commands/build.md` or `.claude/crew/workflow.md`) for the 3c recovery playbook

### Disjoint / shared

**Shared with item 2** at the registry/state-directory level (both live under
`.claude/state/crew/`, both keyed by session/worktree) — recommend item 2's registry lands
first, item 3's lock is additive on top, same slice family. **Shared with item 1** only if the
lock check is folded into the same `SubagentStop` hook (author's call in §5); if kept as a
separate hook file, item 1 and item 3 are otherwise disjoint and reviewable independently.

### autonomous_safe

`false` — recommend human-in-loop review for the first landing. Rationale: this is the one
mechanism in the cluster that changes multi-agent *coordination* semantics (which copy is
authoritative) rather than single-agent *reporting* discipline; a subtle bug here (e.g. a lock
that never releases on crash, or a hash collision across genuinely-different dispatches) could
convert "duplicate work, luckily harmless" (#162's actual outcome) into "one copy silently
told to stand down when it shouldn't have been." Worth a careful review pass given the
blast radius is correctness of concurrent dispatch, not just cost.

### Acceptance criteria

- AC1: Two `SubagentStop` events for the same `(taskId, worktreeRoot)` key, from different
  `session_id`s, in sequence — first acquires cleanly, second is detected as a duplicate and
  receives the stand-down `systemMessage` (does not block, per 3b's documented limitation).
- AC2: Lock is released (file removed) after a successful stop-completion, verified by a
  third dispatch on the same key succeeding cleanly afterward.
- AC3: A crashed/orphaned lock (file present, no corresponding live session) does not
  permanently wedge future dispatches on that key — needs an explicit staleness policy (e.g.
  TTL or PID-liveness check) decided during build, not deferred silently.
- AC4: Reproduces the exact #162 scenario as a fixture-driven test: idle-then-nudge-then-both-complete,
  asserting the second completion is flagged, not silently duplicated.
- AC5: `skills/workflow/builder-ceremony/SKILL.md`'s "Turn discipline" section is updated to
  reference the real mechanism, not left as unenforced prose describing enforcement that
  doesn't exist (the exact drift #187 also warns about — prose implying gates that no code
  path executes).

---

## 4. modelRouting hard-enforce (#205)

### Root cause

See §0. **Already shipped in dev-team** for the `Agent`-tool dispatch path this repo's hooks
can see. The residual gap is architecturally cross-repo: `astragenie/runner-plugin`'s
`start-slice.mts:19` (sequential `/loop:slice start` path) resolves only
`resolveOrchestratorModel`, never calling into `resolveModel`/`resolveArchitectModels` before
handing a `dispatchInstruction` back to the dispatcher LLM to act on. If that dispatcher LLM's
subsequent `/crew:build` invocation issues an `Agent`-tool call without an explicit `model:`,
dev-team's `pre-tool-use-model-enforce.ts` (§0) DOES still catch it at that point — provided
the session runs with dev-team's hooks active (true for any session inside this repo, or a
consumer repo with the crew plugin installed). The only way #205's observed 100%-Opus outcome
is possible with this hook shipped is one of:

1. The sales repo's Claude Code build predates `updatedInput` support for the `Agent` tool
   (the hook's own header flags this as unconfirmed — "that support has NOT been empirically
   exercised in this codebase before landing this slice"), and the `systemMessage` fallback
   warning was either not visible to the dispatcher LLM or was ignored.
2. The sales repo's plugin cache predates 2026-07-06 (hadn't picked up dev-team v0.52.2+/
   the commit range above) at the time of the observed cost run.
3. The dispatch that burned Opus never went through the `Agent` tool at all (e.g. a
   fully-orchestrator-side model choice baked into a script before any subagent spawns) — this
   is exactly runner-plugin's `start-slice.mts` gap, upstream of any `Agent`-tool call.

### Proposed mechanism

**4a — Confirm `updatedInput` is actually honored (do this FIRST, cheaply, before any new
code).** The hook's own header names this as the open follow-up: "the accompanying
`systemMessage` is a deliberate belt-and-suspenders fallback... See the FEAT-194 S2b handoff
for the follow-up needed to confirm `updatedInput` is actually honored (observe a live
dispatch)." This is an observation task, not a build task — dispatch one builder-tier agent
without `model:` in a repo with `loop.modelRouting` configured, and check the actual model
used (via the cost report / dispatch-timing telemetry that's already wired). Closes the
uncertainty in reason (1) above for near-zero cost.

**4b — If confirmed working: close #205 in dev-team with a pointer, do not build here.** The
dev-team half of this ask is done. Re-file (or cross-reference) the residual as a
`runner-plugin` issue targeting `start-slice.mts`, scoped to that repo's own session per the
cross-repo-edit HARD RULE in this repo's `CLAUDE.md` ("never branch/edit in a sibling repo's
live checkout; spawn a worktree or hand a patch to that repo's session" —
`cross-repo-edits-require-worktree` memory). The fix there is structurally the same shape as
4a already built here: either call `resolveModel`/`resolveArchitectModels` inside
`start-slice.mts` before emitting `dispatchInstruction`, or — more robustly, since it doesn't
depend on the dispatcher LLM remembering to call it — add a `PreToolUse`/`Agent` hook in the
runner-plugin's own hook set mirroring `hooks/pre-tool-use-model-enforce.ts` (this file is
concrete, working, in-repo reference code for that port).

**4c — If NOT confirmed working (updatedInput unsupported by the runtime in use): the
`systemMessage`-only fallback is insufficient and needs a stronger belt.** Consider having the
dispatcher-facing commands (`commands/build.md` step where `resolve-model` is invoked
per-prose today) treat a missing explicit `model:` on a builder-tier dispatch as a **prompt-level
hard requirement with a pre-flight self-check line**, not just documentation — i.e., extend
`commands/build.md`'s existing prose contract with an explicit "before calling Agent, state the
resolved model inline" step that a lightweight `PreToolUse` regex check (on the *command's own
transcript*, not the eventual `Agent` payload) could plausibly verify. This is speculative and
should only be scoped if 4a shows `updatedInput` is genuinely not honored — don't build it
preemptively.

### Files touched

- None in dev-team if 4a confirms the hook works (4b: close-with-pointer only).
- If 4c needed: `commands/build.md`, possibly a new narrowly-scoped `PreToolUse` hook — sized
  after 4a's result, not before.
- Cross-repo (separate session, NOT this one): `astragenie/runner-plugin`'s `start-slice.mts`
  and that repo's own `hooks.json`/hook directory, mirroring `hooks/pre-tool-use-model-enforce.ts`.

### Disjoint / shared

Fully **disjoint** from items 1–3 (no file overlap; likely zero net new dev-team code).

### autonomous_safe

`true` for 4a (pure observation, no edits). N/A for the cross-repo port (out of this repo's
authority per the HARD RULE — that repo's own session decides its own autonomy classification).

### Acceptance criteria

- AC1: A live or fixture-driven dispatch demonstrates `updatedInput` on a `PreToolUse` `Agent`
  hook response either does or does not change the model actually used by the spawned
  subagent — result recorded in the FEAT-194 S2b handoff (closing its own open item).
- AC2: dev-team#205 is closed or re-scoped with an explicit note distinguishing "already
  shipped here" from "residual gap lives in runner-plugin," so it doesn't get re-triaged as
  a dev-team build item.
- AC3 (only if 4c triggered): the new pre-flight check has a false-positive rate low enough
  not to block legitimate architect/opus-tier dispatches that correctly omit routing (verify
  against `crew:architect`/`crew:architect-reviewer`, which should NOT be affected).

---

## 5. Recommended slice sequence

```
Slice 1 — item 1 (builder-terminal-state guard)         [PARALLEL start]
Slice 2 — item 2a (dispatch-discipline docs, no code)    [PARALLEL start]
Slice 3 — item 4a (confirm updatedInput, observation)    [PARALLEL start]
                        |
                        v
Slice 4 — item 2b/2c (concurrent-dispatch registry +     [depends on: nothing blocking,
           reviewer caveat)                                but land before Slice 5]
                        |
                        v
Slice 5 — item 3a/3b (dispatch-identity lock, built on   [depends on: Slice 4's registry
           Slice 4's registry directory convention)        existing — SERIAL after Slice 4]
                        |
                        v
Slice 6 — item 4b or 4c (close-with-pointer, or          [depends on: Slice 3's result]
           cross-repo port authored in runner-plugin's
           own session)
```

- **Slices 1, 2a, 3 can run fully in parallel** — zero file overlap, different repos/directories
  for the doc-only pieces, and item 1's new hook files don't touch anything item 2 or 4 touch.
- **Slice 4 before Slice 5 is a hard serialization**, not a preference: item 3's lock reuses
  item 2's `.claude/state/crew/active-dispatches/` directory convention and session-keyed JSON
  shape. Building 3 first would either duplicate the registry pattern or require a rebase.
- **Item 3 (Slice 5) should be its own review-gated slice**, not folded into Slice 1's PR,
  even though both touch `SubagentStop` hooks — its `autonomous_safe: false` flag (§3) means
  it needs a human pass before merge, which would otherwise block Slice 1's low-risk landing.
- **Slice 6 depends on Slice 3's finding**: if `updatedInput` is confirmed working, Slice 6 is
  a five-minute issue-close; if not, it becomes real (if modest) build work, and per the
  cross-repo HARD RULE must be authored from a `runner-plugin` worktree/session, never
  cross-session from dev-team.

## 6. Summary table

| Item | Mechanism | Files (dev-team) | Parallel / Serial | Plugin-fixable vs upstream |
|---|---|---|---|---|
| #187/#174 deliver-before-die | New `SubagentStop` hook generalizing dev-team#199's reviewer-decision-guard pattern to builder-tier agents, reusing `incomplete-detector.ts` | `hooks/check-builder-terminal-state.ts` (new) + lib + tests, `hooks.json`, `crew.json` | **Parallel** (Slice 1, disjoint from 2/3/4) | Plugin-fixable for #187 (write-order/gate). #174's literal harness-cutoff-prediction ask is upstream/harness — explicitly out of scope, already tested-and-rejected in prior research. |
| #169/#154 worktree-isolation | (a) Dispatch-discipline doc fix mandating `isolation: "worktree"`; (b) concurrent-same-dir dispatch registry extending `dispatch-timing-pre-tap.ts`; (c) reviewer caveat injection | `commands/build.md`, `commands/parallel.md` (Slice 2a, parallel); `hooks/lib/concurrent-dispatch-registry.ts`, `dispatch-timing-pre-tap.ts`, `check-subagent-return.ts` (Slice 4, serial before item 3) | **Mixed**: 2a parallel, 2b/2c serial-before-Slice-5 | #169's core fix (`isolation: "worktree"`) is a harness primitive that already exists (confirmed via `EnterWorktree`'s own description) — the gap was dispatch discipline, fully plugin-fixable via docs. #154's detection half is plugin-fixable; true prevention of same-dir tsc contamination is inherent to sharing a dir and out of scope by design (use worktrees instead). |
| #162 dup-completion guard | Dispatch-identity lock (`fs`-based exclusive-create, keyed on taskId+worktreeRoot), checked at `SubagentStop` before honoring a completion report; peer-stop capability flagged as harness-authorization-scoped, not built | `hooks/lib/dispatch-identity-lock.ts` (new) + tests, a `SubagentStop` hook consuming it, `skills/workflow/builder-ceremony/SKILL.md` | **Serial**, depends on Slice 4's registry directory | Detection/warning is plugin-fixable (built here). True peer-`TaskStop` authority is a harness/CLI capability question — flagged out of scope, recovery playbook documented instead. |
| #205 modelRouting hard-enforce | Already shipped in dev-team (`pre-tool-use-model-enforce.ts` + `model-routing-enforce.ts`, landed 2026-07-06, pre-dates the issue). Confirm `updatedInput` is honored, then close-with-pointer; residual gap is `runner-plugin`'s `start-slice.mts`, a cross-repo port | None expected in dev-team; possibly `commands/build.md` if 4c triggers | **Parallel** (Slice 3, observation-only) then **Slice 6** gated on its result | Dev-team half already plugin-fixed. Residual is explicitly cross-repo (`astragenie/runner-plugin`) — must be authored from that repo's own session per this repo's HARD RULE, not from here. |

## 7. Single highest-leverage fix

**Item 1's builder-terminal-state guard (§1, Slice 1).** It closes the most evidence-backed,
highest-cost failure mode in the cluster (#187's four occurrences burned 100k–390k tokens each
for zero usable output), it requires zero new mechanism — it is a straight copy of a pattern
(`check-reviewer-decision.ts`, dev-team#199) already proven correct in this exact codebase for
a sibling agent tier, it reuses detection logic that was already built and explicitly reserved
for this purpose (`incomplete-detector.ts`'s header literally names "#162 owns the
blocking/lockfile enforcement layer on top of this," and item 1 is the analogous layer for
#187), and it is fully parallel-safe against every other item in this cluster. It is also the
one fix in this doc that turns a previously-identified, previously-unbuilt "Quick Win #1" from
the 2026-07-06 research doc into shipped code — closing a four-day-old known gap rather than
opening a new investigation.
