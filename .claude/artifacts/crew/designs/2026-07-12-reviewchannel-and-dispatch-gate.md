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
