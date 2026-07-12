# Tracker-provider transition plan — v2 (consolidated after dual review)

**Date:** 2026-07-12 (v2; v1 same day)
**Status:** APPROVED-WITH-CONDITIONS — architect: SOUND-WITH-CHANGES; architect-reviewer: APPROVE-WITH-CONDITIONS. All required changes folded in below.
**Goal:** move from local-file artifact writing to provider-backed development flow:
dev agents commit + open PRs; reviewers leave comments on PRs; architects attach
documents to features; status flows through tracker labels/states.

## v1 → v2 changelog

1. **Two config axes, not one.** `TaskStoreProvider` is tracker-scoped (GitHub Issues /
   Linear / Jira). PR review is git-host-scoped (GitHub / GitLab / Bitbucket). Linear has
   no PRs — it doesn't host code. Phase 1 builds a sibling **`ReviewChannel`** interface
   that will NEVER have a Linear variant. "Switch to Linear = one config line" is true
   only for the lifecycle surface, never for PR review. (architect)
2. **Phase 0 corrected:** runner FEAT-251 was already done 2026-07-10 (all three
   `loop.mts` sites route through `getProvider`; `github-provider.mts:196-201`). Phase 0
   is dev-team-local only. (architect)
3. **Phase 5 dependency was vapor.** FEAT-245/IssueBroker is a one-way idempotent issue
   FILER for the watcher, deliberately not built on TaskStoreProvider. No two-way-sync
   FEAT exists in any backlog. Phase 5 now requires scoping a NEW feature first; until
   then its exit condition is explicitly "unscoped." (architect)
4. **Phase 4.5 added (cheap, half-built):** `GithubProvider.syncPull`/`bootstrap` already
   implement read-only pull-from-tracker; wire as a scheduled advisory cross-check, no
   write-back. Note: Linear v1 has NO syncPull/bootstrap (COND-C descope) — Phase 4
   "identical lifecycle" claim corrected to publish/status/comment parity only. (architect)
5. **Label provenance split:** `needs-fix` = bot-written review verdict, machine-set only.
   `hold` = human-only escape hatch, bots never write it. The #230 gate treats `hold` as
   boolean with no provenance — sharing it between bot and human is unsafe. (architect)
6. **Narrative/machine-state invariant carve-out:** gate-input labels ARE machine state
   consumed by machine logic — the one sanctioned exception to "machine state stays on
   files until Phase 5," because #230 needs a binary signal predating any migration. (architect)
7. **Write-class fail-mode matrix added — per-class config, not a global knob.**
   `taskStore.failMode.{lifecycle,report,gate}` replaces v1-proposed `strict: true`. A
   global strict flag would turn a GitHub outage into a fleet-wide hard stop, violating
   Invariant 1 for lifecycle writes that have no business blocking builds. Write-class is
   an EXPLICIT parameter at every call site — never inferred from payload shape (the same
   `upsertMarkerComment` helper serves different classes with different fail semantics).
   Invariant 1 explicitly survives Phase 5 for the lifecycle class. (adversarial + orchestrator)
8. **Dispatcher-side liveness poll:** a degraded flag set by a dying agent has no reader.
   After any step that should have reported, the dispatcher polls "report marker on PR OR
   disk fallback present" within a timeout; timeout-with-neither is its own alarm,
   distinct from "degraded flag set." (adversarial)
9. **Fallback provenance + reconcile-lite:** fallback writes tag themselves canonical-for-
   this-instance; on reconnect, one best-effort catch-up post backfills a PR pointer; the
   gate flags any merged PR with neither review marker nor linked fallback. Distinguishes
   "review skipped" from "review fell back to disk" six weeks later. (adversarial)
10. **Draft-PR-first ordering:** report-early requires somewhere to report. Agents open a
    draft PR immediately after the first commit, THEN work, THEN report to it. Evidence:
    the #227 builder died before opening its PR — report-early alone wasn't enough. (incident)
11. **Phase 3 hardening (double):** (a) plugin-cache AC — the shared-provider import must
    be dynamic with a `gh`-wrapper fallback + a fresh-plugin-cache smoke test; static
    `import "@astragenie/task-store"` from `crew.ts` reintroduces #185/#194 (fixed in
    `5c306c09` the same morning; same class as runner `8b06cc7b`/#389). (b) Phase 3 is the
    plan's ONE-WAY DOOR — once ≥2 plugins consume the shared package, reverting means
    forking it back out. Requires explicit sign-off + a pin-to-older-version fallback
    statement before starting. (architect + adversarial)
