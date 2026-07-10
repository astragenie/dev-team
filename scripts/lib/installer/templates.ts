export const GLOBAL_MEMORY_VERSION = "1.1";
export const GLOBAL_METADATA_TEMPLATE = {
  managedBy: "crew",
  version: GLOBAL_MEMORY_VERSION,
  files: ["constitution.md", "workflow.md"]
};

// Marker block injected into repo CLAUDE.md. The repo-local constitution is
// imported via @-syntax so it shows up in agent context automatically. The
// workflow.md is deliberately NOT imported — agents read workflow via the
// commands and brief-me memory bucket, not by stuffing it into CLAUDE.md.
export const CLAUDE_IMPORT_BLOCK = [
  "<!-- crew:start -->",
  "<!-- Crew framework memory. Run /crew:install after plugin updates that change framework memory. -->",
  "@.claude/crew/constitution.md",
  "<!-- crew:end -->"
].join("\n");
// Legacy marker retained for upgrade detection (see updateClaudeMd).
export const LEGACY_CLAUDE_MARKER_START = "<!-- engineering-os:start -->";
export const LEGACY_CLAUDE_MARKER_END = "<!-- engineering-os:end -->";

// Marker-bracketed block injected into the repo's .gitignore. Lines outside
// the block belong to the user and are preserved across re-runs; lines inside
// are owned by this plugin and refresh on each install.
export const GITIGNORE_MARKER_START = "# crew:start";
export const GITIGNORE_MARKER_END = "# crew:end";
export const GITIGNORE_BLOCK = [
  GITIGNORE_MARKER_START,
  "# Crew framework local state. Generated; do not edit between markers.",
  ".claude/logs/",
  ".claude/state/crew/history.jsonl",
  ".claude/state/crew/approvals.jsonl",
  ".claude.backup.*",
  GITIGNORE_MARKER_END
].join("\n");

export const CONSTITUTION_TEMPLATE = `# Engineering OS Constitution

This repository uses the Engineering OS harness for structured software work inside Claude Code.

## Core Rules

1. Keep one owner per task. Shared ownership creates merge conflicts and confused accountability that cost the user time.
2. Keep task scope explicit. Ambiguous scope leads to wasted effort and work that has to be redone.
3. Retrieve bounded repo context before substantial work. Starting without it means paying for rediscovery that was already done.
4. Structured handoffs protect the user from lost context. Without them, the next agent or session starts blind.
5. Treat review as a gate, not a courtesy. Unreviewed code reaching the user's repo is a quality risk they cannot easily undo.
6. Treat validation and deployment evidence as separate gates when behavior or environments are involved. The user needs to know that changed behavior works, not just that code looks correct.
7. Leave durable artifacts and repo memory behind when work would matter later. Skipping them means the next session has no record of what happened or why.

## Team Roles

- dispatcher (concept, not agent): planning, delegation, synthesis via /crew:build · /crew:fix · /crew:ship
- builder: bounded implementation
- reviewer: independent change review
- validator: behavior and scenario verification
- deployer: deployment and environment evidence
- researcher: read-only investigation

## Memory And Artifact Habit

The user depends on artifacts to resume work after compaction, across sessions, or when context is lost.

Substantial work should start from bounded repo memory:

- \`CLAUDE.md\`
- \`.claude/crew/*.md\`
- latest relevant wake-up context and artifacts

Substantial work should leave inspectable artifacts under:

- \`.claude/artifacts/crew/runs/\`
- \`.claude/artifacts/crew/handoffs/\`
- \`.claude/artifacts/crew/reviews/\`
- \`.claude/artifacts/crew/validations/\`
- \`.claude/artifacts/crew/deployments/\`

For shipping work, keep durable repo deployment guidance in:

- \`.claude/crew/deployment.md\`

## Scope Discipline

These situations create merge conflicts, wasted effort, or confused ownership that costs the user time. Stop and re-scope if:

- two agents need the same file
- the assignment boundary is unclear
- the work needs a broader refactor than assigned

## Commit Discipline

Baseline: do not create commits unless the user explicitly asks. Unrequested commits in the user's repo are a quality and trust risk they cannot easily undo.

Exception — \`dev.stable\` opt-in:

- If the current repo's \`.claude/crew/deployment.md\` contains a \`dev.stable: true\` setting, the dispatcher and builder MAY create commits without asking on each individual edit, as long as ALL of the following hold:
  - the change came from a \`/crew:build\` or \`/crew:fix\` flow that reached the synthesis step
  - the latest review artifact for the run is \`PASS\` (or \`review_skipped\` was recorded with an explicit reason)
  - the latest validation artifact for the run is \`PASS\` (or \`validation_skipped\` was recorded with an explicit reason)
  - no \`help_request\` workflow badge is open
  - the work is local commits only — not a release tag, not a force-push, not a production deploy
- If any gate is missing or red, fall back to baseline (ask first).
- The user may override the flag at any time by saying "do not commit" or equivalent during the session. Session-level instruction always beats the repo flag.
- Production promotion, tag pushes, and force-pushes are NEVER unlocked by \`dev.stable\` — they still require explicit user approval per the release-engineer rules.

See \`agents/release-engineer.md\` → Deployment guidance schema for the field definition.
`;

