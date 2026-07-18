---
description: Auto-fix loop entry point for QA, verification, PR filing, and deployment evidence. Dispatches qa-expert + verifier in parallel; retries with a specialist builder on FAIL up to ship.fix_retry_limit times; files PR or escalates with a `blocked` badge.
---

# Ship — Auto-Fix Loop

`/crew:ship` is the structured path from reviewed, local-commit-ready work to a filed PR with
QA and verification evidence. It does not replace manual deployment steps; those remain in the
deployer skill and require explicit user approval before any production promotion.

## Step 1 — Workspace verify + wake-up context

```bash
pwd
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"
```

Verify the returned `repoPath` matches `$PWD` before trusting the brief.

## Step 2 — Deployment guidance

Run discovery and surface what is already known:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" discover-deployment --repo "$PWD"
```

If guidance is absent, stale, or incomplete, inspect CI/CD + infra files and write durable guidance:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-guidance --repo "$PWD" \
  --title "<short title>" \
  --discovery-status repo-derived   # or partial / live-verified
```

Distinguish trust levels:
- `repo-derived` — repo files only.
- `partial` — some live identifiers confirmed.
- `live-verified` — concrete deploy identifiers confirmed from the platform.

Read `ship.fix_retry_limit` from `.claude/crew/deployment.md` (default **2** when absent). This caps
the auto-fix retries below.

## Step 3 — Auto-fix loop

**RunId resolution (agent-profile-load-feedback).** Resolve `<runId>` once, up front, from `.claude/state/crew/workflow-state.json` (`currentRun.slice`) — mirrors `build.md` step 12b. Reuse this SAME value for every `profile-block` / `profile-feedback` call below (Step 3a, Both PASS path, and Step 4), including the immediate-pass case where no retry iteration occurs.

### Iteration 0 (and each retry)

Dispatch both agents **in a single Agent-tool message** (parallel fan-out):

| Agent | Role |
|---|---|
| `crew:qa-expert` | Functional correctness, test coverage, edge-case scenarios |
| `crew:verifier` | Behavioral validation against acceptance criteria |

Both agents write their result artifacts before this step completes.

### Aggregate decisions

Collect both results:

- `crew:qa-expert` → `qa_decision` (passed / failed)
- `crew:verifier` → `verifier_decision` (passed / failed)

### Both PASS path

```
qa_decision = passed AND verifier_decision = passed
```

1. Emit badge (one validation gate covers both agents — mark only after BOTH pass):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_passed --note "qa-expert + verifier both passed"
   ```
   **Profile feedback (agent-profile-load-feedback):** if a retry dispatch fetched a profile block in Step 3, record the pass outcome, best-effort, using the SAME `<runId>` (no-op — empty `credited` — when no retry occurred, since no atoms were injected under that run):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-feedback --repo "$PWD" --run-id <runId> --outcome pass
   ```
2. File PR:
   ```bash
   gh pr create --title "<title>" --body "<summary>"
   ```
3. Write deployment check (this artifact is the PR-filed evidence — there is no `pr_filed` badge):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-check --repo "$PWD" \
     --title "Ship: PR filed" --decision passed --url "<PR URL>"
   ```
4. Exit — surface the PR URL to the user.

### Either FAIL path

1. **Repair-signature dedup check (dev-team#257/#259):** before retrying, run `repair-check` with the aggregated qa-expert + verifier FAIL findings as `--failure-output`, passing the previous iteration's `--prev-signature` (omit on the first iteration):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" repair-check --repo "$PWD" \
     --failure-output "<aggregated FAIL findings>" \
     --prev-signature "<signature from the previous iteration's repair-check call, if any>"
   ```
   Hold the returned `.signature` to pass as `--prev-signature` on the NEXT iteration. If `.shouldStop` is `true`, the same failure repeated and retrying isn't changing the outcome — skip the rest of this path and go straight to Step 4 (blocked) instead of dispatching another retry.
2. Read the FEAT tag from the current slice context.
3. Map tag to specialist builder using the same FEAT-tag → builder routing as `/crew:build`:
   - `.cs` diff → `crew:backend-dev`
   - `.ts` + `surface:ui` → `crew:frontend-dev`
   - `.ts` + `surface:backend` → `crew:backend-dev`
   - `.ts` + `surface:cross-layer` → `crew:fullstack-dev`
   - `.ts` + `surface:plugin` → `crew:aiplugin-dev`
   - no clear tag → `crew:fullstack-dev`
4. **Recall injection (FEAT-188 S3a):** before dispatching, fetch a recall block:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block --repo "$PWD" --agent <specialist-builder-agent-name> --tags "<FEAT tags csv>"`
   If `.block` is non-empty, prepend it verbatim (it is already the `## Prior context (from astramem)` block) to the retry dispatch instruction, ahead of the aggregated FAIL findings. If empty (memory not configured, or nothing recalled), omit — do not add any placeholder text.
4a. **Profile injection (agent-profile-load-feedback):** immediately after the recall block, fetch the specialist builder's track record (best-effort, empty when disabled). Resolve `<runId>` from `.claude/state/crew/workflow-state.json` (`currentRun.slice`) — reuse this SAME value for the profile-feedback calls in Step 3 (Both PASS path) and Step 4 below:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-block --repo "$PWD" --agent <specialist-builder-agent-name> --run-id <runId>`
   If `.block` is non-empty, append it (it is already the `## Your track record (<agent>)` block) to the retry dispatch instruction, after the recall block. If empty (profile disabled, or no track record yet), omit — do not add any placeholder text.
5. Dispatch the specialist builder with the aggregated FAIL findings as fix scope. Builder produces
   a fix + handoff artifact.
6. Increment retry counter.

### Retry gate

```
retry_counter < ship.fix_retry_limit (default 2) AND repair-check did not report shouldStop=true?
  yes → return to Step 3, iteration N
  no  → goto Step 4 (blocked)
```

## Step 4 — Escalate on retry exhaustion

When retries are exhausted without both agents passing:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" \
  --badge blocked \
  --note "ship: <aggregated FAIL summary from qa-expert + verifier>"

node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-check --repo "$PWD" \
  --title "Ship: blocked after <N> retries" \
  --decision blocked
```

**Profile feedback (agent-profile-load-feedback):** record the fail outcome for the last retry's profile block, best-effort, using the SAME `<runId>` from Step 3a:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" profile-feedback --repo "$PWD" --run-id <runId> --outcome fail
```

Halt and escalate to the user with:
- the aggregated FAIL summary
- the retry count reached
- both agents' result artifact paths
- suggested next step (manual fix or scope reduction)

Do not attempt further automated fixes.

## Production promotion

Production promotion (tag pushes, force-pushes, live environment changes) **always requires
explicit user approval** regardless of `dev.stable` or any badge state.

Badge and deployment-check evidence is a prerequisite for requesting approval, not a substitute
for it.

Use the deployer for any environment transition requiring live infrastructure access:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge prod_deploy_expected
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge dev_deploy_expected
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge dev_skipped --note "<reason>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge prod_skipped --note "<reason>"
```

## Badge reference

All badge names here must exist in `docs/standards/badge-catalog.md` (generated from `BADGE_TABLE`) — do not invent ship-specific badges.

| Badge | When emitted |
|---|---|
| `validation_passed` | `crew:qa-expert` AND `crew:verifier` both returned passed |
| `blocked` | Retry limit exhausted, escalated to user (`--note "ship: ..."`) |
| `dev_deploy_expected` | Dev environment transition started |
| `prod_deploy_expected` | Production promotion requested |

PR filing is evidenced by the `write-deployment-check` artifact (`--url <PR URL>`), not a badge.
