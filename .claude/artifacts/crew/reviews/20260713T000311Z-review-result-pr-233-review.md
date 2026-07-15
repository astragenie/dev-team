---
findings: "🔴:0,🟡:1,❓:2"
status: completed
decision: approved_with_notes
author_id: orchestrator
judge_id: reviewer
self_approval: false
---
# Review Result: Review Result

- Created: 2026-07-13T00:12:07.863Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: Reviewed dev-team PR #233 (.github/workflows/auto-merge.yml, +24/-3). Verified via live GitHub GraphQL schema introspection, live query execution against real PR node IDs, a js-yaml-extracted mocked-github/core/context harness covering all 8 code paths, full-file diff-vs-#230 comparison, and live CI run logs for PR #233 itself plus the #232-era failure run. State probe is schema-correct and fails closed on the throw/unknown paths, and all of #230 protections are intact. Found one real MEDIUM gap: stillArmed=!!q?.node?.autoMergeRequest conflates a genuinely-confirmed-not-armed response with a node:null (lookup-miss) response, silently treating the latter as safe instead of unknown/fail-closed -- exactly the failure class this PR exists to close, one level more subtle. Practical trigger probability is near-zero (node_id is fresh from the same webhook payload) and the fix is a one-line isolated change. Also flagged two non-blocking LOW suggestions: a probe-before-attempt structure would be simpler and would sidestep the disable mutation's empirically inconsistent throw behavior (threw on the #232-era run, succeeded silently on PR #233's own live run for the same never-armed condition); and a stale prose comment near disable() that pre-dates this PR.
- Evidence Checked:
  - gh api graphql introspection confirmed PullRequest.autoMergeRequest (nullable OBJECT AutoMergeRequest) and AutoMergeRequest.enabledAt are real schema fields; ran the exact probe query from the file live against PR #232 and #233 node_ids
  - got {"data":{"node":{"autoMergeRequest":null}}} both times as expected. Extracted the embedded github-script JS via js-yaml.load() (same technique as #230's reviewer) and ran it in a mocked github/core/context harness covering: draft-clean-disable
  - draft-throw-not-armed-noop
  - draft-throw-armed-setFailed
  - draft-throw-probe-throws-setFailed
  - held-label-early-return (isolated
  - confirmed no listFiles/createComment call)
  - sensitive-path-match-noop-plus-comment
  - path-check-API-failure-setFailed-regardless
  - clean-PR-arms. All 8 matched expected behavior. Live CI: PR #233's own run (29214235709) succeeded
  - correctly disarmed for touching auto-merge.yml itself
  - but the disable mutation did not throw in that run so the new catch/probe branch was not exercised in production -- only in the mocked harness. The #232-era run (29211385383
  - old regex code) reproduced the original bug live: "Can't disable auto-merge for this pull request." not matched by the old regex.
- Files Reviewed:
  - .github/workflows/auto-merge.yml
- Test Adequacy: -
- Test Adequacy Skip Reason: Workflow YAML has no unit-test harness; substituted GraphQL schema introspection + live query execution against real PR node IDs + a js-yaml-extracted mocked github/core/context harness covering all 8 code paths, per repo convention established by the #230 reviewer.
- Author: orchestrator
- Judge: reviewer
- Risks: MEDIUM: stillArmed classification treats a node:null (lookup-miss) GraphQL response the same as a confirmed not-armed response, silently taking the safe/no-op path instead of the unknown/fail-closed path; near-zero real trigger probability since node_id is fresh from the triggering webhook payload, but it is an unguarded instance of the exact failure class this PR exists to close. Two LOW items: probe-before-attempt would be simpler and avoid the disable mutation's observed-inconsistent throw behavior; a stale prose comment above disable() (pre-existing, not introduced by this PR) undersells the new state-probe logic.
- Required Follow-up: Recommend (non-blocking): change .github/workflows/auto-merge.yml:96 to 'stillArmed = q?.node ? !!q.node.autoMergeRequest : null;' so a lookup-miss is treated as unknown/fail-closed rather than confirmed-not-armed. Optional fast-follow: consider probe-before-attempt structure; touch up the stale comment near disable().

