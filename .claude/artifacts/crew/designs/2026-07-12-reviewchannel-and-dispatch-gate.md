# ReviewChannel + dispatch gate + liveness/telemetry — 3 blocker resolutions

**Date:** 2026-07-12
**Status:** IN PROGRESS (written incrementally — see per-blocker status)
**Parent plan:** `.claude/artifacts/crew/designs/2026-07-12-tracker-provider-transition-plan.md` (v2)
**Budget:** read-only architect slice, target <150k tokens. Sources read: v2 plan (full),
`agents/reviewer.md`, `hooks/hooks.json`, `hooks/pre-tool-use-agent.ts`,
`hooks/lib/dispatch-timing-pre-tap.ts`, `hooks/pre-tool-use-model-enforce.ts`,
`hooks/lib/model-routing-enforce.ts`, `hooks/pre-tool-use-bash-gate.ts`,
`hooks/pre-push-verifier.ts` (grep only), `scripts/lib/features-service.ts`,
`.github/workflows/auto-merge.yml`, `git show 3cfb0bb0:scripts/lib/report-to-pr.ts` (not on
`main` — lives only on branch `feat/report-to-pr-contract-227`). Did NOT read runner-plugin
or plugins-common source, per instruction — runner facts below are carried from the v2 plan
text and are marked INFERRED where extrapolated.

---

## BLOCKER 1 — `ReviewChannel` interface

**Status: RESOLVED**

### Decision

Ship `ReviewChannel` as a git-host-scoped interface, GitHub-first, with three methods —
`submitReview`, `upsertMarkerComment`, `setLabels` — each taking an explicit `writeClass`
parameter (Invariant 2: never inferred). `scripts/lib/report-to-pr.ts` (#227, commit
`3cfb0bb0` on `feat/report-to-pr-contract-227`, not yet on `main`) gets partially subsumed:
its generic marker-comment CRUD + disk-fallback plumbing moves INTO
`ReviewChannel.upsertMarkerComment`; its report-specific field encoding
(`buildReportBody`/`parseReportBody`/`ReportFields`) stays as a thin crew-local wrapper that
calls `upsertMarkerComment({ writeClass: "report", ... })`.

### Interface (TypeScript)

```ts
// scripts/lib/review-channel.ts — target home; MOVES verbatim to
// plugins-common/packages/<pkg>/review-channel.ts at Phase 3 (no rewrite).

/** Mirrors taskStore.failMode.{lifecycle,report,gate} — same three classes,
 *  same semantics, applied to the git-host axis instead of the tracker axis. */
export type WriteClass = "lifecycle" | "report" | "gate";

export type ReviewVerdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface InlineComment {
  /** repo-relative path, matches the diff */
  path: string;
  /** 1-based line number in the file version identified by `side` */
  line: number;
  /** diff side; default "RIGHT" (new file version) */
  side?: "LEFT" | "RIGHT";
  /** optional range start for multi-line comments (GitHub suggestion-block style) */
  startLine?: number;
  body: string;
}

export interface SubmitReviewInput {
  prNumber: number;
  verdict: ReviewVerdict;
  /** top-level review body (the "why", not per-line findings) */
  summary: string;
  inlineComments?: InlineComment[];
  writeClass: WriteClass;
}

export interface SubmitReviewOutput {
  reviewId?: string;
  /** derived label side-effect: REQUEST_CHANGES -> adds "needs-fix"; APPROVE -> removes it.
   *  "hold"/"do-not-merge" are NEVER touched here — human-only escape hatch (#230). */
  labelsApplied: string[];
  labelsRemoved: string[];
}

export interface UpsertMarkerCommentTarget {
  /** exactly one of prNumber/issueNumber must be set */
  prNumber?: number;
  issueNumber?: number;
}

export interface UpsertMarkerCommentInput {
  target: UpsertMarkerCommentTarget;
  /** e.g. "<!-- crew:report -->" or "<!-- crew:review-summary -->" — caller embeds the
   *  marker inside `body`; this field is used to FIND an existing comment to PATCH. */
  marker: string;
  body: string;
  writeClass: WriteClass;
}

export interface UpsertMarkerCommentOutput {
  commentId?: string;
  /** true = existing marker comment was found and PATCHed; false = created fresh
   *  (or written to disk-fallback — check `result.mode`) */
  updated: boolean;
}

export interface SetLabelsInput {
  prNumber: number;
  add?: string[];
  remove?: string[];
  writeClass: WriteClass;
}

export interface SetLabelsOutput {
  applied: string[];
  removed: string[];
}

export type ReviewChannelMode = "applied" | "disk-fallback" | "skipped-soft-fail";

export interface ReviewChannelError {
  code: "auth" | "rate-limit" | "not-found" | "network" | "unknown";
  message: string;
  raw?: unknown;
}

export interface ReviewChannelResult<T> {
  ok: boolean;
  mode: ReviewChannelMode;
  data?: T;
  /** set when mode === "disk-fallback" */
  fallbackPath?: string;
  error?: ReviewChannelError;
}

export interface ReviewChannel {
  submitReview(input: SubmitReviewInput): Promise<ReviewChannelResult<SubmitReviewOutput>>;
  upsertMarkerComment(
    input: UpsertMarkerCommentInput
  ): Promise<ReviewChannelResult<UpsertMarkerCommentOutput>>;
  setLabels(input: SetLabelsInput): Promise<ReviewChannelResult<SetLabelsOutput>>;
}
```