12. **Review-depth telemetry as Phase-1 tripwire:** review word count, findings-per-review,
    verify-vs-read ratio, trended pre/post with an alert threshold — detects the
    PR-comments-invite-brevity regression early. Phases 1–2 are otherwise cleanly
    revertible (disk file remains the real artifact; revert = stop posting). (adversarial)
13. **Linear auth is its own dev-team slice:** `linear-config.mts` resolves auth through
    runner's `.claude/loop.json` `taskStore.linear` schema; dev-team has no loop.json.
    Phase 4 cannot assume inherited config machinery. (architect)
14. **Slice-sizing ports to dev-team — cap 200k tokens per slice** (user decision,
    2026-07-12; matches runner #393's shipped `TOKEN_SPLIT_THRESHOLD = 200_000`).
    Story points remain the input; the estimator derives tokens (~20k base +
    ~40k/point, so 2-3 pts ≈ 100-140k, comfortably under). Evidence: 7 agent deaths
    in one session, two distinct modes — end-of-task ceiling (5 deaths, 168k-264k
    tokens) AND early read-fanout exhaustion (2 deaths at ~60k on one oversized
    review task). Any dispatch estimated over 200k gets split BEFORE launch, same
    as runner. (incident + user)

## Validated current state (v2-corrected)

### runner (loop plugin)
- `TaskStoreProvider` (`provider-interface.mts:29-82`): `publishFeature`, `publishSlice`,
  `closeSlice`, `postSliceComment`, `updateStatus`, `syncPull`, `bootstrap`. Soft-fail
  mandated interface-wide.
- GithubProvider 254 lines (real; wraps the `gh`-CLI github-sync layer). LinearProvider
  199 lines (real GraphQL: issueCreate, state transitions, commentCreate; auth
  `LINEAR_API_KEY`/token-store; NO syncPull/bootstrap in v1). NoopProvider 51 lines =
  "no external tracker." There is no FileProvider; the local backlog tree is the source
  of truth and providers are one-way best-effort mirrors.
- `getProvider` callers: `loop.mts` only (3 sites) — FEAT-251 DONE 2026-07-10.
- Open FEAT-252 slices: #435 (auth/config), #437 (GraphQL writes), #439 (stubs+smoke).
- FEAT-245 = watcher's cross-repo issue filer. NOT a sync engine. NOT Phase 5's dependency.

### dev-team (crew plugin)
- Zero provider integration. Reviews/designs/handoffs/validations = local files.
- Agent prompts contain almost no `gh` (only release-engineer) — GitHub writes happen via
  orchestrator dispatch prose. runner's shape (provider calls in versioned CODE, prompts
  clean) is the target architecture.
- MERGED #230: auto-merge fails closed on `hooks/`, `agents/`, `commands/`, workflows;
  builder prompts carry the SendMessage backstop contract.
- In flight: #227 slice 1 (report-to-PR helper committed in builder worktree `3cfb0bb0`;
  agent-prompt edits uncommitted; NO PR — builder died at 239k tokens. Recovery pending.)

## The phases (v2)

### Phase 0 — finish in-flight (dev-team only now)
Recover + land #227 slice 1: report-to-PR helper (idempotent `<!-- crew:report -->`
upsert, disk fallback, injectable `gh` for tests) + the four builder prompts' contract
(remove "Returns inline follow-up; no handoff artifacts"; add draft-PR-first + report-
before-risky-tail + SendMessage backstop). Then the dispatcher-side liveness poll (v2 §8).

### Phase 1 — reviewers comment on PRs (dev-team)
- New `ReviewChannel` surface (git-host axis): `submitReview(verdict, inlineComments)`,
  `upsertMarkerComment(class, ...)`, `setLabels`. GitHub impl = thin `gh` wrapper for now.
- Verdict = APPROVE / REQUEST_CHANGES + `needs-fix` label (bot-only). `hold` stays
  human-only. Findings = inline comments on cited diff lines.
- Fail modes per write-class matrix; fallback provenance per v2 §9.
- Review-depth telemetry tripwire live from day one (v2 §12).

### Phase 2 — architects document in features (dev-team)
Full doc committed under `docs/design/*.md`; FEAT issue gets summary + pointer comment
(marker-delimited). Repo file = single source of truth; comment = index (no reconcile
needed — the adversarial pass confirmed this shape is the clean one). ADRs same pattern.

