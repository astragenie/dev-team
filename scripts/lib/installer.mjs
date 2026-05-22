import fs from "node:fs/promises";
import path from "node:path";

const GLOBAL_MEMORY_VERSION = "1.1";
const GLOBAL_METADATA_TEMPLATE = {
  managedBy: "crew",
  version: GLOBAL_MEMORY_VERSION,
  files: ["constitution.md", "workflow.md"]
};

// Marker block injected into repo CLAUDE.md. The repo-local constitution is
// imported via @-syntax so it shows up in agent context automatically. The
// workflow.md is deliberately NOT imported — agents read workflow via the
// commands and brief-me memory bucket, not by stuffing it into CLAUDE.md.
const CLAUDE_IMPORT_BLOCK = [
  "<!-- crew:start -->",
  "<!-- Crew framework memory. Run /crew:install after plugin updates that change framework memory. -->",
  "@.claude/crew/constitution.md",
  "<!-- crew:end -->"
].join("\n");
// Legacy marker retained for upgrade detection (see updateClaudeMd).
const LEGACY_CLAUDE_MARKER_START = "<!-- engineering-os:start -->";
const LEGACY_CLAUDE_MARKER_END = "<!-- engineering-os:end -->";

// Marker-bracketed block injected into the repo's .gitignore. Lines outside
// the block belong to the user and are preserved across re-runs; lines inside
// are owned by this plugin and refresh on each install.
const GITIGNORE_MARKER_START = "# crew:start";
const GITIGNORE_MARKER_END = "# crew:end";
const GITIGNORE_BLOCK = [
  GITIGNORE_MARKER_START,
  "# Crew framework local state. Generated; do not edit between markers.",
  ".claude/logs/",
  ".claude/state/crew/history.jsonl",
  ".claude/state/crew/approvals.jsonl",
  ".claude.backup.*",
  GITIGNORE_MARKER_END
].join("\n");

const CONSTITUTION_TEMPLATE = `# Engineering OS Constitution

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

- lead: planning, delegation, synthesis
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
`;

const WORKFLOW_TEMPLATE = `# Engineering OS Workflow

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

const PROTOCOL_TEMPLATE = `# Crew Agent Protocol

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

const ARTIFACT_README_TEMPLATE = `# Crew Artifacts

This directory stores inspectable run artifacts for the Crew harness.

- \`runs/\` for run briefs and final syntheses
- \`handoffs/\` for task ownership and completion notes
- \`reviews/\` for review results and rejection notes
- \`validations/\` for validation plans and validation results
- \`deployments/\` for deployment checks and environment evidence
`;

const STATE_README_TEMPLATE = `# Crew State

This directory stores lightweight repo-local coordination state.

- \`claims.json\` tracks current file ownership claims
- \`history.jsonl\` stores append-only claim and release events
- \`approvals.jsonl\` stores approval requests and resolutions
- \`workflow-state.json\` stores the current run and gate badge state
- \`sprint.json\` is an optional sprint or focus configuration
`;

const CLAIMS_TEMPLATE = {
  version: "1.0",
  updatedAt: "2026-01-01T00:00:00.000Z",
  claims: {},
  warnings: []
};

const SPRINT_TEMPLATE = {
  focus: "P1",
  notes: [
    "Replace or remove this file if you do not use sprint-style priorities.",
    "Crew keeps this repo-local so coordination remains inspectable."
  ]
};

const HOOK_SCRIPT_TEMPLATE = `#!/usr/bin/env bash
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

const GIT_GATE_REMINDER_TEMPLATE = `#!/usr/bin/env bash
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

const DEFAULT_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: "startup|clear|compact",
        hooks: [
          {
            type: "command",
            command: "${PWD}/.claude/hooks/log_event.sh session_start",
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
            command: "${PWD}/.claude/hooks/log_event.sh task_created",
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
            command: "${PWD}/.claude/hooks/log_event.sh task_completed",
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
            command: "${PWD}/.claude/hooks/log_event.sh subagent_start",
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
            command: "${PWD}/.claude/hooks/log_event.sh subagent_stop",
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
            command: "${PWD}/.claude/hooks/check_git_gate.sh",
            description: "crew:git-gate-reminder"
          }
        ]
      }
    ]
  }
};

function indentJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileIfChanged(filePath, contents, options = {}) {
  const existing = await fs.readFile(filePath, "utf8").catch(() => null);
  if (existing === contents) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}

