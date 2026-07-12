# Subagent-lifecycle guards — design pass (Wave 3 B0)

**Date:** 2026-07-12
**Type:** Read-only design (no source edited)
**Cluster:** issues #187, #174 (deliver-before-die), #169, #164 (worktree-isolation), #162 (dup-completion)
**Extends:** `docs/design/2026-07-10-subagent-lifecycle-reliability.md` (Wave-B0, 2026-07-10) — that
doc's root-cause analysis for #187/#174/#169/#162 stands; this pass re-verifies it against the
current repo state (two days later, post `#163` chore-lane merge, post model-routing disable
`#219`), swaps `#154` for `#164` per this cluster's actual issue set, and turns the finding into a
build-ready slice sequence. Nothing in that prior doc is contradicted; §0 and §2's `#164` note are
superseded by fresher findings below.

---

## 0. Headline finding before the design: two of five sub-problems are already closed

Re-grepped the repo before designing anything new, because the 2026-07-10 doc's own headline
finding was "#205 turned out to be already half-shipped" — same discipline applies here.

1. **`#164` (pre-push-verifier worktree-blind scan) is fully shipped**, not open work. Commit
   `8fe359d5` ("fix(hooks): worktree-aware pre-push-verifier scan + clearer block message (#164)
   (#212)", merged 2026-07-10) landed all three defects `#164` describes:
   - Defect 1 (worktree-blind `cwd` scan) — `hooks/pre-push-verifier.ts:61-97`,
     `resolveCommandCwd` + `resolveGitWorktreeRoot` + `resolveTargetRepoRoot`, parses a leading
     `cd <path> &&` off the command and resolves via `git rev-parse --show-toplevel` before
     scanning `.claude/artifacts/crew/validations/`.
   - Defect 2 (whole-command block, unclear message) — `hooks/pre-push-verifier.ts:277-281`,
     block message now states "this blocks the ENTIRE command as submitted."
   - Defect 3 (misleading generic "not found") — `hooks/pre-push-verifier.ts:112-217, 266-273`,
     `ValidationScan` now carries `scannedDir` / `windowFileCount` / `newestArtifactPath` /
     `newestDecision` and the block message reports all four.
   - **The GitHub issue is still open** (`gh issue view 164` → `state: OPEN`) — stale tracker,
     not stale code. Action: close `#164` with a pointer to PR `#212`, no build needed.
2. **`#187`/`#174`'s buildable half (the terminal-state guard) was scoped but never built** —
   confirmed via `find`: `hooks/check-builder-terminal-state.ts` does not exist, `hooks.json`'s
   `SubagentStop` array has exactly `log_event.sh` / `otel-subagent-stop.ts` /
   `check-reviewer-decision.ts` (reviewer-tier only, `hooks/lib/check-reviewer-decision.ts:44-46`
   scopes to `REVIEWER_TIER_AGENTS`). `hooks/lib/check-subagent-return.ts:215` still always
   returns `decision: "approve"` for the inline-return warning — detection-only, as the prior
   doc found.
3. **`#169`'s dispatch-discipline fix was never written** — `commands/build.md` / `fix.md`
   already document a *self*-isolation ceremony (the dispatcher session moves itself into a
   worktree on branch collision, `commands/build.md:61-68`), but neither that file nor
   `commands/parallel.md` nor `agents/architect.md`'s peer-dispatch section instructs a
   dispatcher to pass `isolation: "worktree"` on an `Agent`-tool call when *dispatching a peer*
   into a separate tree. `commands/parallel.md:34-44` spawns worktrees via an external
   `loop dispatch prepare` CLI step and then issues N `Agent` calls with a per-worktree prompt —
   never the `isolation:` parameter. This is exactly `#169`'s repro shape (prompt-text cwd
   instruction, not a harness-pinned cwd) and it is unfixed.
4. **`#162`'s dispatch-identity lock was never built** — no
   `.claude/state/crew/worktree-locks/` directory exists, no lock-acquisition hook, and
   `skills/workflow/builder-ceremony/SKILL.md`'s "Turn discipline" section documents the policy
   in prose only (per the prior doc's finding, still true).
5. **`checkpoint-cadence` (the "make death cheap" backstop referenced in the dispatch prompt) is
   shipped and live** — `hooks/lib/checkpoint-cadence.ts`, feature-flagged default-on since
   `0.54.0` (`scripts/lib/features-service.ts:100-108`), fires every 20 post-edit tool calls.
   It is a distinct, complementary mechanism to guard 1 below (middle-of-dispatch nudge vs.
   terminal-state gate) — don't touch it, don't re-scope it.

Net: this design pass has **two real builds** (guard 1, guard 3), **one mostly-docs fix** (guard
2's dispatch-discipline half), and **one pure hygiene item** (close `#164`).

### Today's live evidence (new since the 2026-07-10 doc)

A dispatch today finished *all* its actual work — code committed, PR opened — and still died
mid-report: the truncated result was `"Now let's open the PR."`, i.e. truncation landed **after**
the risky part (commit + push + `gh pr create`) but **before** the terminal `STATUS:` line the
dispatcher's gates look for. This is a fourth, narrower failure shape than `#187`'s "empty
artifact scaffold" or `#174`'s "mid-task cutoff with broken WIP": here nothing was lost except the
one sentence that tells the dispatcher it's safe to trust the result. It is the cheapest possible
case for guard 1 to catch — the fix is "block once, ask for one `STATUS: DONE` line," not "recover
lost work" — which is direct evidence the SubagentStop-time gate (not a mid-task nudge) is the
right intervention point for this residual tail.

**Complementarity with `runner-plugin#393`** (slice-size cap, landing as `W2-b` in the sibling
plan, different repo): `#393` is upstream prevention — it caps slice size at triage/decompose time
so a normal dispatch never approaches the ~65–85-tool-call cutoff. Guard 1 is downstream safety
net — it catches the cases that still hit the cutoff despite sizing (today's evidence shows even a
*finished* dispatch can clip its last sentence). Zero file overlap (different repos, different
lifecycle stage); both should ship, neither substitutes for the other.

---

## 1. Guard 1 — deliver-before-die (`#187` / `#174`)

### Mechanism

Generalize `hooks/check-reviewer-decision.ts` (`#199`, proven in this exact codebase) to
builder-tier agents. New sibling hook, not an edit to the reviewer one — the "delivered" test
differs (builders report a `STATUS:` line per `agents/fullstack-dev.md:205-211`'s
`STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}` contract, not a `decision:` line).

- **Hook event:** `SubagentStop`, scoped to `BUILDER_TIER_AGENTS`
  (`hooks/lib/model-routing-enforce.ts:38-44` — `fullstack-dev`, `backend-dev`, `frontend-dev`,
  `aiplugin-dev`, `dev-lite`; import the existing export, do not redeclare the list a third
  time).
- **Detection:** reuse `hasTerminalStatusMarker` / `detectSubagentIncomplete` from
  `scripts/lib/subagent-return/incomplete-detector.ts` verbatim — that module's header already
  reserves this exact use ("#162 owns the blocking/lockfile enforcement layer on top of this").
  A stop is "delivered" when the last assistant message has a `STATUS ∈ {DONE, BLOCKED, HELP,
  IN-PROGRESS}:` line (via `hasTerminalStatusMarker`) OR an artifact path (via
  `hasArtifactPath`, reused from `scripts/lib/subagent-return/check.ts:36-38` — same helper
  `check-reviewer-decision.ts` already imports).
- **Decision:** on `stop_hook_active !== true` and neither signal present, return
  `{"decision":"block","reason":"..."}` naming the missing contract element and directing the
  agent to either finish the `STATUS:` line (cheap — today's live-evidence case) or commit WIP +
  report `STATUS: BLOCKED` with what's left. One retry only — `stop_hook_active` re-entry guard,
  identical to `#199`'s.
- **AC2 guardrail (carried from the 2026-07-10 doc, still correct):** `STATUS: BLOCKED — <reason>`
  must NOT be blocked. Blocked is itself a valid terminal state; forcing completion would convert
  a legitimate stop into a stuck loop.

### Files touched

- New: `hooks/check-builder-terminal-state.ts` (shim, mirrors
  `hooks/check-reviewer-decision.ts`'s stdin/stdout/`logHookError` shape), `hooks/lib/check-builder-terminal-state.ts`
  (logic, mirrors `hooks/lib/check-reviewer-decision.ts`), `tests/check-builder-terminal-state.test.ts`.
- Edit: `hooks/hooks.json` (additive `SubagentStop` array entry — the array already has 3
  entries, this is a 4th), `scripts/lib/features-service.ts` (add a `builder-terminal-state-guard`
  entry to the `FEATURES` registry, default `true`, mirroring the `reviewer-decision-guard` entry
  at lines 127-135), `docs/standards/agent-playbook.md` (document the terminal-state contract as
  enforced, not advisory).
- Reused, unedited: `scripts/lib/subagent-return/incomplete-detector.ts`,
  `scripts/lib/subagent-return/check.ts`, `hooks/lib/model-routing-enforce.ts` (import
  `BUILDER_TIER_AGENTS` only).

### Fail-open story

Same three-way fail-open as `#199`'s precedent, all already proven in this codebase:
`stop_hook_active === true` → pass through (no re-block loop); malformed JSON or missing
`agent_name` → pass through; `last_assistant_message` absent (older harness build, or an event
shape this hook doesn't recognize) → log + pass through, never guess. Hook-level try/catch in the
shim (`hook-error.ts`) covers any unexpected throw with `process.exit(0)`.

### Feature flag

`crew.json features["builder-terminal-state-guard"].enabled`, default `true`. `isEnabled()`
(`scripts/lib/features-service.ts:167-186`) already treats a missing key as "use the registry
default," so no crew.json edit is required in consumer repos to get default-on behavior.

### Test strategy

Fixture-driven, no live parallel agents needed (matches `tests/model-routing-enforce.test.ts`'s
shape): synthetic `SubagentStop` payloads for (a) builder-tier + no marker + no artifact → block;
(b) builder-tier + `STATUS: BLOCKED` → pass; (c) builder-tier + artifact path only → pass; (d)
non-builder-tier agent → pass (untouched, scope check only); (e) `stop_hook_active: true` → pass
regardless of content; (f) malformed JSON / missing `last_assistant_message` → pass + logged, not
blocked; (g) `features["builder-terminal-state-guard"].enabled=false` → pass unconditionally,
verified through the shared `isEnabled` helper (no hook-local bypass flag to drift out of sync).

### autonomous_safe

`true` at the guard level — mechanical extension of a proven pattern, fail-open by construction,
zero change to any agent's actual work product. (The Wave-3 *lane* is still `autonomous_safe:
false` per the stabilization-waves plan; that's a lane-level human-in-loop policy on hooks/dispatch
code generally, independent of this guard's own low individual risk.)

---

## 2. Guard 2 — worktree-isolation (`#169` / `#164`)

### `#164` half: already done (§0.1)

Close the GitHub issue with a pointer to commit `8fe359d5` / PR `#212`. No design or build needed.
Do not re-open scope here — re-litigating shipped code wastes the review budget this lane is
supposed to protect.

### `#169` half: dispatch-discipline fix (the actual remaining work)

**Root cause, re-confirmed:** `#169`'s repro was a dispatcher naming a worktree path in prompt
text instead of using the `Agent` tool's own `isolation: "worktree"` parameter (confirmed present
and described in this environment's own tool schema: "creates a temporary git worktree so the
agent works on an isolated copy of the repo"). The harness already has the pinning primitive; nothing
plugin-side needs to invent cwd enforcement — the gap is that dev-team's own dispatch-authoring
docs never tell a dispatcher to use it for peer/background dispatch into a separate tree.

**Mechanism:** doc-only. Update:
- `commands/build.md` / `commands/fix.md` — these already have a self-isolation ceremony
  section (`build.md:61-68` / `fix.md:63-70`); add an adjacent, clearly-separated note: when
  *this* command's ladder peer-dispatches a background/parallel builder into a tree different
  from its own cwd, that dispatch MUST use `isolation: "worktree"` (or `EnterWorktree`'s `path:`
  form to attach an existing one) on the `Agent` call — never a prompt-text "operate in `<path>`"
  instruction alone. Don't conflate this with the existing self-isolation ceremony; they solve
  different problems (dispatcher isolates itself vs. dispatcher isolates a peer).
- `commands/parallel.md:34-44` — the step that currently spawns worktrees via
  `loop dispatch prepare` then issues N bare `Agent` calls: add explicit guidance that each
  `Agent` call in that parallel batch passes `isolation: "worktree"` pointed at (or `path:`-attached
  to) the worktree the CLI step just created, closing the literal gap this file has today.
- `agents/architect.md`'s peer-dispatch section (`.claude/crew/constitution.md`'s "Peer dispatch
  (v0.36+)" — 10 agents carry the `Agent` tool per FEAT-163/DEC-022/DEC-023) — same guidance
  wherever it authors a background dispatch into a separate tree.

**Verification approach (not a new hook):** a grep-based check, documented as an AC rather than
built as enforcement — a prompt-text "operate in `<worktree path>`" pattern without an
accompanying `isolation:` field in the same dispatch is the anti-pattern this closes. This can be
a one-off `grep` during review of the doc PR, not ongoing tooling; the actual runtime guarantee
comes from the harness's own cwd pinning once `isolation:` is actually passed, not from
plugin-side detection.

### The hard cwd-assertion question (explicitly asked for in this pass — answered, not deferred)

The dispatching prompt asks to "design a PreToolUse assertion that `cwd == assigned worktree
root` before writes (Edit/Write/Bash)." Evaluated against what's actually feasible:

- **What a `PreToolUse Edit/Write/Bash` hook can see:** `cwd` (session-tracked working dir),
  `session_id`, and the tool's own `tool_input` (confirmed via `hooks/pre-push-verifier.ts:34-54`
  and `hooks/record-edit.ts`'s payload shape) — but **not** which worktree the dispatcher
  *intended* this subagent to operate in. That intent lives in the parent's `Agent`-tool call
  (`isolation:` / prompt text), which is not part of the subagent's own `PreToolUse` payload.
- **If guard 2's docs fix lands and dispatchers actually pass `isolation: "worktree"`:** the
  harness pins the subagent's cwd at launch (per the tool's own description) — a plugin-side
  re-check of "is my cwd the worktree I was launched into" is checking a harness invariant that,
  if broken, is a harness bug this plugin can't meaningfully assert around (the subagent's `cwd`
  IS whatever the harness set it to; there's no independent "expected" value to compare against
  without re-deriving the dispatcher's original intent, which isn't available at this hook site).
- **If a dispatcher skips `isolation:` and uses prompt text instead** (the actual `#169` repro,
  and the case this ask is really worried about): the "expected worktree" still has no reliable
  source at `PreToolUse` time without a transcript read to recover the prompt's stated path — the
  2026-07-06 mid-job-death analysis already rejected per-tool-call transcript reads as
  prohibitively expensive for a hot-path hook (`PreToolUse` fires on every `Edit`/`Write`/`Bash`
  call).

**Recommendation: do not build the hard assertion guard.** It would be checking a value it can't
independently source. Fix the dispatch discipline instead (above) — that closes the actual `#169`
repro shape at the point where the missing information (dispatcher intent) still exists, rather
than trying to reconstruct it downstream. If a *future* incident shows dispatchers ARE passing
`isolation:` correctly and subagents are STILL writing to the wrong tree despite that, that would
be evidence of a harness-level cwd-pinning bug — a different report, not a plugin-side hook to
build defensively today. This mirrors the prior doc's `2d` finding; re-verified against this pass's
current tool schema (`isolation` param confirmed present) rather than assumed unchanged.

### Files touched

- Edit (doc-only): `commands/build.md`, `commands/fix.md`, `commands/parallel.md`, the
  peer-dispatch section of `agents/architect.md` (and any sibling peer-dispatch-authoring agent
  prompt found during build — `agents/uxdesigner.md`, `agents/document-writer.md` per the
  constitution's peer-dispatch whitelist).
- GitHub: close `#164` with the PR `#212` pointer. No source file edits for this half.

### Fail-open / feature flag / test strategy

N/A — doc-only change, no runtime hook. "Test" is a manual read-through + the grep check above
during review, not an automated suite.

### autonomous_safe

`true` — doc edits only, no runtime behavior change, no new failure mode introduced.

---

## 3. Guard 3 — dup-completion (`#162`)

### Mechanism

Independent of guard 2 in this pass — the 2026-07-10 doc recommended building guard 3's lock atop
a "concurrent-dispatch registry" that was actually addressing `#154` (same-dir non-worktree
typecheck contamination). `#154` is not in this cluster's issue set (`#164` replaced it); no
registry is being built this pass, so guard 3 gets its own minimal state directory rather than
waiting on one. This *reduces* the cross-guard dependency the prior doc flagged, it doesn't
reopen it — if a future pass revisits `#154`, that registry can still be layered in without
touching guard 3's lock file format.

- **Lock primitive:** new `hooks/lib/dispatch-identity-lock.ts`. Plain `fs` exclusive-create
  (`fs.open(path, "wx")`) against a key of `hash(taskId ?? sessionId, worktreeRoot)`, stored at
  `.claude/state/crew/worktree-locks/<hash>.json`. This is new code but small (<100 LOC) with
  three in-repo precedents to copy the shape from: `hooks/lib/dispatch-handle-store.ts`
  (file-per-key JSON convention, `dispatch-handle-store.ts:12-19`), `scripts/lib/gepa/run-with-lock.ts`
  (acquire → run → release-in-`finally` contract, `run-with-lock.ts:55-79` — copy the *shape*,
  not the *dependency*: `fileLockManager`'s `phase` enum is `"eval" | "optimize"` today
  (`run-with-lock.ts:26`), closed and gepa-core-domain-specific; widening it for dispatch
  identity would conflate two unrelated lock domains for no shared benefit — build the sibling
  instead), and `hooks/lib/check-reviewer-decision.ts` (detect-and-block posture at
  `SubagentStop`).
- **Hook event:** `SubagentStop`, as a **separate** hook file from guard 1
  (`hooks/check-dispatch-completion-lock.ts` + `hooks/lib/check-dispatch-completion-lock.ts`),
  not folded into `check-builder-terminal-state.ts`. Rationale in §4 below (file-collision /
  review-gating).
- **Decision logic:** fires only when the stop *would otherwise be honored as a completion*
  (i.e., after guard 1's terminal-state check would pass — a `DONE`-shaped stop with an artifact
  or explicit `STATUS: DONE`). Acquire the lock keyed on `(taskId, worktreeRoot)`. If already held
  by a different `session_id`: this is the fork (`#162`'s exact repro) — log it and emit a
  `systemMessage` telling the LATER-arriving copy "another session already claimed completion for
  this dispatch; treat your local changes as redundant, do not commit further, defer to the
  earlier report." **This is detect-and-warn, not a hard block** — a `SubagentStop` hook cannot
  stop a session that's already mid-write; `#162`'s own evidence confirms `TaskStop` is
  lead/orchestrator-scoped, not peer-scoped, so a hook can't grant stronger authority than the
  harness already withholds. If not held, acquire and let the stop proceed normally; release
  (delete the lock file) on that successful completion.
- **Staleness policy (must be decided during build, not deferred silently — carried over as an
  explicit AC from the prior doc):** an orphaned lock (file present, no live session behind it —
  e.g. the acquiring session crashed before release) must not permanently wedge future dispatches
  on that key. Recommend a TTL check on lock age (e.g., >1h with no matching completed/blocked
  report elsewhere) rather than PID-liveness (subagent sessions aren't OS processes this hook can
  `kill -0`) — same time-window convention `pre-push-verifier.ts`'s `CACHE_WINDOW_MS` already
  uses, for consistency.
- **Peer-stop capability (`#162` ask #3):** explicitly out of scope, same finding as the prior
  doc — `TaskStop` is orchestrator-scoped per `#162`'s own evidence; this is a harness
  authorization-model question, not a hook-buildable one. Document the residual: the lock makes
  the fork *detectable and loud*, but the dispatcher is still the only party that can `TaskStop`
  the loser. Codify the existing informal recovery ("after nudging an idle builder, verify
  worktree state before building on top") as an explicit step in the relevant dispatcher-facing
  doc (`commands/build.md` or `.claude/crew/workflow.md`), not new code.

### Files touched

- New: `hooks/check-dispatch-completion-lock.ts`, `hooks/lib/check-dispatch-completion-lock.ts`,
  `hooks/lib/dispatch-identity-lock.ts`, `tests/dispatch-identity-lock.test.ts`,
  `tests/check-dispatch-completion-lock.test.ts`.
- Edit: `hooks/hooks.json` (additive `SubagentStop` entry — 5th, after guard 1's), `scripts/lib/features-service.ts`
  (new `dispatch-completion-lock` entry, default `true` but human-reviewed per its
  `autonomous_safe: false` status below — default-on is still appropriate since fail-open makes
  the worst case "detection didn't fire," not "false block"), `skills/workflow/builder-ceremony/SKILL.md`
  (point the "Turn discipline — dev-team#171/#198/#162" section at the real mechanism instead of
  unenforced prose — closes the exact prose/reality drift `#187` also warns about), a
  dispatcher-facing doc (`commands/build.md` or `.claude/crew/workflow.md`) for the recovery
  playbook.

### Fail-open story

Lock-acquisition failure for any reason other than "already held by a different session" (disk
error, malformed existing lock file, unexpected exception) must fall through to "allow the stop,
log the anomaly" — the lock is a duplicate-detection aid, not a gate that can plausibly justify
blocking a builder's legitimate, singular completion. `stop_hook_active` re-entry guard, same as
guards 1 and `#199`. Malformed `SubagentStop` payload → pass through.

### Feature flag

`crew.json features["dispatch-completion-lock"].enabled`, default `true`.

### Test strategy

Fixture-driven: (a) two `SubagentStop` events for the same `(taskId, worktreeRoot)` key from
different `session_id`s in sequence — first acquires cleanly, second is flagged with the
stand-down message, not blocked; (b) lock released after a successful completion, verified by a
third dispatch on the same key succeeding cleanly afterward; (c) a synthetic stale lock (old
mtime, no corresponding completion) does not wedge a fresh dispatch on that key; (d) full `#162`
repro as a fixture — idle-then-nudge-then-both-complete, asserting the second completion is
flagged not silently duplicated; (e) `features["dispatch-completion-lock"].enabled=false` → lock
check skipped entirely, guard 1's terminal-state check still runs independently (proves the two
hooks are genuinely decoupled, not silently order-dependent).

### autonomous_safe

`false` — this is the one guard in the cluster that changes multi-agent *coordination* semantics
(which copy is authoritative), not just single-agent reporting discipline. A subtle bug (lock
that never releases on crash, hash collision across genuinely different dispatches) could convert
`#162`'s actual outcome ("duplicate work, luckily harmless") into "a copy was wrongly told to
stand down." Human review required before merge, independent of guard 1's lower individual risk.

---

## 4. File-collision matrix and build order

| Files | Guard 1 | Guard 2 | Guard 3 |
|---|:---:|:---:|:---:|
| `hooks/check-builder-terminal-state.ts` + lib + test | **owns** | — | — |
| `hooks/check-dispatch-completion-lock.ts` + lib + test | — | — | **owns** |
| `hooks/lib/dispatch-identity-lock.ts` + test | — | — | **owns** |
| `hooks/hooks.json` | edits (additive array entry) | — | edits (additive array entry) |
| `scripts/lib/features-service.ts` | edits (new registry entry) | — | edits (new registry entry) |
| `docs/standards/agent-playbook.md` | edits | — | — |
| `commands/build.md` | — | edits | maybe (recovery playbook, or `.claude/crew/workflow.md` instead — author's call) |
| `commands/fix.md`, `commands/parallel.md`, `agents/architect.md` | — | edits | — |
| `skills/workflow/builder-ceremony/SKILL.md` | — | — | edits |
| GitHub `#164` | — | close (no file) | — |

**Reading the matrix:** guards 1 and 3 are **file-disjoint on every new file** — the only shared
files are `hooks.json` (additive array entries, both guards append their own object; a two-line
diff conflict at worst, trivially resolved) and `features-service.ts` (additive registry entries,
same low-risk shape). Guard 2 touches **zero files guards 1 or 3 touch** — it's pure documentation
in `commands/*.md` and `agents/architect.md`.

**This means all three guards are parallel-buildable with zero hard serialization**, a materially
simpler picture than the 2026-07-10 doc's sequencing (which had guard 3 hard-blocked on a guard-2
registry that turns out to be out of scope for this cluster). The only soft coordination point:
if guards 1 and 3 land as separate PRs in close succession, whoever merges second should rebase
past the first's `hooks.json` / `features-service.ts` additive hunks rather than resolving a real
logical conflict — there isn't one.

### Recommended build order

1. **Guard 2's doc fix + `#164` close-out** — smallest, zero-risk, zero new code, unblocks
   nothing else but should land first simply because it's nearly free and removes a stale
   tracker item.
2. **Guard 1 (builder-terminal-state)** — highest leverage per the 2026-07-10 doc's own
   conclusion (still true: proven pattern, existing detection logic, `autonomous_safe: true` at
   the guard level, and today's live evidence is the cheapest possible case for it to catch).
   Land and bake before guard 3 so guard 3's SubagentStop-time lock check has a stable,
   already-reviewed terminal-state signal to sit behind ("only check the lock on a stop guard 1
   would already treat as DONE-shaped").
3. **Guard 3 (dispatch-completion-lock)** — last, because it's the one `autonomous_safe: false`
   item needing a dedicated human review pass, and because its "only fires on a DONE-shaped stop"
   framing is cleanest to reason about once guard 1's contract is live and tested (not a hard
   code dependency — a review-clarity one).

Guards 1 and 2 could run fully in parallel (zero file overlap, no ordering need) if two builders
are available; guard 3 is the one item worth keeping serial-after-guard-1 by choice, not by file
constraint.

---

## 5. What's reused vs. added

**Reused, unedited:**
- `scripts/lib/subagent-return/incomplete-detector.ts` — `hasTerminalStatusMarker`,
  `detectSubagentIncomplete` (guard 1).
- `scripts/lib/subagent-return/check.ts` — `hasArtifactPath` (guard 1, already imported by
  `check-reviewer-decision.ts` too).
- `hooks/lib/model-routing-enforce.ts` — `BUILDER_TIER_AGENTS` constant import only (guard 1).
- `hooks/lib/check-reviewer-decision.ts` — copied as the structural pattern (parse → scope-check
  → feature-flag-check → detect → block-or-pass, with `stop_hook_active` and malformed-input
  fail-open) for both guard 1 and guard 3's shims. Not imported — the "delivered" definitions
  differ enough (STATUS line vs. decision line, plus guard 3's lock semantics) that copying the
  shape and diverging the content is cleaner than trying to parameterize one hook over both
  agent tiers and two different completion contracts.
- `hooks/lib/dispatch-handle-store.ts` — file-per-key JSON persistence convention, copied as
  the pattern for guard 3's lock file (not imported directly — different key derivation, and
  the store here has no "handle-vs-file" cross-process load/delete symmetry to reuse code from).
- `scripts/lib/gepa/run-with-lock.ts` — acquire/release-in-`finally` contract copied as the
  pattern for guard 3; explicitly NOT using `fileLockManager` itself (closed `phase` enum, wrong
  lock domain).
- `checkpoint-cadence.ts` / feature flag — untouched, kept as the complementary mid-dispatch
  backstop (§0.5). Nothing in this design edits it.
- `scripts/lib/features-service.ts`'s `FEATURES` registry + `isEnabled`/`readCrewConfig` —
  extended (two new entries), not restructured.

**Added (genuinely new code):**
- `hooks/check-builder-terminal-state.ts` + `hooks/lib/check-builder-terminal-state.ts` (guard 1).
- `hooks/check-dispatch-completion-lock.ts` + `hooks/lib/check-dispatch-completion-lock.ts` +
  `hooks/lib/dispatch-identity-lock.ts` (guard 3).
- Doc edits across `commands/build.md`, `commands/fix.md`, `commands/parallel.md`,
  `agents/architect.md` (guard 2) and `docs/standards/agent-playbook.md`,
  `skills/workflow/builder-ceremony/SKILL.md` (guards 1 and 3 respectively).

**Explicitly not added, with reasoning documented above:** a hard `PreToolUse Edit/Write/Bash`
cwd-assertion hook (§2 — infeasible without transcript access to recover dispatcher intent, and
redundant once `isolation:` is actually used); a `#154`-style concurrent-dispatch registry (out
of scope for this cluster's issue set, not needed as a guard-3 dependency once `#154` and `#162`
are correctly treated as separate problems); any change to `fileLockManager`'s gepa-core `phase`
enum (wrong lock domain).

---

## 6. Open questions — RESOLVED 2026-07-12 (lane unblocked)

All five answered; the lane may proceed to build. Resolutions:

1. **Guard 3 staleness policy — TTL 1h, no secondary signal.** Reclaim a lock whose file mtime is
   older than 1h. Matches `pre-push-verifier.ts`'s `CACHE_WINDOW_MS` convention so the repo keeps
   one time-window idiom. Explicitly NOT cross-checking `workflow-state.json`'s `currentRun` —
   that couples the lock to a second file's schema and adds a failure mode when that file is itself
   stale. Residual risk accepted: a dispatch still live past 1h could have its lock stolen; unlikely
   given the ~65–85-tool-call death ceiling this lane exists to work around.
2. **SubagentStop hook stacking — settle empirically, not by decision.** Whether the harness runs
   all matched `SubagentStop` hooks or short-circuits after one returns `block` is unverified here.
   Live smoke test during guard 1's build, BEFORE guard 3 adds a second builder-tier hook that
   depends on the answer. Guard 3 does not start until this is known.
3. **`#164` close-out — inline, not a slice.** Pure tracker hygiene (code shipped in `8fe359d5` /
   PR `#212`). Close at Wave 3 kickoff; do not scope it into guard 2's doc PR.
4. **Guard 2's cwd-assertion reversal — SIGNED OFF. Docs-only fixes `#169`.** The hard
   `PreToolUse Edit/Write/Bash` assertion is NOT built: it would compare `cwd` against an
   "expected worktree" it cannot independently source (dispatcher intent lives in the parent's
   `Agent`-tool call, absent from the subagent's own hook payload; recovering it needs a
   per-tool-call transcript read, already rejected as too expensive for a hot-path hook). The fix
   is mandating `isolation: "worktree"` at the dispatch site, where that intent still exists.
   **Reopen trigger (recorded):** an incident where dispatchers demonstrably DO pass `isolation:`
   correctly and a subagent still writes outside its assigned tree. That would be a harness
   cwd-pinning bug — a report upstream, not a plugin-side hook.
5. **Doc-of-record split — confirmed non-duplicative.** Guard 1 → `docs/standards/agent-playbook.md`
   (already the agent-contract doc). Guard 3 → `skills/workflow/builder-ceremony/SKILL.md` (its
   "Turn discipline" section already names `#162` in prose; point it at the real mechanism). No new
   content in `.claude/crew/workflow.md` — avoids a third near-synonymous location.

<details>
<summary>Original open questions (pre-resolution)</summary>


1. **Guard 3's staleness policy** (§3): TTL-based (e.g. >1h, matching `pre-push-verifier`'s
   `CACHE_WINDOW_MS` convention) is the recommendation, but the exact window and whether to add a
   secondary signal (e.g. cross-check against `.claude/state/crew/workflow-state.json`'s
   `currentRun` status) needs a decision before build, not a default baked in silently.
2. **Guard 3's hook-array position relative to guard 1** in `hooks.json`'s `SubagentStop` array:
   this repo has never run two independently-authored `SubagentStop` hooks against the *same*
   agent tier before (`check-reviewer-decision.ts` is reviewer-only; guards 1 and 3 both fire on
   builder-tier stops). Whether Claude Code's harness runs all matched `SubagentStop` hooks
   regardless of an earlier one's `block` decision, or short-circuits, is unverified in this
   codebase — needs an empirical check (a fixture test alone can't prove harness-level stacking
   behavior; recommend a deliberate live smoke test during guard 1's build, before guard 3 adds a
   second builder-tier `SubagentStop` hook that depends on ordering).
3. **Whether to build the `#164`-style close-out as part of this lane at all**, given it's pure
   GitHub hygiene with no code change — could instead be done inline by whoever runs the Wave 3
   kickoff, without spinning up a slice/PR for it. Flagging so it doesn't silently get scoped
   into guard 2's build PR and inflate that PR's diff for a change that isn't code.
4. **Guard 2's recommendation to not build a hard cwd-assertion hook** (§2) is a reversal-in-spirit
   of what the dispatching prompt asked for by name. This needs explicit human sign-off before
   the lane proceeds on "docs-only fixes `#169`" rather than "a new blocking hook fixes `#169`" —
   flagging prominently rather than silently downgrading the ask.
5. **Guard 1 and guard 3 both want a `docs/standards/agent-playbook.md` / `skills/workflow/builder-ceremony/SKILL.md`
   edit respectively** — confirm these are in fact the right doc-of-record for each (not
   duplicative with each other or with `.claude/crew/workflow.md`) before the builder starts,
   since doc sprawl across three near-synonymous locations (`agent-playbook.md`,
   `builder-ceremony/SKILL.md`, `.claude/crew/workflow.md`) is itself a minor drift risk this
   lane shouldn't add to.

</details>

---

## 7. Summary table

| Guard | Issue(s) | Status found | Remaining work | Files (new/edit) | Parallel/Serial | autonomous_safe |
|---|---|---|---|---|---|---|
| 1. deliver-before-die | `#187`, `#174` | Scoped 2026-07-10, unbuilt | Full build | 3 new + 3 edits | Parallel-safe vs. 2 & 3 (file-disjoint) | `true` (guard-level) |
| 2. worktree-isolation | `#169`, `#164` | `#164` already shipped (`8fe359d5`/PR `#212`); `#169` unbuilt | Docs-only fix + issue close | 0 new + 4 edits + 1 issue close | Parallel-safe vs. 1 & 3 | `true` |
| 3. dup-completion | `#162` | Scoped 2026-07-10, unbuilt; registry dependency dropped (out-of-scope `#154`) | Full build | 5 new + 3 edits | File-disjoint from 1 & 2; recommended serial-after-1 by choice (review clarity, not a code dependency) | `false` — human review required |

## 8. Executive summary (10 lines)

Two of five sub-problems turned out already closed: `#164` shipped in full 2 days ago (commit
`8fe359d5`/PR `#212`) — just close the stale GitHub issue, no build. Guard 1
(deliver-before-die) is the highest-leverage remaining item: a proven `#199` pattern, reused
detection logic, `autonomous_safe: true`, and today's live evidence (a dispatch that finished all
its work but died one sentence short of its `STATUS:` line) is the cheapest case imaginable for it
to catch. Guard 2 (`#169`) is docs-only — mandate `isolation: "worktree"` in `build.md` /
`fix.md` / `parallel.md` / `architect.md`'s peer-dispatch section instead of prompt-text cwd
instructions; the hard `PreToolUse` cwd-assertion hook the dispatch prompt asked about is
explicitly **not recommended** (infeasible without transcript access, redundant once
`isolation:` is used correctly) — flagged as an open question needing explicit sign-off since it
reverses the literal ask. Guard 3 (`#162`) needs a real build (a small `fs`-based exclusive-create
lock, pattern-copied from `run-with-lock.ts` and `dispatch-handle-store.ts`, NOT from gepa-core's
`fileLockManager` — wrong lock domain) and is the one `autonomous_safe: false` item requiring
human review, because it changes multi-agent coordination semantics rather than single-agent
reporting discipline. Recommended build order: guard 2's docs fix first (near-free), then guard 1,
then guard 3 (serial-after-1 by review-clarity choice, not a hard file dependency). **All three
guards are file-disjoint on every new file** — the only shared touch points are additive entries
in `hooks.json` and `features-service.ts`, both low-collision — so this is a materially simpler,
more parallelizable picture than the 2026-07-10 predecessor doc, whose guard-3-depends-on-a-guard-2-registry
sequencing turns out not to apply once `#154` is correctly excluded from this issue cluster. Biggest
risk: unverified harness behavior when two independently-authored `SubagentStop` hooks both fire on
the same builder-tier stop (guards 1 and 3) — needs an empirical smoke test during guard 1's build,
before guard 3 stacks a second one on top.