### Phase 3 — one provider, shared (plugins-common) — THE ONE-WAY DOOR
- Extract `TaskStoreProvider` + providers; add `ReviewChannel` beside it.
- ACs: dynamic import + `gh`-wrapper fallback when unresolvable; fresh-plugin-cache smoke
  test (cite `5c306c09`, `8b06cc7b`); one status-vocabulary enum shared by crew labels and
  runner stateMap; explicit one-way-door sign-off + pin-back statement BEFORE starting.
- Edited from plugins-common's own session/worktree (cross-repo rule).

### Phase 4 — Linear parity (runner) + dev-team auth slice
Finish #435/#437/#439. Parity = publish/status/comment only (no Linear syncPull).
Separate slice: dev-team Linear auth/config surface (cannot inherit runner's loop.json).

### Phase 4.5 — read-only mirror (cheap, half-built)
Scheduled `syncPull` into the backlog as advisory cross-check. No write-back. Uses
existing `github-provider.mts:164-188` capability.

### Phase 5 — SCOPED AND MOSTLY DELETED (FEAT-204, 2026-07-12)

Scoping outcome: **BUILD-REDUCED**. Phase 5 as originally written solved the wrong
problem. Findings (`.claude/artifacts/loop/backlog/pending/FEAT-two-way-tracker-sync.md`):

- **Local files stay the source of truth — permanently.** Invariant 1 (lifecycle
  soft-fail) plus the hard requirement that `brief-me`/`loop`/cost-advise run offline
  under NoopProvider make "tracker becomes authoritative for machine state" impossible.
  The premise Phase 5 was built on does not hold.
- **Grades and cost never move to a tracker.** Append-only telemetry, exactly one writer
  each, no tracker-side edit path. Two of the three original Phase-5 entities were never
  candidates for migration at all.
- **The one real conflict is backlog feature/slice STATUS**: a human closes/reopens an
  issue in the tracker UI while a local loop session is still working it. Last-write-wins
  is catastrophic here — it silently erases a human's stop signal.
- **Phase 4.5 already delivers most of the value.** The only genuinely new increment:
  escalate a detected tracker-side status regression from an advisory log line to a
  **blocking human-acknowledgment gate**, with forward-only auto-transitions as the sole
  permitted auto-resolution.

Net: a general bidirectional-sync engine would solve a non-problem (grades/cost) while
under-solving the real one (status conflicts need human escalation, not merge logic).
**Phase 5 collapses into a small addition to Phase 4.5.** FEAT-204 is
`autonomous_safe: false` — needs user sign-off before any slice derives from it.

## Invariants (v2)
1. Lifecycle provider writes are soft-fail — tracker outage never blocks a build. Survives
   Phase 5. Gate-input writes are HARD-fail-closed. Report writes are loud-fail + fallback
   + dispatcher poll. Per-class config: `taskStore.failMode.{lifecycle,report,gate}`.
2. Write-class is an explicit call-site parameter, never inferred.
3. Comments are idempotent (marker upsert). Fallback writes carry provenance.
4. Narrative → tracker; machine state → files until Phase 5. Sanctioned exception:
   gate-input labels (`needs-fix`), because the merged #230 gate consumes them.
5. Draft-PR-first, report-before-risky-tail, SendMessage as backstop.
6. Sensitive paths (`hooks/`, `agents/`, `commands/`, workflows) never auto-merge (#230).
7. `getProvider` unknown-provider → Noop is warn today; hard error under
   `failMode.gate/report = hard` config. A typo'd provider name must not silently
   disable tracking.

## Sequencing
Phase 0 → (1 ∥ 2) → 3 → (4 ∥ 4.5) → 5 (after scoping).
Slice-sizing port to dev-team (v2 §14) runs independently, ASAP — it protects every
phase's builders.

## Evidence appendix (2026-07-12 session)
- 7 agent deaths: 5 at end-of-task ceiling (168k–264k tokens), 2 at early read-fanout
  (~60k, same oversized task twice; 4-question rescope survived at 30k).
- 4 lost reports (work intact every time) → #227.
- 2 defective PRs auto-merged pre-review (#224 `isolation:` fiction, #225 dev-lite
  false-block) → #228/#229 fixes, #230 fail-closed gate.
- 3 verify-not-read reviews caught 3 real defects; reading-only would have passed all.
- Reviews: architect SOUND-WITH-CHANGES + adversarial APPROVE-WITH-CONDITIONS, both
  folded in above.