function isCrewHook(entry) {
  const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
  return hooks.some((hook) => {
    const command = hook?.command || "";
    const description = hook?.description || "";
    return command.includes(".claude/hooks/log_event.sh")
      || command.includes(".claude/hooks/check_git_gate.sh")
      // Detect both current ("crew:") and legacy ("engineering-os:") namespaces so
      // mergeHooks replaces legacy registrations cleanly after the rename.
      || description.startsWith("crew:")
      || description.startsWith("engineering-os:");
  });
}

function mergeHooks(existingHooks = {}, desiredHooks = {}) {
  const result = { ...existingHooks };
  for (const [eventName, hookDefs] of Object.entries(desiredHooks)) {
    const current = Array.isArray(result[eventName]) ? result[eventName] : [];
    const preserved = current.filter((entry) => !isCrewHook(entry));
    const nextEntries = [...preserved];
    const seen = new Set(nextEntries.map((item) => JSON.stringify(item)));
    for (const hookDef of hookDefs) {
      const serialized = JSON.stringify(hookDef);
      if (!seen.has(serialized)) {
        nextEntries.push(hookDef);
        seen.add(serialized);
      }
    }
    result[eventName] = nextEntries;
  }
  return result;
}

function replaceLegacyMarkerBlock(existing) {
  // Replace the entire legacy `<!-- engineering-os:start -->...<!-- engineering-os:end -->`
  // block with the new crew marker block. Preserves CLAUDE.md content outside the block.
  const startIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_START);
  const endIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  const before = existing.slice(0, startIndex).trimEnd();
  const after = existing.slice(endIndex + LEGACY_CLAUDE_MARKER_END.length).trimStart();
  const middle = `${CLAUDE_IMPORT_BLOCK}`;
  const parts = [before, middle];
  if (after) {
    parts.push(after);
  }
  return `${parts.join("\n\n")}\n`;
}

async function updateClaudeMd(repoPath, writes) {
  const claudePath = path.join(repoPath, "CLAUDE.md");
  const existing = await fs.readFile(claudePath, "utf8").catch(() => null);

  if (existing === null) {
    const contents = [
      "# Repo Instructions",
      "",
      "This repository uses the Crew harness.",
      "",
      CLAUDE_IMPORT_BLOCK,
      ""
    ].join("\n");
    await writeFileIfChanged(claudePath, contents);
    writes.push(path.relative(repoPath, claudePath));
    return;
  }

  // Already on the new marker — leave alone (idempotency).
  if (existing.includes("<!-- crew:start -->")) {
    return;
  }

  // Legacy marker present — upgrade the block in place.
  if (existing.includes(LEGACY_CLAUDE_MARKER_START)) {
    const upgraded = replaceLegacyMarkerBlock(existing);
    if (upgraded !== null) {
      await writeFileIfChanged(claudePath, upgraded);
      writes.push(path.relative(repoPath, claudePath));
      return;
    }
  }

  // No marker block yet — append.
  const next = `${existing.trimEnd()}\n\n${CLAUDE_IMPORT_BLOCK}\n`;
  await writeFileIfChanged(claudePath, next);
  writes.push(path.relative(repoPath, claudePath));
}

async function updateGitignore(repoPath, writes) {
  const ignorePath = path.join(repoPath, ".gitignore");
  const existing = await fs.readFile(ignorePath, "utf8").catch(() => null);

  if (existing === null) {
    const contents = `${GITIGNORE_BLOCK}\n`;
    await writeFileIfChanged(ignorePath, contents);
    writes.push(path.relative(repoPath, ignorePath));
    return;
  }

  // Replace the marker block in place when present; else append.
  const startIdx = existing.indexOf(GITIGNORE_MARKER_START);
  const endIdx = existing.indexOf(GITIGNORE_MARKER_END);
  let next;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + GITIGNORE_MARKER_END.length);
    next = `${before}${GITIGNORE_BLOCK}${after}`;
  } else {
    next = `${existing.trimEnd()}\n\n${GITIGNORE_BLOCK}\n`;
  }

  const changed = await writeFileIfChanged(ignorePath, next);
  if (changed) {
    writes.push(path.relative(repoPath, ignorePath));
  }
}