export const WORKFLOW_TEMPLATE = `# Engineering OS Workflow

## Preferred Sequence

1. verify the repo and current workspace
2. retrieve bounded wake-up context before substantial work
3. choose mode: single-session, assisted single-session, or team run
4. define task ownership and scope
5. implement or investigate in bounded chunks
6. review code-bearing work before calling it done
7. validate behavior when it can be exercised meaningfully
8. gather deployment evidence when shipping through environments
9. leave a final synthesis

## Default Gate Policy

Each gate protects the user from a different class of risk. Skipping a gate silently means the user assumes it passed when it did not.

- code changed -> independent review required (protects from regressions and quality erosion)
- runnable, observable, or user-visible behavior changed -> validation expected (protects from shipping broken behavior)
- deployment or promotion work -> deployment evidence expected (protects from unverified environment state)
- production promotion -> explicit user approval required (protects the user's production systems)

## Write-Back Discipline

The user depends on these artifacts to resume work after compaction, across sessions, or when context is lost. Skipping a write-back means the next session starts with no record of what happened.

- substantial run start -> run brief
- ownership change -> handoff
- review completion -> review result immediately
- validation completion -> validation result immediately
- meaningful deployment evidence -> deployment check immediately
- substantial completion -> final synthesis

## Handoff Format

Every substantial handoff should include:

- objective
- owner
- allowed scope
- forbidden scope
- deliverable
- changed files or evidence
- confidence level
- risks or open questions
- suggested next handoff

## Ownership And Tests

Builder owns code-bearing tasks, including tests for changed behavior when practical. Reviewer
owns independent change review. Validator owns behavior validation when behavior can be exercised
meaningfully. Deployer owns environment evidence when shipping through dev or prod.
`;

export const PROTOCOL_TEMPLATE = `# Crew Agent Protocol

This document captures the shape of the structured communication artifacts agents leave behind
so the next agent or session can resume without rediscovery.

## Run Brief

Created at the start of a substantial run. Captures:

- title, goal, mode
- in-scope and out-of-scope summary
- first bounded work chunk
- whether tests were added or updated as part of this run
- next responsible step

## Handoff

Created whenever ownership changes or a teammate hands work back. Captures:

- objective and owner
- allowed scope and forbidden scope
- deliverable and changed files or evidence
- confidence level and open risks
- suggested next handoff

## Review Result

Created immediately when independent review materially completes. Captures:

- artifact or change reviewed
- standards applied (repo standards, language standards, configured review skills)
- decision: passed, failed, or skipped with a reason
- findings, risks, and required follow-ups
- whether tests were added or updated alongside the change

## Validation Plan And Validation Result

A validation plan describes the scenario, the environment, and the evidence to collect.
A validation result records what actually happened:

- scenario exercised
- evidence gathered (logs, screenshots, telemetry)
- decision: passed, failed, or skipped with a reason
- residual risk and the next responsible step

## Deployment Result

Created when an environment transition produces meaningful evidence. Captures:

- target environment (dev or prod)
- resource or service identity (URL, image, revision)
- decision: passed, failed, or skipped with a reason
- log or telemetry pointer for the change
- post-deploy validation status and the next responsible step

## Final Synthesis

Created at the end of a substantial run. Captures:

- what changed and why
- what was reviewed, validated, and deployed
- residual risk and the next recommended step
- whether tests were added or updated as part of this run
`;

export const ARTIFACT_README_TEMPLATE = `# Crew Artifacts

This directory stores inspectable run artifacts for the Crew harness.

- \`runs/\` for run briefs and final syntheses
- \`handoffs/\` for task ownership and completion notes
- \`reviews/\` for review results and rejection notes
- \`validations/\` for validation plans and validation results
- \`deployments/\` for deployment checks and environment evidence
`;

export const STATE_README_TEMPLATE = `# Crew State

This directory stores lightweight repo-local coordination state.

- \`claims.json\` tracks current file ownership claims
- \`history.jsonl\` stores append-only claim and release events
- \`approvals.jsonl\` stores approval requests and resolutions
- \`workflow-state.json\` stores the current run and gate badge state
- \`sprint.json\` is an optional sprint or focus configuration
`;

