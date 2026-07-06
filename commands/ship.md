---
description: Auto-fix loop entry point for QA, verification, PR filing, and deployment evidence. Dispatches qa-expert + verifier in parallel; retries with a specialist builder on FAIL up to ship.fix_retry_limit times; files PR or escalates with ship_blocked.
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
  --trustLevel repo-derived   # or partial / live-verified
```

Distinguish trust levels:
- `repo-derived` — repo files only.
- `partial` — some live identifiers confirmed.
- `live-verified` — concrete deploy identifiers confirmed from the platform.

Read `ship.fix_retry_limit` from `.claude/crew/deployment.md` (default **2** when absent). This caps
the auto-fix retries below.

## Step 3 — Auto-fix loop

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

1. Emit badges:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge qa_passed
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge verifier_passed
   ```
2. File PR:
   ```bash
   gh pr create --title "<title>" --body "<summary>"
   ```
3. Emit:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge pr_filed
   ```
4. Write deployment check:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-check --repo "$PWD" \
     --title "Ship: PR filed" --decision passed
   ```
5. Exit — surface the PR URL to the user.

### Either FAIL path

1. Read the FEAT tag from the current slice context.
2. Map tag to specialist builder using the same FEAT-tag → builder routing as `/crew:build`:
   - `.cs` diff → `crew:backend-dev`
   - `.ts` + `surface:ui` → `crew:frontend-dev`
   - `.ts` + `surface:backend` → `crew:backend-dev`
   - `.ts` + `surface:cross-layer` → `crew:fullstack-dev`
   - `.ts` + `surface:plugin` → `crew:aiplugin-dev`
   - no clear tag → `crew:fullstack-dev`
3. **Recall injection (FEAT-188 S3a):** before dispatching, fetch a recall block:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block --repo "$PWD" --agent <specialist-builder-agent-name> --tags "<FEAT tags csv>"`
   If `.block` is non-empty, prepend it verbatim (it is already the `## Prior context (from astramem)` block) to the retry dispatch instruction, ahead of the aggregated FAIL findings. If empty (memory not configured, or nothing recalled), omit — do not add any placeholder text.
4. Dispatch the specialist builder with the aggregated FAIL findings as fix scope. Builder produces
   a fix + handoff artifact.
5. Increment retry counter.

### Retry gate

```
retry_counter < ship.fix_retry_limit (default 2)?
  yes → return to Step 3, iteration N
  no  → goto Step 4 (blocked)
```

## Step 4 — Escalate on retry exhaustion

When retries are exhausted without both agents passing:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" \
  --badge ship_blocked \
  --note "<aggregated FAIL summary from qa-expert + verifier>"

node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-check --repo "$PWD" \
  --title "Ship: blocked after <N> retries" \
  --decision blocked
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

| Badge | When emitted |
|---|---|
| `qa_passed` | `crew:qa-expert` returned passed |
| `verifier_passed` | `crew:verifier` returned passed |
| `pr_filed` | `gh pr create` succeeded |
| `ship_blocked` | Retry limit exhausted, escalated to user |
| `dev_deploy_expected` | Dev environment transition started |
| `prod_deploy_expected` | Production promotion requested |