async function updateSettings(repoPath, writes) {
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  const existing = await fs.readFile(settingsPath, "utf8").catch(() => null);
  const current = existing ? JSON.parse(existing) : {};
  const next = {
    ...current,
    hooks: mergeHooks(current.hooks, DEFAULT_SETTINGS.hooks)
  };

  const changed = await writeFileIfChanged(settingsPath, indentJson(next));
  if (changed) {
    writes.push(path.relative(repoPath, settingsPath));
  }
}

// Like writeFileIfChanged but only writes when the file does not yet exist.
// Used for stateful seeds (claims, history, workflow-state) so a migrated
// legacy file is not clobbered by the default template.
async function writeSeedIfMissing(filePath, contents, options = {}) {
  if (await pathExists(filePath)) {
    return false;
  }
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, options);
  return true;
}

async function writeHarnessFiles(repoPath, writes) {
  // README and hook scripts are template files — always refresh to the latest.
  const refreshFiles = [
    [
      path.join(repoPath, ".claude", "artifacts", "crew", "README.md"),
      `${ARTIFACT_README_TEMPLATE}\n`
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "README.md"),
      `${STATE_README_TEMPLATE}\n`
    ],
    [
      path.join(repoPath, ".claude", "hooks", "log_event.sh"),
      HOOK_SCRIPT_TEMPLATE
    ],
    [
      path.join(repoPath, ".claude", "hooks", "check_git_gate.sh"),
      GIT_GATE_REMINDER_TEMPLATE
    ]
  ];

  for (const [filePath, contents] of refreshFiles) {
    const isHookScript = filePath.endsWith("log_event.sh") || filePath.endsWith("check_git_gate.sh");
    const changed = await writeFileIfChanged(
      filePath,
      contents,
      isHookScript ? { mode: 0o755 } : {}
    );
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }

  // State seeds — only write when missing, so a migrated legacy file keeps its data.
  const seedFiles = [
    [
      path.join(repoPath, ".claude", "state", "crew", "claims.json"),
      `${JSON.stringify(CLAIMS_TEMPLATE, null, 2)}\n`
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "history.jsonl"),
      ""
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "approvals.jsonl"),
      ""
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
      `${JSON.stringify({
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        currentRun: null,
        recentRuns: []
      }, null, 2)}\n`
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "sprint.json"),
      `${JSON.stringify(SPRINT_TEMPLATE, null, 2)}\n`
    ]
  ];

  for (const [filePath, contents] of seedFiles) {
    const changed = await writeSeedIfMissing(filePath, contents);
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }

  const directories = [
    path.join(repoPath, ".claude", "artifacts", "crew", "runs"),
    path.join(repoPath, ".claude", "artifacts", "crew", "handoffs"),
    path.join(repoPath, ".claude", "artifacts", "crew", "reviews"),
    path.join(repoPath, ".claude", "artifacts", "crew", "validations"),
    path.join(repoPath, ".claude", "artifacts", "crew", "deployments"),
    path.join(repoPath, ".claude", "logs"),
    path.join(repoPath, ".claude", "state", "crew")
  ];
  for (const directory of directories) {
    await ensureDir(directory);
  }
}

// Writes the repo-local framework memory files under .claude/crew/. These are
// repo-scoped copies of the framework constitution and workflow so the harness
// is self-contained in the repo (the global copies under ~/.claude/engineering-os/
// remain authoritative for users who set them up globally).
async function writeRepoLocalGuides(repoPath, writes) {
  const guides = [
    [path.join(repoPath, ".claude", "crew", "constitution.md"), `${CONSTITUTION_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "workflow.md"), `${WORKFLOW_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "protocol.md"), `${PROTOCOL_TEMPLATE}\n`]
  ];
  for (const [filePath, contents] of guides) {
    const changed = await writeFileIfChanged(filePath, contents);
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }
}

// Step 3: destructive migration. Moves every file under each .claude/.../engineering-os/
// legacy directory into the equivalent .claude/.../crew/ path. When both files exist,
// the newer mtime wins (crew/ is preferred on tie). Empty legacy directories are then
// removed so the repo ends in a clean single-namespace state.
async function migrateLegacyHarness(repoPath, writes) {
  const moves = [
    [
      path.join(repoPath, ".claude", "engineering-os"),
      path.join(repoPath, ".claude", "crew")
    ],
    [
      path.join(repoPath, ".claude", "state", "engineering-os"),
      path.join(repoPath, ".claude", "state", "crew")
    ],
    [
      path.join(repoPath, ".claude", "artifacts", "engineering-os"),
      path.join(repoPath, ".claude", "artifacts", "crew")
    ]
  ];

  for (const [legacyRoot, targetRoot] of moves) {
    if (!(await pathExists(legacyRoot))) {
      continue;
    }
    await migrateDirectoryTree(legacyRoot, targetRoot, repoPath, writes);
    await removeEmptyTree(legacyRoot);
  }
}