### Fail semantics per write-class (shared wrapper, not per-method duplication)

All three methods route through one internal `applyWriteClassPolicy` wrapper so host impls
(GitHub/GitLab/Bitbucket) only implement the raw primitive (`doSubmitReview`,
`doUpsertComment`, `doSetLabels`) — this is what makes the Phase 3 extraction a MOVE:
the policy layer is host-agnostic and moves as one file, hosts move as separate files.

| writeClass  | On success                | On failure                                                                 |
|-------------|----------------------------|------------------------------------------------------------------------------|
| `lifecycle` | `{ok:true, mode:"applied"}` | swallow, `{ok:false, mode:"skipped-soft-fail", error}` — never throws, never blocks |
| `report`    | `{ok:true, mode:"applied"}` | disk fallback (`.claude/artifacts/crew/handoffs/`, provenance-tagged per v2 §9), `{ok:true, mode:"disk-fallback", fallbackPath}` — loud (stderr) but not a caller-visible failure; Blocker 3's liveness check is what catches sustained failure |
| `gate`      | `{ok:true, mode:"applied"}` | **throw** — no silent fallback. Gate-consumed state (`needs-fix` presence) must never be ambiguous per Invariant 4/6 |

`submitReview`'s label side-effect (`needs-fix`) is the gate-consumed signal — call sites
MUST pass `writeClass: "gate"` for `submitReview`. `upsertMarkerComment` for progress
reports (the #227 use case) MUST pass `writeClass: "report"`. `setLabels` is a lower-level
escape hatch (kept for GitLab/Bitbucket parity and non-review label ops); agent prompts must
never call it for `hold`/`do-not-merge` — that stays human-only per #230, enforced by prompt
discipline + the merge-gate Action, same as today. This is a policy gap the type system does
NOT close (see Open trade-offs).

### GitHub impl notes (thin `gh` wrapper)

- `submitReview`: **must** use `gh api repos/{owner}/{repo}/pulls/{pr}/reviews` (POST) with
  `event` + `comments[]` in one call — `gh pr review` (the porcelain command) does not support
  inline comments, so the primitive is the raw API call, matching the pattern already used by
  `report-to-pr.ts`'s `gh api .../issues/{n}/comments` (see below).
- `upsertMarkerComment`/`setLabels`: reuse the exact plumbing already built and tested in
  `git show 3cfb0bb0:scripts/lib/report-to-pr.ts` — `resolveRepoSlug` (repo view), the
  find-existing-comment-by-marker scan (`gh api .../comments --paginate`, filter by
  `containsReportMarker`-style substring match), PATCH-if-found/POST-if-not, and
  `writeDiskFallback` under `.claude/artifacts/crew/handoffs/`. This code already has an
  injectable `runGh` test seam (`GhRunner` type) — carry that seam into `ReviewChannel`'s
  GitHub impl unchanged.

### #227 subsumption — recommendation and reasoning

**Recommend: subsume the marker-CRUD plumbing, keep the report-domain shape separate.**

`postReportToPr` (from `3cfb0bb0`) already does 90% of what `upsertMarkerComment` needs:
idempotent find-by-marker, PATCH-or-POST, disk fallback with a reason string, injectable
`runGh`. Two independent implementations of "idempotent marker comment on a PR/issue" would
drift (bug fixes and gh-quirk workarounds landing in one but not the other) and the whole
point of doing this now is that Phase 3 extraction is a MOVE, not a rewrite — duplicated
logic defeats that.

What should NOT be subsumed: `ReportFields`/`buildReportBody`/`parseReportBody` (the
`STATUS:`/`AGENT:`/`FILES:`/`RISKS:`/`NEXT:` line-based body encoding) and the target
resolution preference chain (`explicit prNumber > auto-detect current-branch PR >
issueNumber > disk`). Those are report-domain concerns, not review-channel concerns — a
review-summary marker comment (Phase 1) has a completely different body shape and doesn't
need "auto-detect PR for branch" (the reviewer is always handed an explicit `prNumber`).
Keep `scripts/report-to-pr.ts` + `scripts/lib/report-to-pr.ts` as a thin crew-local
CLI/lib that builds the report body then calls
`reviewChannel.upsertMarkerComment({ target, marker: REPORT_MARKER_START, body,
writeClass: "report" })`. This also means #227's currently-uncommitted PR-target
auto-detection logic doesn't need to move to plugins-common at all — it's dev-team-specific
call-site behavior, exactly the kind of thing that should stay a thin wrapper per the v2
plan's own Phase 3 framing ("dynamic import + gh-wrapper fallback").

### Open trade-offs (user/dispatcher decides)

1. **Label-provenance is prompt discipline, not type-enforced.** `setLabels` could theoretically
   set `hold` — nothing in the interface stops it. Enforcement is (a) agent prompts told never
   to call `setLabels` for `hold`/`do-not-merge`, and (b) the `auto-merge.yml`
   (`.github/workflows/auto-merge.yml:36`) label check, which is host-side and doesn't care who
   wrote the label. If this is too weak, a follow-up could add a `RESERVED_LABELS` const the
   impl refuses to touch via `setLabels` — flagging as a candidate hardening, not blocking Phase 1.
2. **`ReviewVerdict` includes `COMMENT`** (GitHub's third native verdict, neutral/no-op) even
   though the plan only mentions APPROVE/REQUEST_CHANGES. Included for API completeness
   (matches GitHub's own `pulls/reviews` `event` enum) — reviewer.md's approval policy
   (`agents/reviewer.md:141-150`) never needs to emit it, but the type would be incomplete
   without it and GitLab MR approvals have an equivalent neutral-comment mode.
3. **GitLab/Bitbucket variants are unscoped.** This design defines the interface + GitHub impl
   only, per the task's own framing ("GitHub impl first... Variants are GitHub/GitLab/Bitbucket").
   No GitLab/Bitbucket work is scheduled; noting this so it isn't silently assumed done.

**Never Linear** — confirmed and restated here per the plan (§1): `ReviewChannel` has no and
will never have a Linear variant, because Linear does not host code or PRs.

---

## BLOCKER 2 — where dev-team's dispatch gate lives

**Status: RESOLVED — pick (a), hook-based, staged rollout, NOT (b) alone.**

### Decision

Build **(a) a `PreToolUse` hook on the `Agent` tool** (`hooks/pre-tool-use-dispatch-size.ts`,
wired in `hooks/hooks.json`'s existing `PreToolUse` → `Agent` matcher block alongside
`pre-tool-use-agent.ts` and `pre-tool-use-model-enforce.ts`, `hooks/hooks.json:108-120`).
Roll it out **warn-first with a bake period**, calibrated against telemetry dev-team already
records, then flip to hard block — exactly the `git-gate-block` pattern
(`scripts/lib/features-service.ts:64-71`). Do NOT rely on (b) prose discipline alone.

### Why not (b) alone — the #169 comparison, argued honestly

The task brief points at #169 as "eliminated via harness primitive, not prompt text." I read
the actual #169 resolution (`.claude/artifacts/crew/designs/2026-07-12-subagent-lifecycle-guards.md:160-229`,
review verdict `.claude/artifacts/crew/reviews/20260712T212257Z-review-result-pr224-review.md:29`)
before assuming that maps cleanly onto this blocker, and it does not — the shapes are
different in a way that matters:

- **#169's actual fix was docs-only too** (`build.md`/`fix.md`/`parallel.md`/`architect.md`
  mandating `isolation: "worktree"` on the `Agent` call). The reviewed PR's own risk note says
  plainly: *"EnterWorktree-first ordering in the peer-dispatch flow is prompt convention, not
  hook-enforced (accepted residual risk)."* A hard `PreToolUse` cwd-assertion hook was
  **explicitly designed and explicitly rejected** in the same design doc
  (`2026-07-12-subagent-lifecycle-guards.md:210-229`) — reason given: the hook has no
  independent source for "expected worktree" without an expensive per-tool-call transcript
  read, so it would be checking a value it structurally cannot verify.
- The reason #169's docs-only fix is *safe* despite being prose: it points the dispatcher at
  an **already-existing harness primitive** (`isolation: "worktree"`, a real `Agent`-tool
  parameter the harness mechanically enforces once passed) with **fast, cheap, high-signal
  failure feedback** — forget it, and you get a near-immediate git conflict, not a slow-burn
  loss.
- Blocker 2 has **neither** of those properties. There is no `Agent`-tool parameter for token
  budget to point prose at — a builder would have to compute an estimate and self-police it,
  which is exactly the "prompt-text instead of a harness primitive" anti-pattern the task
  brief is warning about, this time for real (no existing primitive to fall back on). And the
  failure feedback is the opposite of fast/cheap: a dispatch that's too large doesn't fail
  loudly near the start — it dies 60k-260k tokens in, with the report lost too (the whole
  reason this session exists). Slow, expensive, silent failure is precisely the case prose
  discipline handles worst.
- Also unlike #169's cwd case, the missing-information objection doesn't apply here: #169's
  hook was infeasible because the needed fact (dispatcher's *intended* cwd) genuinely isn't in
  the hook's payload without a transcript read. Blocker 2's needed fact — an estimate of
  dispatch size — **is already in the payload**: `tool_input.prompt` (the full dispatch brief)
  and `tool_input.subagent_type` are both present on every `PreToolUse`/`Agent` event (see
  `hooks/lib/model-routing-enforce.ts:64-77`'s `ParsedAgentDispatch.toolInput`, which carries
  the complete raw `tool_input` object, and `hooks/lib/dispatch-timing-pre-tap.ts:12-32`'s
  narrower `parseAgentPreInput`, which already extracts `subagent_type` + `description` from
  the same event). This is a *quality* gap (heuristic vs. runner's points-based input), not an
  *availability* gap — the exact distinction that made #169's hook infeasible and makes this
  one buildable.

### What signal is actually available (LOADED, not inferred)

Confirmed by reading two existing `PreToolUse`/`Agent` hooks' parsers:

- `tool_name === "Agent"` and the full raw `tool_input` object (`hooks/lib/model-routing-enforce.ts:64-77`).
- `tool_input.subagent_type: string`, `tool_input.description: string` (both hooks parse these).
- `tool_input.prompt: string` is part of the `Agent` tool's own schema (per this environment's
  tool definition) and therefore present in the same raw `tool_input` object, even though
  neither existing hook currently extracts it — no hook today reads `prompt` for content
  analysis; this would be new.
- No `points` / structured slice-size field exists anywhere in dev-team — runner's estimator
  input (story points → tokens) has no dev-team equivalent. This is the actual gap: the
  estimator here must derive a size signal from unstructured prose, which is strictly weaker
  than runner's.

### The estimator (DESIGNED, not loaded from anywhere — new logic)

```
estimatedTokens = BASE[agentTier]
                + fileMentionCount(prompt) * PER_FILE_TOKENS
                + (wideScopeMarker(prompt) ? WIDE_SCOPE_PENALTY : 0)

BASE:  investigator/dev-lite/reviewer-lite -> 15_000
       researcher/reviewer/architect        -> 30_000
       fullstack-dev/backend-dev/frontend-dev/aiplugin-dev -> 35_000
       default (unknown subagent_type)      -> 25_000
       (mirrors runner's ~20k base per v2 plan §14, tiered by agent cost profile
        instead of story points — points don't exist here)

fileMentionCount: regex count of file-path-like tokens (`[\w./-]+\.\w{1,5}\b`) and bare
  directory mentions (`\bcommands/\b`, `\bagents/\b`, etc.) in `tool_input.prompt`.
PER_FILE_TOKENS = 3_000 (rough per-file read cost, consistent with this repo's own
  "Read:Grep ratio" framing in agents/reviewer.md:186 — reads are the dominant cost driver).

wideScopeMarker: /\b(all|every|entire|whole|comprehensive)\b.{0,20}\b(files|repo|codebase|
  directories?)\b/i  — WIDE_SCOPE_PENALTY = 40_000. This pattern is deliberately tuned to the
  incident: the two early-death dispatches (~60k tokens, "oversized review task") were
  over-broad prompts of exactly this shape.

THRESHOLD = 150_000 (not 200_000 — deliberate headroom below the user's hard 200k cap,
  because this estimator is coarse and false negatives near the boundary are worse than a
  10-20% safety margin).
```

### Making it non-annoying: warn-first bake, calibrated against telemetry that already exists

A raw heuristic gate risks false blocks (worse than no gate, per the task brief). This repo
already has the answer to "how do we bake in a new enforcement level safely" —
`git-gate-block` (`scripts/lib/features-service.ts:64-71`): *"Default false = warn... flips to
block (decision:block) after a 1-week bake. Guardrail: this flag may only soften block→warn,
never silence the gate."* Reuse that shape exactly:

1. New feature flag `dispatch-size-gate` in `FEATURES` (`scripts/lib/features-service.ts`),
   `default: false` (warn phase).
2. Warn phase: hook computes `estimatedTokens`, and when over `THRESHOLD`, emits a
   `systemMessage` (same output shape as `hooks/lib/model-routing-enforce.ts:128-147`'s
   `buildHookOutput` — `hookSpecificOutput.permissionDecision: "allow"` + a `systemMessage`
   nudge) — never blocks. Also logs `{ subagentType, estimatedTokens, promptLength }` for
   later correlation.
3. **Calibration is not new infrastructure** — `scripts/lib/dispatch-timing.ts:17-27` already
   records `tokenIn`/`tokenOut` per dispatch via `recordDispatchStart`/`recordDispatchEnd`
   (wired at `PreToolUse`/`Agent` via `hooks/pre-tool-use-agent.ts` and presumably
   `otel-subagent-stop.ts` at the end tap). During the warn phase, join the hook's
   `estimatedTokens` log against the dispatch-timing end-tap's actual `tokenIn+tokenOut` for
   the same dispatch to see whether `THRESHOLD` is well-calibrated (too many false warns on
   dispatches that finished fine → raise threshold or fix the regex; too many misses on
   dispatches that died → lower it) before flipping to block.
4. After the bake period (mirror the 1-week precedent), flip `dispatch-size-gate` default to
   `true` and change the hook's over-threshold branch from `systemMessage` to the hard-block
   shape already proven in this codebase at `hooks/pre-push-verifier.ts:288-293` —
   `{decision: "block", reason: message}` on stdout. That is the one existing precedent for an
   actual `PreToolUse` block in dev-team (currently only wired to `Bash`, never to `Agent` —
   confirmed by reading `hooks/hooks.json:72-129` in full: every current `Agent` matcher hook
   is fail-open/inject-only, never block). Reusing the same JSON shape means this hook doesn't
   invent a third blocking convention.

### Why the alternatives lose

- **(b) discipline in `commands/*.md` alone**: rejected above on the #169 comparison — no
  existing primitive to point prose at, and the failure mode is slow/expensive/silent, the
  opposite of the case where #169 showed prose is safe.
- **(c) give dev-team a real slice pipeline**: likely correct long-term (this is genuinely
  "where this is heading" — see the plan's own Phase-1-through-5 shape moving dev-team toward
  runner's structure), but it is a multi-week, multi-FEAT undertaking (decompose command +
  slice materialization + a code path a gate can refuse to build) that would leave the 7
  agent-death class unmitigated for the entire time it takes to build. Naming it honestly per
  the task's ask: scope would be a new FEAT for a `pm-apply`/`sliceFromFeature`-equivalent
  command in dev-team, not something to fold into this slice.
- **(d) something better**: considered a "block only, no warn phase" fast-track — rejected
  because the task brief explicitly requires the gate be "non-annoying," and this repo has a
  proven bake-in pattern (`git-gate-block`) specifically because an un-calibrated hard gate on
  day one produces exactly the false-block cost the brief warns about.

### AC for the builder

1. `hooks/pre-tool-use-dispatch-size.ts` + `hooks/lib/dispatch-size-estimate.ts` (pure
   estimator function, unit-testable without stdin/JSON plumbing, mirroring the
   shim/lib split already used by `pre-tool-use-model-enforce.ts` / `model-routing-enforce.ts`).
2. New `FEATURES["dispatch-size-gate"]` entry, `default: false`, doc string states the warn→block
   bake-in explicitly (copy the `git-gate-block` guardrail language: may only soften, never silence).
3. `hooks/hooks.json`'s `PreToolUse` → `Agent` matcher block gets the new hook appended
   (`hooks/hooks.json:108-120`).
4. Warn-phase `systemMessage` output verified against the `buildHookOutput` shape precedent
   (`hooks/lib/model-routing-enforce.ts:128-147`).
5. Block-phase output verified against the `pre-push-verifier.ts:288-293` `{decision:"block"}`
   shape — do not invent a third JSON convention.
6. A test fixture reproducing the two known death-mode prompts (the ~60k-token over-broad
   review task, described in the plan's evidence appendix) must score over `THRESHOLD`.
7. Fail-open by construction: any parse/estimate error → pass through (allow), matching every
   other `Agent`-tool hook in this codebase (`pre-tool-use-agent.ts:23-26`,
   `pre-tool-use-model-enforce.ts:69-72`).

---

## BLOCKER 3 — where the liveness poll + telemetry collectors run

**Status: RESOLVED — split answer, as the task anticipated.**

### Liveness poll → `SubagentStop` (+ `TeammateIdle` as the death-mode complement), not a poll loop

**The plan's own language ("poll... within a timeout") doesn't map onto dev-team's model, and
it doesn't need to.** Runner's poll assumes a daemon that can wait. dev-team has no daemon —
but it doesn't need one, because `SubagentStop` already fires at exactly the moment the poll
would want to check: when the dispatched agent's turn ends. The "timeout" collapses to zero —
there's no waiting required, because the hook event itself IS the boundary the poll was
built to detect.

**Evidence this pattern is already proven in this codebase, not speculative:**
`hooks/lib/check-reviewer-decision.ts` (dev-team#199, wired at `SubagentStop` via
`hooks/hooks.json:44-61`) does the *identical* shape of check for a different artifact class:
fires when a reviewer-tier agent goes idle, checks whether a `decision:` line or review-result
artifact was delivered, and **hard-blocks** (`decision: "block"`,
`hooks/lib/check-reviewer-decision.ts:160`) when it wasn't. This is not a new mechanism to
invent — it's the same mechanism pointed at a different check: instead of "was a decision
delivered," check "does a report-marker comment on the PR exist, OR does a disk-fallback file
newer than this dispatch's start timestamp exist under
`.claude/artifacts/crew/handoffs/`."

**Design:** new `hooks/check-report-liveness.ts` (+ `hooks/lib/check-report-liveness.ts`),
wired at `SubagentStop` alongside the three existing hooks there
(`hooks/hooks.json:44-61`: `log_event.sh`, `otel-subagent-stop.ts`,
`check-reviewer-decision.ts`). On stop:
1. Resolve the dispatch's start time + PR/branch context — same correlation key
   `dispatch-timing.ts` already uses (`session_id` → `DispatchHandle`, persisted via
   `hooks/lib/dispatch-handle-store.ts` per `hooks/lib/dispatch-timing-pre-tap.ts:94-101`).
2. Check (a) does `gh pr view --json comments` show a `<!-- crew:report -->` marker posted
   after the dispatch start, OR (b) does `.claude/artifacts/crew/handoffs/` have a file newer
   than the dispatch start. Either present = OK, no alarm.
3. Neither present = **alarm**, distinct from "degraded flag set" per v2 §8. Emit via the same
   `mark-badge` CLI already used across this repo (`agents/reviewer.md:180`:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --badge blocked --note ...`) — a
   badge is the right primitive here specifically *because* the dispatcher session that
   launched the dying agent might itself be gone by the time this fires (the task's own
   framing: "a dying agent's dispatcher may also be gone"). A badge is durable/file-based, so
   it survives past the parent session's lifetime and is picked up by whichever session next
   runs `brief-me` or resumes the workflow — it does not depend on a live consumer being
   present at alarm time.

**Why also wire `TeammateIdle` (`hooks/hooks.json:62-71`), not just `SubagentStop`:** the
incident data is 7 deaths, and `SubagentStop` firing at all presupposes the subagent's turn
ended in a way the harness recognizes as "stopped." `TeammateIdle` is the separate event this
harness already distinguishes for a subagent that goes unresponsive without a clean stop —
today it's wired only to `log_event.sh` (telemetry, `hooks/hooks.json:62-71`), no logic
consumes it. The true "agent died mid-turn" case (context-ceiling truncation, the shape
described in the plan's evidence appendix) is plausibly a `TeammateIdle` event, not a
`SubagentStop` — recommending the same liveness check get wired to both, since betting on only
one event catching every death mode repeats exactly the mistake the incident already exposed
(a check that only fires on the happy path). Flagging this as inferred, not confirmed: I did
not find existing code that documents which death modes fire `TeammateIdle` vs
`SubagentStop` — a builder should verify empirically (dispatch a deliberately-truncated agent
and observe which event(s) fire) before assuming both need identical handlers.

**What fires the check, what consumes the alarm — concretely, per the task's own bar:**
fires = `SubagentStop`/`TeammateIdle` hook execution (harness-triggered, not session-triggered
— survives the parent dying too). Consumes = the `blocked` workflow badge, which is a file
under `.claude/state/` read by (a) the next `brief-me` invocation in *any* future session, and
(b) `write-final-synthesis`'s existing refusal-while-escalated check
(per `CLAUDE.md`'s v0.2.0 baseline addendum: "`write-final-synthesis` refuses to run while
escalated unless `--force`") — both are pre-existing consumers, not new plumbing.

### Review-depth telemetry → a CLI step at the existing slice-close ceremony, not a hook and not a GitHub Action

Telemetry (word count, findings-per-review, verify-vs-read ratio, trended pre/post Phase 1) is
a cross-artifact aggregation over time, not a per-tool-call check — the wrong shape for a hook
(hooks fire once per event; a trend needs to scan N artifacts and compare against history).
Two candidates considered:

- **A GitHub Action on PR review events** — attractive *because* Phase 1 moves review content
  onto PRs, so the data would be reachable without any local session running. Rejected: the
  v2 plan's own Invariant 4 (and Phase 2's explicit design choice, v2 plan lines 116-118: "Repo
  file = single source of truth; comment = index — no reconcile needed") establishes that the
  **review-result `.md` artifact under `.claude/artifacts/crew/reviews/` stays canonical
  through Phase 5**, even after Phase 1 ships PR comments. The PR comment is index/narrative,
  not the record of truth. Building a GH Action that reads PR comments as its data source
  would be reading the derived copy instead of the source — the same class of drift risk
  Invariant 3/9 (fallback provenance + reconcile-lite) was written to prevent for a different
  artifact class. Since the canonical source is local and file-based both pre- and
  post-Phase-1, a GH Action buys nothing here and adds a second data source to keep in sync.
- **A CLI command run at the existing slice-close ceremony** — chosen. dev-team's slice-close
  already runs a fixed CLI sequence (per `CLAUDE.md`'s autonomous-loop rules: `/loop:slice
  complete` "writes handoff + final-synthesis + cost-report + cost-advise" before
  grading) — this is a proven, already-scheduled point where the harness reliably runs a
  post-hoc CLI step over a slice's artifacts, independent of which session is driving. Add
  `review-depth-report` as a sibling step in that same sequence: scan the review-result
  artifacts written during the slice (word count of the body, `--findings` counter already
  present per `agents/reviewer.md:62`'s CLI contract, and a Read-vs-Bash-verification tool-call
  ratio derived from the same `record-read-content.ts`/`otel-post-tool-use.ts` PostToolUse
  telemetry `hooks/hooks.json:131-179` already records per tool call), append to a trend file
  (mirrors the existing cost-report/cost-advise pairing's own shape — one per-slice write, one
  cross-slice trend file).

**Consumer of the alert threshold:** `brief-me` — confirmed this is an established pattern,
not a new one: `commands/brief-me.md:30` already renders a `Recent Costs` table sourced from
`costs.recent`, independent of whether the loop plugin is installed. Add a `Review Depth`
section to the same command using the same rendering convention, surfaced at the start of
the *next* session (which is the honest answer to "the dispatcher may be gone" for telemetry
too — the alert has no live consumer at write time, only at next-read time, same as the
liveness badge above).

### Different answers for the two, on purpose

The task asked whether the poll and the telemetry belong in the same place — they don't, and
the reason is structural, not arbitrary: the poll needs a **per-dispatch trigger** that
survives the dispatcher dying (a hook, fired by the harness), while the telemetry needs a
**per-slice aggregation** over artifacts that already exist as durable files (a CLI step at an
existing ceremony boundary). Forcing both into one mechanism would either make the poll wait
for a ceremony that might be arbitrarily far in the future (too late to be a "liveness" signal)
or make the telemetry collector fire once per tool call for no benefit (no trend to compute
yet). Matching each to the harness primitive already shaped for it is the whole justification.

---

## Summary — decisions at a glance

| Blocker | Decision | New files (design-level, not built here) |
|---|---|---|
| 1. `ReviewChannel` | Interface + GitHub impl, subsumes #227's marker-CRUD plumbing, keeps report-domain shape separate | `scripts/lib/review-channel.ts`, GitHub impl module, thin `report-to-pr.ts` rewire |
| 2. Dispatch gate | `PreToolUse`/`Agent` hook, warn-first bake via new `dispatch-size-gate` flag, then hard block | `hooks/pre-tool-use-dispatch-size.ts`, `hooks/lib/dispatch-size-estimate.ts`, `FEATURES` entry |
| 3a. Liveness poll | `SubagentStop` (+ verify `TeammateIdle`) hook, badge-based alarm, no daemon needed | `hooks/check-report-liveness.ts`, `hooks/lib/check-report-liveness.ts` |
| 3b. Review-depth telemetry | CLI step at existing slice-close ceremony, `brief-me` consumes the trend | `review-depth-report` CLI step, `Review Depth` section in `brief-me.md` |

All three are read-only design decisions; no source was edited in this slice. Loaded facts are
cited with `file:line`; the estimator formula, the exact liveness-check file names, and the
`TeammateIdle` dual-wiring recommendation are marked inferred/designed above and need builder
verification, not blind implementation.

