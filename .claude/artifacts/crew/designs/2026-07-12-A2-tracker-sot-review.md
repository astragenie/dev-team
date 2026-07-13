# Architect re-review — A2 tracker-SoT reversal (v3 plan)

**Scope:** A2 only (`.claude/artifacts/crew/designs/2026-07-12-tracker-provider-transition-plan.md:60-72`). Not relitigating *whether* the tracker matters — reviewing *how* the SoT reversal is specced.

**Loaded:** plan v3 (full), one representative FEAT frontmatter (`FEAT-188`, done, richest schema seen), one closed-out FEAT (`FEAT-003`, has `github_issue`/`github_milestone`/`github_url` already), `runner-plugin/src/scripts/lib/task-store/provider-interface.mts` (full), `runner-plugin/src/scripts/lib/task-store/providers/github-provider.mts` (full), `linear-provider.mts` (grep only), `runner-plugin/scripts/lib/github-sync/issue-sync.mjs` (grep + targeted read).
**Not loaded (budget):** `checkSyncDrift`/PR #485 body (not present in this checkout — trusting the plan's own description), Linear custom-fields implementation (grepped, found none), `syncPull`/`bootstrap` full bodies (interface contract + jsdoc read instead).

---

## Patterns Found

1. **The frontmatter schema is much larger than the plan's four named fields.** `FEAT-188` alone carries 27 frontmatter keys: `id, status, priority, category, target_release, created, depends_on, slices, derived_from, pm_customer_impact, pm_effort_estimate, pm_strategic_alignment, pm_technical_risk, pm_dependency_depth, composite_score, autonomous_safe, tags, triage_notes, started_at, updated, slices_landed_dev_team, slices_remaining, closed, closure, revision` plus (on older FEATs like `FEAT-003`) `github_issue, github_milestone, github_url`. The plan's "A2 design" section (line 63) only maps `status`, `priority`/`tags`, `depends_on`, and lumps everything else into "body block." That lump is 18 of 27 fields, not a footnote.
2. **`TaskStoreProvider` today has zero read/query methods.** The interface (`provider-interface.mts:29-82`) has exactly 7 methods: `publishFeature`, `publishSlice`, `closeSlice`, `postSliceComment`, `updateStatus`, `syncPull`, `bootstrap`. There is no `getFeature`, `listFeatures`, `getStatus`, or anything a "read-through cache" could call. A2 as specced requires new provider surface, not a policy flip.
3. **Labels today only cover 3 fields.** `github-sync/issue-sync.mjs:41-46` (`buildLabels`) maps `priority`, `category`, `autonomous_safe` — that's it. `tags` (already label-shaped, e.g. `"stack:typescript"`) isn't wired. Nothing maps `depends_on`, `slices`, or any `pm_*` field today.
4. **`createFeatureIssue` is idempotent at the call site, conditionally.** `issue-sync.mjs:81`: `if (feat.frontmatter?.github_issue) return feat.frontmatter.github_issue;`. Re-running publish is safe **only if** the local frontmatter was already patched with the returned `github_issue` after the first publish. Nothing in the plan specifies that write-back step for the 168-file migration, and a crash between "issue created" and "frontmatter patched" reintroduces the duplicate-issue risk the idempotency check exists to prevent.

---

## Q1 — Does the frontmatter fit in a tracker?

**No, not as a blanket mapping.** Field-by-field:

| Field(s) | GitHub concept | Linear concept | Fit |
|---|---|---|---|
| `status` | label (`status:pending` etc, issue open/closed alone is too coarse) | workflow state | clean |
| `priority` | label | priority field (native, 0-4) | clean |
| `category`, `tags` | labels | labels | clean |
| `autonomous_safe` | label | label | clean |
| `target_release` | milestone | project/cycle | clean |
| `created` | issue `created_at` (native) | native | clean |
| `depends_on` | no native dependency graph (task-list checkboxes / "Tracked in" is body text, not queryable) | native issue relations (blocks/blocked-by) | **GitHub: weak. Linear: clean.** Two backends, two different fidelities behind one interface. |
| `slices` | sub-issues (GitHub sub-issues API is young/limited) | `parentId` (confirmed wired at `linear-provider.mts:105`) | **GitHub: weak/beta. Linear: clean.** |
| `derived_from` | no native concept | no native concept | body/comment link only |
| `pm_customer_impact`, `pm_effort_estimate`, `pm_strategic_alignment`, `pm_technical_risk`, `pm_dependency_depth`, `composite_score` | **no native concept** | **no native concept — grepped `linear-provider.mts`, no custom-field wiring exists today** despite the plan claiming "Linear: custom fields" at line 63 | **no fit — the plan's own stated Linear mitigation is unbuilt** |
| `triage_notes` | free-text paragraph (in FEAT-188, several sentences with citations) | same | body/comment only |
| `started_at`, `slices_landed_dev_team`, `slices_remaining`, `closed`, `closure`, `revision` | no native "partial completion" or "started vs created" concept | same | **body-block, re-serialized on every slice event** |

