---
findings: "🔴:0,🟡:2,❓:0"
status: completed
decision: approved_with_notes
author_id: unknown-builder
judge_id: reviewer
self_approval: false
---
# Review Result: Review Result

- Created: 2026-07-12T23:36:57.854Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: PASS with one notable follow-up. Fail-open, default-off warn-only, kill-switch, and matcher scope all directly verified by running the shim; the 3 pre-existing telemetry test failures were independently reproduced in a fresh worktree with zero A3 changes, confirming the builder's claim.
- Evidence Checked:
  - RAN (not just inferred): built a fresh `git worktree` at pr-232-review (b79be2a7) and executed directly.
1) `bun test tests/dispatch-size-gate.test.ts` -> 29 pass
  - 0 fail.
2) Fail-open probes via `node --experimental-strip-types hooks/pre-tool-use-dispatch-size.ts`: malformed JSON
  - empty stdin
  - missing tool_input
  - missing subagent_type
  - non-Agent tool_name
  - and an unreadable/nonexistent `cwd` (readCrewConfig degrades to {}) — every case: exit 0
  - empty stdout (pass-through). hooks/hook-error.ts:5-19 also try/catches its own fs writes so logging failure can't surface either.
3) Default-off = warn-only
  - live: no crew.json -> isEnabled (scripts/lib/features-service.ts:167-186) returns FEATURES["dispatch-size-gate"].default=false -> over-cap 40-file/wide-scope prompt against crew:reviewer produced `{hookSpecificOutput:{permissionDecision:"allow"}
  - systemMessage:...}` (warn)
  - never `{decision:"block"}`.
4) Same over-cap payload with `.claude/crew.json` `{"features":{"dispatch-size-gate":{"enabled":true}}}` -> `{"decision":"block"
  - ...}` confirmed the flag *can* escalate warn->block.
5) `CREW_DISPATCH_SIZE_GATE=0` against that same block-mode config -> exit 0
  - empty stdout
  - confirming the kill switch overrides even an enabled flag.
6) `git show pr-232-review:hooks/hooks.json` lines 112-127: the new hook is appended as a 3rd command inside the existing `"matcher": "Agent"` block only — diff vs origin/main is a pure 4-line insertion
  - no other matcher touched.
7) `bun test tests/telemetry-plugin-cache-smoke.test.ts` in the SAME fresh worktree -> 3 fail
  - all `ENOENT ... scandir '<worktree>/node_modules'` inside buildPluginCacheTemp (tests/telemetry-plugin-cache-smoke.test.ts:55) — this file has zero diff vs origin/main (`git diff origin/main...pr-232-review -- tests/telemetry-plugin-cache-smoke.test.ts` empty). Claim confirmed
  - not cover.
8) `node ./scripts/validate-manifests.ts` -> OK
  - unaffected.

FOLLOW-UP FINDING (not runtime-blocking
  - calibration-credibility issue):
[HIGH] hooks/lib/dispatch-size-estimate.ts:118-134 (parseAgentDispatchSizeInput) and :218-241 (logDispatchSizeEstimate) — the calibration row logged to events.jsonl carries {ts
  - subagentType
  - estimatedTokens
  - promptLength
  - fileMentions
  - wideScope} with NO correlation key (no session_id
  - no tool_use_id
  - no runId/sliceId). dispatch-timing.jsonl (scripts/lib/dispatch-timing.ts:26-33)
  - the file the design doc says a future pass will join this against
  - is keyed by runId/sliceId/agent/startMs — also no session_id at the JSONL-row level. The sibling hook hooks/lib/dispatch-timing-pre-tap.ts:12-32
  - wired into the *same* PreToolUse/Agent payload
  - already extracts `session_id` from that identical raw JSON and uses it (via persistDispatchHandle) to correlate its own start/end telemetry — proving the field is present and cheap to capture here too
  - yet dispatch-size-estimate.ts's parser doesn't grab it.
Risk: without any shared field
  - a future calibration pass can only join by (subagentType-name + nearest-timestamp)
  - which is ambiguous whenever two same-tier dispatches fire close together in wall-clock time — exactly the pattern this repo's own guidance encourages ("send independent Agent calls in one message with multiple tool-use blocks" for parallel work; also `crew:parallel`/wave-mode dispatch). That means the stated calibration plan ("future pass joins warn-phase estimates against dispatch-timing.jsonl") is not reliably executable for concurrent same-tier dispatches — a real
  - not cosmetic
  - gap in the "not fitted
  - but at least joinable" story the PR body promises.
Not a runtime-safety defect: current default (warn-only
  - fail-open
  - kill-switched) is unaffected and independently verified above.
Fix: add `session_id` (and/or `tool_use_id`
  - already read elsewhere at scripts/lib/session-cost-scanner/compute.ts:132) to parseAgentDispatchSizeInput's return shape and to the logged row
  - so a future join has an exact key instead of timestamp-proximity guessing.

[LOW] hooks/lib/dispatch-size-estimate.ts:66-67 DIR_MENTION_RE is a fixed allowlist (commands|agents|skills|hooks|scripts|tests|docs) — plausible for this repo's own dispatches but will silently undercount file/dir mentions in prompts about `src/`
  - `lib/`
  - or any consumer-repo layout outside that list. Coarse-proxy tradeoff
  - explicitly caveated by the file's own header comment as "designed not calibrated" — acceptable for a warn-only bake
  - but worth remembering when calibrating.

Positive note: the "HONEST LIMITATION" header comment (hooks/lib/dispatch-size-estimate.ts:16-30) does not overclaim — it states plainly the constants are designed
  - not fitted
  - names the exact JSONL that isn't available in-checkout
  - and correctly frames calibration as future warn-phase work. No inflated-rigor language found (unlike the runner #393 precedent this brief warned about).
- Files Reviewed:
  - hooks/hooks.json
  - hooks/lib/dispatch-size-estimate.ts
  - hooks/pre-tool-use-dispatch-size.ts
  - scripts/lib/features-service.ts
  - tests/dispatch-size-gate.test.ts
- Test Adequacy: 29/29 new tests pass (run live via bun test); cover death-mode fixture, kill switch, flag-disabled-still-warns guardrail, malformed/missing-field payloads, and non-Agent pass-through. The 3 failing tests in tests/telemetry-plugin-cache-smoke.test.ts were independently reproduced in a fresh worktree with zero A3 changes to that file — confirmed pre-existing/environmental, not cover.
- Author: unknown-builder
- Judge: reviewer
- Risks: Calibration join-key gap (see HIGH finding): the logged calibration row has no session_id/tool_use_id/runId/sliceId, so a future pass joining against dispatch-timing.jsonl can only match by subagentType-name + nearest-timestamp, which is ambiguous under concurrent same-tier dispatches (a pattern this repo's own workflow encourages). Does not affect current warn-only safety, which was independently verified live. hold label and no-merge instruction respected — not merged, label untouched.
- Required Follow-up: Before relying on the calibration join, add session_id (or tool_use_id) to parseAgentDispatchSizeInput's return shape and to logDispatchSizeEstimate's logged row (hooks/lib/dispatch-size-estimate.ts:118-134, :218-241), matching the precedent already used by hooks/lib/dispatch-timing-pre-tap.ts on the identical payload. Not required before merging this warn-only, fail-open, kill-switched PR as-is.