async function migrateDirectoryTree(legacyDir, targetDir, repoPath, writes) {
  const entries = await fs.readdir(legacyDir, { withFileTypes: true });
  for (const entry of entries) {
    const legacyPath = path.join(legacyDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await ensureDir(targetPath);
      await migrateDirectoryTree(legacyPath, targetPath, repoPath, writes);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    await migrateOneFile(legacyPath, targetPath, repoPath, writes);
  }
}

async function migrateOneFile(legacyPath, targetPath, repoPath, writes) {
  const targetExists = await pathExists(targetPath);
  if (!targetExists) {
    await ensureDir(path.dirname(targetPath));
    const data = await fs.readFile(legacyPath);
    await fs.writeFile(targetPath, data);
    writes.push(path.relative(repoPath, targetPath));
    await fs.unlink(legacyPath);
    return;
  }

  // Both exist — newer mtime wins. Tie goes to the new (crew/) path.
  const [legacyStat, targetStat] = await Promise.all([fs.stat(legacyPath), fs.stat(targetPath)]);
  if (legacyStat.mtimeMs > targetStat.mtimeMs) {
    const data = await fs.readFile(legacyPath);
    await fs.writeFile(targetPath, data);
    writes.push(path.relative(repoPath, targetPath));
  }
  await fs.unlink(legacyPath);
}

async function removeEmptyTree(dirPath) {
  if (!(await pathExists(dirPath))) {
    return;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyTree(path.join(dirPath, entry.name));
    }
  }
  const remaining = await fs.readdir(dirPath);
  if (remaining.length === 0) {
    await fs.rmdir(dirPath);
  }
}

export async function auditRepo(repoPath) {
  const global = await inspectGlobalInstall();
  return {
    repoPath,
    exists: await pathExists(repoPath),
    hasClaudeMd: await pathExists(path.join(repoPath, "CLAUDE.md")),
    hasDotClaude: await pathExists(path.join(repoPath, ".claude")),
    hasSettings: await pathExists(path.join(repoPath, ".claude", "settings.json")),
    hasHarnessLayer: await pathExists(path.join(repoPath, ".claude", "artifacts", "crew")),
    hasStateLayer: await pathExists(path.join(repoPath, ".claude", "state", "crew", "claims.json")),
    hasWorkflowState: await pathExists(path.join(repoPath, ".claude", "state", "crew", "workflow-state.json")),
    global
  };
}

function buildWelcome({ mode, repoScoped = false }) {
  const commands = repoScoped
    ? ["/crew:brief-me", "/crew:build", "/crew:fix", "/crew:ship"]
    : ["/crew:init", "/crew:adopt", "/crew:brief-me"];

  const headlineByMode = {
    init: "Crew is now wired into this repo. Excellent judgment.",
    bootstrap: "This repo is now on Crew. Tasteful choice.",
    "install-global": "Crew global memory is installed. Bold and correct."
  };

  const optional = repoScoped
    ? [
        "Optional: /crew:install-commit-bridge to mint Crew artifacts from matching commits (installs a PostToolUse hook; skip if you don't want that)."
      ]
    : [];

  return {
    headline: headlineByMode[mode] || "Crew is ready.",
    commands,
    guidance: repoScoped
      ? "Start with /crew:brief-me for a quick situational report, then /crew:build or /crew:fix for real work."
      : "Use /crew:init for a new repo, /crew:adopt for an existing repo, and /crew:brief-me once a repo is wired in.",
    optional
  };
}

