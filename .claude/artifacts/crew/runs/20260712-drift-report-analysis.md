# Drift report — runner-plugin tracker vs local backlog (2026-07-12)

First real run of `loop github drift` (shipped today, runner PR #485). Raw JSON:
`20260712-drift-report-runner.json`.

## Headline

```
134 linked · 203 tracker-only · 60 local-only · 125 status mismatches · 9 body diffs
```

Looks like chaos. **It isn't.** It is ONE systemic bug, repeated 125 times, plus a
publish gap.

## Finding 1 — the 125 status mismatches are all identical

**125 of 125** have the exact same shape:

```json
{"id":"FEAT-252","number":438,"localStatus":"done","trackerState":"OPEN"}
{"id":"FEAT-251","number":432,"localStatus":"done","trackerState":"OPEN"}
{"id":"FEAT-256","number":425,"localStatus":"done","trackerState":"OPEN"}
```

`localStatus: done` → `trackerState: OPEN`. **Zero** mismatches of any other shape.
No "tracker says done, local says open." No conflicting edits. No genuine two-writer
conflict anywhere in 125 cases.

**Root cause:** the slice/feature close ceremony marks work done locally and never
closes the GitHub issue. This is exactly the bug behind the five issues closed by hand
today (#392, #164, #435, #437, #439) — those were not anomalies, they were the visible
tip of 125.

**This is already a tracked issue:** runner **#427** — *"`runner:close` pr.merged emit is
instruction-driven — code-enforce the DORA merge signal."* Instruction-driven means it
depends on an agent remembering to do it. 125 misses says agents do not remember.

**Fix:** code-enforce issue-close in the close ceremony (#427), then bulk-close the 125
with evidence. One fix, 125 instances resolved, and the class stops recurring.

## Finding 2 — 203 tracker-only issues

- **170** are titled `FEAT-*` / `SLICE-*` → published to the tracker but the local file
  was archived/removed after completion (the `done/` tree only holds what it holds).
  Mostly benign historical residue, but worth a pass.
- **33** are ad-hoc issues filed directly on GitHub (bugs, chores — e.g. #481 the Bun
  flake, #479 review-split, #440 model-routing) with no local FEAT.

The 33 are the interesting ones: **they are real work items the loop cannot see.**
Today's watcher/auto-mode goal requires exactly this path to work — an issue filed in
GitHub must become dispatchable. Today it does not.

## Finding 3 — 60 local-only FEATs

Local FEATs never published to the tracker (`FEAT-092`, `FEAT-177`, `FEAT-201`, …). The
publish path exists (`publishFeature`) but was never run for these. Pure gap, no conflict.

## Finding 4 — 9 body diffs

Small. Not yet characterized. Low priority next to the above.

## What this means for the source-of-truth decision

**Decisive evidence for NOT flipping the tracker to source-of-truth right now.**

Had we made GitHub authoritative today, we would have adopted **125 wrong statuses as
truth** — every one of them saying "still open" about work that is finished and merged.
Auto mode would then have re-dispatched builders at 125 already-completed features,
unsupervised, on the token budget. That is precisely the phantom-work burn the SoT change
was *supposed* to prevent.

The tracker is not a trustworthy authority today. It can *become* one — but the way to earn
that is: fix the close ceremony, publish the gap, reconcile, and let the drift check run
clean for a while. **Drift-detection first, authority later.** That is what A2′
(publish + drift-refuse) does and full SoT does not.

## Recommended sequence

1. **Fix the close ceremony (runner #427)** — code-enforce issue-close. Stops the bleeding.
2. **Bulk-close the 125** with evidence, referencing their merged PRs.
3. **Publish the 60 local-only FEATs.**
4. **Triage the 33 ad-hoc issues** — these are the ones auto-mode/watcher must be able to
   pick up. Decide whether they become FEATs.
5. **Re-run the drift check.** Target: near-zero.
6. **Then** enable publish + drift-refuse as a standing gate, so it can never get this bad
   again.
7. Revisit source-of-truth only after the drift check has run clean for a sustained period.