**Verdict on Q1: the red flag is real.** 6 of 27 fields map cleanly to native primitives (labels + milestone + native timestamps). `depends_on`/`slices` are clean on Linear, weak on GitHub — meaning "the tracker" behaves differently as SoT depending on which backend a repo picked, which the plan doesn't acknowledge. The remaining ~18 fields — crucially the 5 `pm_*` scores, `composite_score`, `triage_notes`, and the incrementally-updated `slices_landed_dev_team`/`slices_remaining`/`closure` — have no tracker-native home and would be encoded into an issue body block that the CLI parses back out on every read. That is a database in a text field, exactly the shape the task brief warned about, and it is the majority of the schema, not an edge case.

**Required change:** narrow what "SoT" actually means. Recommend: only `status`, `priority`, `depends_on`/`slices` (blocking relationships), and `tags`/`autonomous_safe` become tracker-authoritative — the fields auto-mode dispatch actually needs to make a "is this safe/ready to pick up" decision. Everything else (`pm_*`, `composite_score`, `triage_notes`, `closure`, `revision`, `slices_landed_dev_team`) stays **local-canonical**, published as a lossy comment — literally the same pattern the plan already uses for grades/cost (invariant 2, line 119). Treating the whole 27-field schema as one SoT decision is the mistake; it's at least two different classes of field with two different lifecycles.

---

## Q2 — The offline trade-off

**Loaded fact:** the interface jsdoc (`provider-interface.mts:8-9`) already mandates soft-fail on every write method — "MUST resolve without throwing when the backend is unavailable." That discipline is real and good, and it covers *writes*. It does not cover the missing *read* surface (Patterns Found #2) that "read-through cache" depends on — that's new interface work, not a policy restatement, and the plan's Sequence table (line 134) doesn't show it as a build item under A2.

**Which loop operations actually break offline**, concretely:
- `/loop:slice start` — needs `updateStatus(in-progress)`. Blocks under refuse-to-mutate.
- `/loop:slice complete` — needs `closeSlice` + `postSliceComment`. Blocks.
- Dispatch, build, review, test — don't touch the tracker today and shouldn't need to under A2 either. Fine offline, as the plan states (line 68-69).
- PM triage/scoring (`pm_*`, `composite_score`) — per Q1's recommended scoping, these stay local-only, so triage is **unaffected** by offline refuse. This is itself an argument for the Q1 scope-down: it keeps more of the system usable offline.

**The gap the plan doesn't close:** `/loop:slice complete` is a multi-step ceremony — it writes grades, cost report, final-synthesis (all local-canonical, must never be blocked by tracker state) *and* calls `closeSlice`/`postSliceComment` (tracker-dependent). The plan says "refuse to mutate status" (line 68) but doesn't say **where in the ceremony sequence** that refusal fires or whether it aborts the whole ceremony or just the tracker leg. If a network blip mid-ceremony aborts the entire `/loop:slice complete` call, the loop loses local artifacts it doesn't need the network for — a regression versus today. **Required change:** local-canonical artifact writes must be ordered *before*, and independent of, the tracker-publish leg; tracker publish failure degrades to a durable "pending-publish" marker that a later drift-check/retry reconciles, not a whole-ceremony abort.

**Is refuse the right call vs queue-and-replay?** Agree with the plan: refuse is right for status *transitions* specifically — they're infrequent, loop-paced events, not a hot path, and queuing them is dual-write by another name (the plan says this itself, line 68-69, and is correct). The finding above is about *scope of the refusal*, not the refuse-vs-queue choice.

---

## Q3 — Read-through cache coherence

**The plan doesn't pick TTL vs always-hit-API — it's silent.** Given Patterns Found #2 (no read methods exist yet) and the brief's framing that `brief-me` and the loop read backlog state "constantly," this is not a minor gap:

- **Always-hit-API:** GitHub REST is 5000 req/hr authenticated; GraphQL is a points budget of similar order. A single loop session doing `brief-me` + next-task-selection + dependency checks across even a fraction of 168 items, every iteration, is a plausible way to burn through that budget inside one session — especially stacked with A1's scheduled drift-check hitting the same API.
- **TTL cache:** reintroduces staleness, just with a bound instead of "forever." The plan doesn't state a TTL value, an invalidation trigger, or who owns cache busting after an out-of-band change (e.g., a human re-prioritizing directly in GitHub's UI, or a watcher-filed issue landing between refreshes).