export async function bootstrapRepo(repoPath) {
  if (!(await pathExists(repoPath))) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const writes = [];
  // Migrate first so writeHarnessFiles uses missing-only semantics on top of
  // whatever the legacy tree provides (Step 3 of the P3.1 namespace rename).
  await migrateLegacyHarness(repoPath, writes);
  await updateClaudeMd(repoPath, writes);
  await updateGitignore(repoPath, writes);
  await writeHarnessFiles(repoPath, writes);
  await writeRepoLocalGuides(repoPath, writes);
  await updateSettings(repoPath, writes);

  return {
    mode: "bootstrap",
    repoPath,
    writes,
    audit: await auditRepo(repoPath),
    welcome: buildWelcome({ mode: "bootstrap", repoScoped: true })
  };
}

const GLOBAL_IMPORT_LINES = [
  "@~/.claude/engineering-os/constitution.md",
  "@~/.claude/engineering-os/workflow.md"
];

function globalPaths(homeDir) {
  const globalDir = path.join(homeDir, ".claude", "engineering-os");
  return {
    globalDir,
    constitution: path.join(globalDir, "constitution.md"),
    workflow: path.join(globalDir, "workflow.md"),
    metadata: path.join(globalDir, "metadata.json"),
    claudeMd: path.join(homeDir, ".claude", "CLAUDE.md")
  };
}

async function inspectGlobalInstall() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  const metadata = await fs.readFile(paths.metadata, "utf8")
    .then((raw) => JSON.parse(raw))
    .catch(() => null);
  const hasImports = await fs.readFile(paths.claudeMd, "utf8")
    .then((raw) => GLOBAL_IMPORT_LINES.every((line) => raw.includes(line)))
    .catch(() => false);

  const hasConstitution = await pathExists(paths.constitution);
  const hasWorkflow = await pathExists(paths.workflow);
  const hasGlobalMemory = hasConstitution && hasWorkflow && hasImports;

  return {
    hasGlobalMemory,
    globalMemoryVersion: metadata?.version || null,
    expectedGlobalMemoryVersion: GLOBAL_MEMORY_VERSION,
    globalMemoryStale: hasGlobalMemory && metadata?.version !== GLOBAL_MEMORY_VERSION,
    hasGlobalImports: hasImports,
    globalMemoryPath: path.join(homeDir, ".claude", "engineering-os")
  };
}

export async function installGlobal() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  const writes = [];

  const constitutionChanged = await writeFileIfChanged(paths.constitution, `${CONSTITUTION_TEMPLATE}\n`);
  if (constitutionChanged) {
    writes.push("~/.claude/engineering-os/constitution.md");
  }

  const workflowChanged = await writeFileIfChanged(paths.workflow, `${WORKFLOW_TEMPLATE}\n`);
  if (workflowChanged) {
    writes.push("~/.claude/engineering-os/workflow.md");
  }

  const metadataChanged = await writeFileIfChanged(
    paths.metadata,
    `${JSON.stringify(GLOBAL_METADATA_TEMPLATE, null, 2)}\n`
  );
  if (metadataChanged) {
    writes.push("~/.claude/engineering-os/metadata.json");
  }

  const existing = await fs.readFile(paths.claudeMd, "utf8").catch(() => "");
  const missingLines = GLOBAL_IMPORT_LINES.filter((line) => !existing.includes(line));
  if (missingLines.length > 0) {
    const prefix = missingLines.join("\n");
    const next = existing ? `${prefix}\n\n${existing}` : `${prefix}\n`;
    await ensureDir(path.dirname(paths.claudeMd));
    await fs.writeFile(paths.claudeMd, next);
    writes.push("~/.claude/CLAUDE.md");
  }

  return {
    mode: "install-global",
    writes,
    global: await inspectGlobalInstall(),
    welcome: buildWelcome({ mode: "install-global", repoScoped: false })
  };
}

export async function initRepo(repoPath, options = {}) {
  if (await pathExists(repoPath)) {
    const entries = await fs.readdir(repoPath).catch(() => []);
    if (entries.length > 0 && !options.allowExisting) {
      throw new Error(
        `Target directory already exists and is not empty: ${repoPath}. Pass --allow-existing to reuse it.`
      );
    }
  } else {
    await ensureDir(repoPath);
  }

  const writes = [];
  const gitPath = path.join(repoPath, ".git");
  if (!(await pathExists(gitPath))) {
    await ensureDir(gitPath);
    writes.push(".git/");
  }

  const result = await bootstrapRepo(repoPath);
  return {
    mode: "init",
    repoPath,
    writes: [...writes, ...result.writes],
    audit: result.audit,
    welcome: buildWelcome({ mode: "init", repoScoped: true })
  };
}