export const CLAIMS_TEMPLATE: {
  version: string;
  updatedAt: string;
  claims: Record<string, never>;
  warnings: string[];
} = {
  version: "1.0",
  updatedAt: "2026-01-01T00:00:00.000Z",
  claims: {},
  warnings: []
};

export const SPRINT_TEMPLATE = {
  focus: "P1",
  notes: [
    "Replace or remove this file if you do not use sprint-style priorities.",
    "Crew keeps this repo-local so coordination remains inspectable."
  ]
};

export const HOOK_SCRIPT_TEMPLATE = `#!/usr/bin/env bash
set -euo pipefail

event_name="\${1:-unknown}"
project_dir="\${CLAUDE_PROJECT_DIR:-$PWD}"
log_dir="\${project_dir}/.claude/logs"
payload_dir="\${log_dir}/payloads"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
payload_path="\${payload_dir}/\${stamp}-$$-\${event_name}.json"
events_path="\${log_dir}/events.jsonl"

mkdir -p "$payload_dir"

if [ -t 0 ]; then
  printf '{}\\n' > "$payload_path"
else
  cat > "$payload_path"
fi

printf '{"schemaVersion":"1.0","source":"crew","timestamp":"%s","event":"%s","repoPath":"%s","payloadPath":"%s"}\\n' \\
  "$timestamp" \\
  "$event_name" \\
  "$project_dir" \\
  "$payload_path" >> "$events_path"
`;

export const GIT_GATE_REMINDER_TEMPLATE = `#!/usr/bin/env bash
set -euo pipefail

payload="$(cat || true)"
if [ -z "$payload" ]; then
  exit 0
fi

HOOK_PAYLOAD="$payload" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

function hasCommitLikeCommand(command) {
  return /(^|[;&|()]|\\s)git\\s+commit(\\s|$)/.test(command);
}

function hasPrLikeCommand(command) {
  return /(^|[;&|()]|\\s)gh\\s+pr\\s+(create|merge)(\\s|$)/.test(command);
}

function pendingBadges(run) {
  const pending = [];
  if (run?.gates?.review?.status === "required") pending.push("review_required");
  if (run?.gates?.validation?.status === "expected") pending.push("validation_expected");
  if (run?.gates?.deployment?.dev?.status === "expected") pending.push("dev_deploy_expected");
  if (run?.gates?.deployment?.prod?.status === "expected") pending.push("prod_deploy_expected");
  return pending;
}

function missingArtifactWrites(run) {
  const missing = [];
  const hasPendingGates = Boolean(
    run?.gates?.review?.status === "required" ||
    run?.gates?.validation?.status === "expected" ||
    run?.gates?.deployment?.dev?.status === "expected" ||
    run?.gates?.deployment?.prod?.status === "expected"
  );
  const hasAnyGate = Boolean(
    run?.gates?.review ||
    run?.gates?.validation ||
    run?.gates?.deployment?.dev ||
    run?.gates?.deployment?.prod
  );
  const hasMeaningfulProgress = Boolean(
    hasAnyGate ||
    run?.artifacts?.handoffs?.length ||
    run?.artifacts?.reviewResult ||
    run?.artifacts?.validationPlan ||
    run?.artifacts?.validationResult ||
    run?.artifacts?.deploymentChecks?.dev ||
    run?.artifacts?.deploymentChecks?.prod ||
    run?.next
  );
  const hasCompletedPhaseEvidence = Boolean(
    run?.gates?.review?.status === "passed" ||
    run?.gates?.review?.status === "failed" ||
    run?.gates?.review?.status === "skipped" ||
    run?.gates?.validation?.status === "passed" ||
    run?.gates?.validation?.status === "failed" ||
    run?.gates?.validation?.status === "skipped" ||
    run?.gates?.deployment?.dev?.status === "passed" ||
    run?.gates?.deployment?.dev?.status === "failed" ||
    run?.gates?.deployment?.dev?.status === "skipped" ||
    run?.gates?.deployment?.prod?.status === "passed" ||
    run?.gates?.deployment?.prod?.status === "failed" ||
    run?.gates?.deployment?.prod?.status === "skipped" ||
    run?.artifacts?.reviewResult ||
    run?.artifacts?.validationResult ||
    run?.artifacts?.deploymentChecks?.dev ||
    run?.artifacts?.deploymentChecks?.prod
  );
  const substantialRun = Boolean(
    run?.mode === "assisted single-session" ||
    run?.mode === "team run" ||
    run?.artifacts?.handoffs?.length ||
    run?.artifacts?.validationPlan ||
    run?.artifacts?.validationResult ||
    run?.artifacts?.deploymentChecks?.dev ||
    run?.artifacts?.deploymentChecks?.prod ||
    run?.gates?.validation ||
    run?.gates?.deployment?.dev ||
    run?.gates?.deployment?.prod
  );

  if ((run?.gates?.review?.status === "passed" || run?.gates?.review?.status === "failed") && !run?.artifacts?.reviewResult) {
    missing.push("review-result artifact");
  }
  if ((run?.gates?.validation?.status === "passed" || run?.gates?.validation?.status === "failed") && !run?.artifacts?.validationResult) {
    missing.push("validation-result artifact");
  }
  if ((run?.gates?.deployment?.dev?.status === "passed" || run?.gates?.deployment?.dev?.status === "failed") && !run?.artifacts?.deploymentChecks?.dev) {
    missing.push("dev deployment-check artifact");
  }
  if ((run?.gates?.deployment?.prod?.status === "passed" || run?.gates?.deployment?.prod?.status === "failed") && !run?.artifacts?.deploymentChecks?.prod) {
    missing.push("prod deployment-check artifact");
  }
  if (substantialRun && hasMeaningfulProgress && !run?.artifacts?.runBrief) {
    missing.push("run-brief artifact");
  }
  if (substantialRun && hasCompletedPhaseEvidence && !hasPendingGates && !run?.artifacts?.finalSynthesis) {
    missing.push("final-synthesis artifact");
  }
  return missing;
}

const input = JSON.parse(process.env.HOOK_PAYLOAD || "{}");
if (input.hook_event_name !== "PreToolUse" || input.tool_name !== "Bash") {
  process.exit(0);
}

const command = input.tool_input?.command || "";
const isCommit = hasCommitLikeCommand(command);
const isPr = hasPrLikeCommand(command);
if (!isCommit && !isPr) {
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const crewWorkflowPath = path.join(cwd, ".claude", "state", "crew", "workflow-state.json");
const legacyWorkflowPath = path.join(cwd, ".claude", "state", "engineering-os", "workflow-state.json");
const workflowPath = fs.existsSync(crewWorkflowPath)
  ? crewWorkflowPath
  : (fs.existsSync(legacyWorkflowPath) ? legacyWorkflowPath : null);
if (!workflowPath) {
  process.exit(0);
}

const workflowState = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const currentRun = workflowState.currentRun;
if (!currentRun) {
  process.exit(0);
}

const pending = pendingBadges(currentRun);
const missingWrites = missingArtifactWrites(currentRun);
if (pending.length === 0 && missingWrites.length === 0) {
  process.exit(0);
}

const action = isCommit ? "git commit" : "gh pr";
const messageParts = ["Crew reminder:"];
if (pending.length > 0) {
  messageParts.push(\`pending workflow gates before \${action}: \${pending.join(", ")}\`);
}
if (missingWrites.length > 0) {
  messageParts.push(\`phase-complete write-backs still missing before \${action}: \${missingWrites.join(", ")}\`);
}
messageParts.push("Recommended next step: write the matching review/validation/deployment artifact now, or record an explicit skip before moving on.");
const message = messageParts.join(" ");

process.stdout.write(JSON.stringify({
  continue: true,
  suppressOutput: true,
  systemMessage: message
}));
NODE
`;