**Recommendation (not in the plan — required addition):** don't invent a third mechanism. Reuse A1's drift-check (already built, PR #485) as the scheduled full-refresh; have every *write-through* mutation (the loop's own `updateStatus`/`closeSlice` calls) eagerly invalidate just that item's cache entry, since the mutator already knows the write happened. Reads between mutations serve the cache; periodic drift-check is the safety net that catches everything the loop didn't cause itself (human edits, watcher-filed issues). This gets closer to a stated, defensible coherence policy than either of the plan's two unstated defaults.

---

## Q4 — The migration itself (168 files → issues)

**The plan conflates two different provider methods.** Line 70-72 says migration should reuse `bootstrap` and flags it as unsafe because it "WRITES LOCALLY." That correction (from the R-D builder / PR #485 work) is accurate about what `bootstrap` does — but `bootstrap` pulls **tracker → local** (`provider-interface.mts:76-81`: "Bootstrap local FEAT files from the remote tracker"). It is the *opposite direction* from what a 168-file local→tracker migration needs. The actual primitive for that migration is `publishFeature`/`publishSlice`, which the plan never names. This isn't a nitpick — dispatching a builder to "audit bootstrap before reuse" for a migration that shouldn't call `bootstrap` at all wastes a cycle on the wrong file.

**Idempotency exists, conditionally.** `issue-sync.mjs:81` short-circuits `createFeatureIssue` if `feat.frontmatter?.github_issue` is already set — confirmed by reading the source, this is real and would make a clean re-run safe. But it depends on the **first** run having patched that field back into all 168 local files before any retry. The plan doesn't specify that write-back step or its failure mode. Concretely: if the migration script creates issue #501 for FEAT-090, then crashes before writing `github_issue: 501` back to `FEAT-090.md`, a re-run recreates a duplicate issue for FEAT-090 — the exact "168 duplicate issues on re-run" failure mode the review brief asked about.

**Required change:** the migration needs its own durable log independent of the local frontmatter write (e.g., an append-only `migration-log.jsonl` of `{featId, externalId, createdAt}` written *before* attempting the frontmatter patch), checked on every item before calling `publishFeature`, so a crash mid-run is provably resumable without re-creating issues already confirmed created.

**Rollback if the migration goes wrong halfway.** Not addressed anywhere in the plan. GitHub Issues can't be cleanly deleted via the standard API/CLI path (deletion is a restricted, admin-gated GraphQL mutation) — practical rollback is: close (not delete) the issues created so far, `git revert` the local frontmatter patches, and treat the closed issues as an audit trail rather than expecting a clean undo. **Required change:** state this explicitly as the rollback plan before running the migration on real data — "close, don't delete, and don't expect symmetry" is a very different operator expectation than "rollback," and the plan currently has neither word.

---

## Q5 — What does SoT actually buy? (skeptical pass, as asked)

**The stated justification (line 55): "Auto mode dispatching against a lying tracker burns budget on phantom work, unsupervised."** Testing that against what's actually built:

- The five stale-issue incidents (#392, #164, #435, #437, #439) were **tracker-lagging-behind-reality** drift — caught by **A1** (`loop github drift`, already built, PR #485), with **zero SoT change**. A1 doesn't need A2 to exist.
- If local files stay authoritative (v2's model) and auto-mode dispatch reads *local* status (fast, offline, already reliable — this is the status quo working correctly today), the tracker never gets a chance to "lie to the dispatcher," because the dispatcher never asks it. The phantom-work risk the plan cites is specifically a risk of *querying the tracker for dispatch decisions* — which only exists if you build A2's read-through cache in the first place. It's close to a self-inflicted risk being used to justify the mechanism that creates it.
- **Phase D (watcher-filed issues) is the one genuine case for tracker-as-input** — a watcher files a bug directly in GitHub, external to the local backlog entirely. But the existing `bootstrap` method already exists to ingest that (tracker → local FEAT file creation). That's "GitHub is a valid *additional intake path*," a narrow and already-mostly-built claim — not "GitHub is authoritative for all 27 fields of all 168 items."
- **DORA's four metrics** (Phase B) don't require full SoT either: lead-time needs *an* issue-created timestamp, which either a bootstrap-created issue or the existing `created` frontmatter field already provides; deployment frequency and MTTR are PR/merge-event-derived, not backlog-derived; change-failure-rate is label-derived off PRs, not FEAT frontmatter.

**Plain answer to the brief's question:** drift-detection (A1, built) + the existing one-way publish (`publishFeature`/`publishSlice`/`updateStatus`, already built) + `bootstrap` as a scoped watcher-intake path gets you auto-mode dispatch safety and DORA's data needs without the read-through cache, the offline-refuse mode, the new interface methods, or the body-block-encoding problem in Q1. Full tracker-SoT is not incidental to those two goals — it's a materially larger, riskier build than either goal requires.

This doesn't mean "never do A2." It means: **A2 as specced (blanket SoT over the full 27-field schema) is broader than the stated justification supports.** The narrower version — SoT over `status`/`priority`/`depends_on`/`slices`/`tags` only (Q1's recommendation), fed by the write-through methods that already exist, reconciled by A1's drift-check, with `bootstrap` as the watcher-intake path — delivers the same auto-mode-safety and DORA outcomes at a fraction of the new-surface risk.

---

## Verdict: **RETHINK** (A2 specifically)

Not a rejection of "tracker matters more" as a direction — a rejection of "the full local frontmatter schema becomes tracker-authoritative" as currently scoped. Four of five sub-questions surfaced concrete, evidence-backed problems that stack:

1. **Q1:** 18 of 27 frontmatter fields have no tracker-native home; the plan's own mitigation for the worst offenders (`pm_*` via Linear custom fields) is unbuilt.
2. **Q2:** the interface has zero read methods today — "read-through cache" is new provider surface the Sequence table doesn't account for as a build item, and the plan doesn't specify how tracker-mutation failure interacts with the rest of the slice-close ceremony (which must stay local-write-safe).
3. **Q3:** cache coherence (TTL vs always-hit-API) is unstated, and the loop's read frequency ("constantly," per the brief) makes this a real rate-limit and staleness risk, not a footnote.
4. **Q4:** the plan names the wrong provider method (`bootstrap`, tracker→local) for a local→tracker migration; idempotency exists but depends on an unspecified durable write-back log; rollback is unaddressed.
5. **Q5:** the stated justification (auto-mode safety + DORA) is achievable via A1 (built) + existing publish methods + `bootstrap` as scoped intake, without full SoT.

### Required changes before A2 builds
1. **Rescope SoT to the dispatch-relevant subset**: `status`, `priority`, `depends_on`/`slices`, `tags`/`autonomous_safe`. Everything else (`pm_*`, `composite_score`, `triage_notes`, `closure`, `revision`, `slices_landed_dev_team`/`slices_remaining`) stays local-canonical, published as a lossy comment — matching the plan's own grades/cost pattern (invariant 2).
2. **Add the missing read methods to `TaskStoreProvider`** (`getFeature`/`listOpen`/equivalent) as an explicit A2 build item — it's not implied by flipping a SoT flag.
3. **Specify ceremony ordering**: local-canonical artifact writes (grades/cost/synthesis) happen before, and independent of, the tracker-publish leg of `/loop:slice complete`; tracker failure degrades to a durable pending-publish marker, not a whole-ceremony abort.
4. **State a cache-coherence policy**: reuse A1's drift-check as scheduled refresh; write-through mutations self-invalidate their own cache entry; no separate TTL invented.
5. **Fix the migration primitive**: use `publishFeature`/`publishSlice`, not `bootstrap`. Add a durable append-only migration log independent of frontmatter write-back, checked before every create call. State the rollback story explicitly: close-not-delete + `git revert`, no expectation of symmetric undo.
6. **Before greenlighting the rescoped A2, weigh Q5's alternative**: A1 (built) + existing one-way publish + `bootstrap`-as-intake may deliver the stated auto-mode/DORA goals without A2's new surface at all. This is the user's call, not mine to make — but it should be an explicit decision point, not skipped past because A2 was already named as the plan of record in v3.

### Loaded vs inferred
- **Loaded (read directly):** frontmatter schema shape (2 FEAT files), `TaskStoreProvider` interface (full), `GithubProvider` (full), label-building logic and idempotency check in `issue-sync.mjs` (targeted reads), `linear-provider.mts` parentId wiring (grep).
- **Inferred/not verified this session:** Linear custom-fields absence is based on a grep finding no matches, not a full read of the Linear provider file — plausible but not exhaustively confirmed. GitHub API rate-limit numbers (5000/hr) are general platform knowledge, not measured against this repo's actual call volume. `checkSyncDrift`/PR #485 internals were not read — trusted the plan's own description of what it does (drift detection, byte+mtime identity assertions).