// Missing-script guard (astragenie/runner-plugin#402 cross-reference): a
// checkout can carry a committed .claude/settings.json referencing
// .claude/hooks/* while the scripts were never materialized in that clone
// (crew:install not run there — they live only in the plugin cache). An
// unguarded command then errors "No such file or directory" on EVERY
// matching tool call. The guard makes the command a silent no-op until
// crew:install materializes the script; `exec` preserves stdin and the
// script's own exit code when it IS present.
function guardedHookCommand(script: string, args?: string): string {
  const scriptPath = `\${PWD}/.claude/hooks/${script}`;
  return `s="${scriptPath}"; [ -f "$s" ] || exit 0; exec "$s"${args ? ` ${args}` : ""}`;
}

export const DEFAULT_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: "startup|clear|compact",
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("log_event.sh", "session_start"),
            description: "crew:session-start"
          }
        ]
      }
    ],
    TaskCreated: [
      {
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("log_event.sh", "task_created"),
            description: "crew:task-created"
          }
        ]
      }
    ],
    TaskCompleted: [
      {
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("log_event.sh", "task_completed"),
            description: "crew:task-completed"
          }
        ]
      }
    ],
    SubagentStart: [
      {
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("log_event.sh", "subagent_start"),
            description: "crew:subagent-start"
          }
        ]
      }
    ],
    SubagentStop: [
      {
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("log_event.sh", "subagent_stop"),
            description: "crew:subagent-stop"
          }
        ]
      }
    ],
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: guardedHookCommand("check_git_gate.sh"),
            description: "crew:git-gate-reminder"
          }
        ]
      }
    ]
  }
};
