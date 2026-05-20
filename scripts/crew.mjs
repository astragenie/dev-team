#!/usr/bin/env node

import path from "node:path";
import { writeArtifact } from "./lib/artifacts.mjs";
import {
  discoverDeploymentClues,
  writeDeploymentGuidance
} from "./lib/deployment-guidance.mjs";
import { buildBriefingReport } from "./lib/briefing.mjs";
import { auditRepo, bootstrapRepo, initRepo, installGlobal } from "./lib/installer.mjs";
import {
  installCommitBridge,
  installWigginBridge,
  backfillCommitBridge,
  backfillWigginBridge,
  listBridgePresets
} from "./lib/bridge-installer.mjs";
import { listApprovals, requestApproval, resolveApproval } from "./lib/approvals.mjs";
import { claimFiles, inspectClaims, listClaims, releaseFiles } from "./lib/claims.mjs";
import { buildWakeUpBrief } from "./lib/wakeup.mjs";
import { loadWorkflowState, markWorkflowBadge, summarizeWorkflowState } from "./lib/workflow-state.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    repo: process.cwd(),
    allowExisting: false,
    help: false,
    owner: null,
    requester: null,
    approver: null,
    resolver: null,
    kind: null,
    severity: null,
    summary: null,
    reason: null,
    note: null,
    status: "open",
    id: null,
    decision: null,
    title: null,
    goal: null,
    mode: null,
    pace: null,
    scope: null,
    outOfScope: null,
    files: null,
    evidence: null,
    risks: null,
    next: null,
    from: null,
    to: null,
    deliverable: null,
    confidence: null,
    reviewer: null,
    validator: null,
    deployer: null,
    environment: null,
    build: null,
    deploy: null,
    environments: null,
    logs: null,
    metrics: null,
    alerts: null,
    telemetry: null,
    clues: null,
    discoveryStatus: null,
    verifiedFrom: null,
    missing: null,
    refreshWhen: null,
    resource: null,
    url: null,
    revision: null,
    badge: null,
    preset: null,
    commitPattern: null,
    triggerFilename: null,
    reviewerLabel: null
  };
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--") {
      for (let tail = index + 1; tail < rest.length; tail += 1) {
        positionals.push(rest[tail]);
      }
      break;
    }
    if (value === "--help" || value === "-h") {
      flags.help = true;
      continue;
    }
    if (value === "--repo") {
      flags.repo = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--allow-existing") {
      flags.allowExisting = true;
      continue;
    }
    if (value === "--owner") {
      flags.owner = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--requester") {
      flags.requester = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--approver") {
      flags.approver = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--resolver") {
      flags.resolver = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--kind") {
      flags.kind = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--severity") {
      flags.severity = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--summary") {
      flags.summary = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--reason") {
      flags.reason = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--note") {
      flags.note = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--status") {
      flags.status = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--id") {
      flags.id = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--decision") {
      flags.decision = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--verdict") {
      flags.decision = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--title") {
      flags.title = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--goal") {
      flags.goal = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--mode") {
      flags.mode = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--pace") {
      flags.pace = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--scope") {
      flags.scope = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--out-of-scope") {
      flags.outOfScope = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--files") {
      flags.files = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--evidence") {
      flags.evidence = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--risks") {
      flags.risks = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--next") {
      flags.next = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--from") {
      flags.from = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--to") {
      flags.to = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--deliverable") {
      flags.deliverable = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--confidence") {
      flags.confidence = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--reviewer") {
      flags.reviewer = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--validator") {
      flags.validator = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--deployer") {
      flags.deployer = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--environment") {
      flags.environment = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--build") {
      flags.build = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--deploy") {
      flags.deploy = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--environments") {
      flags.environments = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--logs") {
      flags.logs = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--metrics") {
      flags.metrics = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--alerts") {
      flags.alerts = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--telemetry") {
      flags.telemetry = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--clues") {
      flags.clues = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--discovery-status") {
      flags.discoveryStatus = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--verified-from") {
      flags.verifiedFrom = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--missing") {
      flags.missing = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--refresh-when") {
      flags.refreshWhen = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--resource") {
      flags.resource = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--url") {
      flags.url = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--revision") {
      flags.revision = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--badge") {
      flags.badge = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--preset") {
      flags.preset = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--commit-pattern") {
      flags.commitPattern = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--trigger-filename") {
      flags.triggerFilename = rest[index + 1];
      index += 1;
      continue;
    }
    if (value === "--reviewer-label") {
      flags.reviewerLabel = rest[index + 1];
      index += 1;
      continue;
    }
    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }
    positionals.push(value);
  }

  if (!command || command === "--help" || command === "-h") {
    return { command: "help", helpTarget: null, flags, positionals };
  }

  if (flags.help) {
    return { command: "help", helpTarget: command, flags, positionals };
  }

  return { command, helpTarget: null, flags, positionals };
}

function usage(target = null) {
  const subcommands = {
    "install-global": "  node scripts/crew.mjs install-global",
    audit: "  node scripts/crew.mjs audit --repo <path>",
    bootstrap: "  node scripts/crew.mjs bootstrap --repo <path>",
    init: "  node scripts/crew.mjs init --repo <path> [--allow-existing]",
    claim: "  node scripts/crew.mjs claim --repo <path> [--owner <name>] <files...>",
    release: "  node scripts/crew.mjs release --repo <path> [--owner <name>] [files...]",
    "show-claims": "  node scripts/crew.mjs show-claims --repo <path>",
    "show-conflicts": "  node scripts/crew.mjs show-conflicts --repo <path> [--owner <name>] [files...]",
    "request-approval": "  node scripts/crew.mjs request-approval --repo <path> --summary <text> [--kind <kind>] [--severity <level>] [--requester <name>] [--approver <name>] [--reason <text>]",
    "show-approvals": "  node scripts/crew.mjs show-approvals --repo <path> [--status open|resolved|all] [--approver <name>]",
    "resolve-approval": "  node scripts/crew.mjs resolve-approval --repo <path> --id <approval-id> --decision approved|rejected|canceled [--resolver <name>] [--note <text>]",
    "wake-up": "  node scripts/crew.mjs wake-up --repo <path>",
    "brief-me": "  node scripts/crew.mjs brief-me --repo <path>",
    "discover-deployment": "  node scripts/crew.mjs discover-deployment --repo <path>",
    "write-deployment-guidance": "  node scripts/crew.mjs write-deployment-guidance --repo <path> --title <text> [--discovery-status repo-derived|partial|live-verified] [--verified-from <a,b>] [--missing <a,b>] [--summary <text>] [--build <text>] [--deploy <text>]",
    "show-workflow-state": "  node scripts/crew.mjs show-workflow-state --repo <path>",
    "mark-badge": "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped [--note <text>]",
    "write-run-brief": "  node scripts/crew.mjs write-run-brief --repo <path> --title <text> [--goal <text>] [--mode <mode>] [--pace <pace>]",
    "write-handoff": "  node scripts/crew.mjs write-handoff --repo <path> --title <text> [--from <role>] [--to <role>] [--files <a,b>]",
    "write-review-result": "  node scripts/crew.mjs write-review-result --repo <path> --title <text> [--reviewer <role>] [--decision <decision>] [--verdict <decision>]",
    "write-validation-plan": "  node scripts/crew.mjs write-validation-plan --repo <path> --title <text> [--validator <role>] [--environment <name>]",
    "write-validation-result": "  node scripts/crew.mjs write-validation-result --repo <path> --title <text> [--validator <role>] [--environment <name>] [--decision <decision>]",
    "write-deployment-check": "  node scripts/crew.mjs write-deployment-check --repo <path> --title <text> [--deployer <role>] [--environment dev|prod] [--resource <name>] [--url <service-url>] [--revision <id>] [--decision <decision>]",
    "write-final-synthesis": "  node scripts/crew.mjs write-final-synthesis --repo <path> --title <text> [--summary <text>] [--files <a,b>]",
    "install-commit-bridge": "  node scripts/crew.mjs install-commit-bridge --repo <path> [--preset wiggin-loop|conventional-commits] [--commit-pattern <regex>] [--trigger-filename <name>] [--reviewer-label <name>]",
    "backfill-commit-bridge": "  node scripts/crew.mjs backfill-commit-bridge --repo <path> [--preset wiggin-loop|conventional-commits] [--commit-pattern <regex>] [--reviewer-label <name>]",
    "list-bridge-presets": "  node scripts/crew.mjs list-bridge-presets",
    "install-wiggin-bridge": "  node scripts/crew.mjs install-wiggin-bridge --repo <path>   (alias: install-commit-bridge --preset wiggin-loop)",
    "backfill-wiggin-bridge": "  node scripts/crew.mjs backfill-wiggin-bridge --repo <path> (alias: backfill-commit-bridge --preset wiggin-loop)"
  };

  if (target && subcommands[target]) {
    return [
      "Engineering OS installer",
      "",
      "Usage:",
      subcommands[target]
    ].join("\n");
  }

  return [
    "Engineering OS installer",
    "",
    "Usage:",
    ...Object.values(subcommands)
  ].join("\n");
}

// Normalize an MSYS / Git Bash POSIX path like `/c/work/foo` to a Windows
// path `C:/work/foo` when running on win32. Node's path.resolve treats a
// leading "/" as drive-relative, so `/c/work` becomes `C:\c\work` (a phantom
// nested dir). This converter restores the intended drive-letter form.
function normalizeMsysPath(value) {
  if (!value || process.platform !== "win32") {
    return value;
  }
  const match = value.match(/^\/([a-zA-Z])\/(.*)$/);
  if (!match) {
    return value;
  }
  return `${match[1].toUpperCase()}:/${match[2]}`;
}

async function main() {
  const { command, helpTarget, flags, positionals } = parseArgs(process.argv.slice(2));
  const repoPath = path.resolve(normalizeMsysPath(flags.repo));

  if (command === "help") {
    console.log(usage(helpTarget));
    return;
  }

  let result;
  if (command === "install-global") {
    result = await installGlobal();
  } else if (command === "audit") {
    result = await auditRepo(repoPath);
  } else if (command === "bootstrap") {
    result = await bootstrapRepo(repoPath);
  } else if (command === "init") {
    result = await initRepo(repoPath, { allowExisting: flags.allowExisting });
  } else if (command === "install-commit-bridge") {
    result = await installCommitBridge(repoPath, {
      preset: flags.preset,
      commitPattern: flags.commitPattern,
      triggerFilename: flags.triggerFilename,
      reviewerLabel: flags.reviewerLabel
    });
  } else if (command === "backfill-commit-bridge") {
    result = await backfillCommitBridge(repoPath, {
      preset: flags.preset,
      commitPattern: flags.commitPattern,
      reviewerLabel: flags.reviewerLabel
    });
  } else if (command === "list-bridge-presets") {
    result = { presets: listBridgePresets() };
  } else if (command === "install-wiggin-bridge") {
    result = await installWigginBridge(repoPath);
  } else if (command === "backfill-wiggin-bridge") {
    result = await backfillWigginBridge(repoPath);
  } else if (command === "claim") {
    result = await claimFiles(repoPath, positionals, { owner: flags.owner || "lead-session" });
  } else if (command === "release") {
    result = await releaseFiles(repoPath, positionals, { owner: flags.owner });
  } else if (command === "show-claims") {
    result = { claims: await listClaims(repoPath) };
  } else if (command === "show-conflicts") {
    result = await inspectClaims(repoPath, positionals, { owner: flags.owner || "lead-session" });
  } else if (command === "request-approval") {
    result = await requestApproval(repoPath, {
      requester: flags.requester || "lead-session",
      approver: flags.approver,
      kind: flags.kind || "scope_change",
      severity: flags.severity || "medium",
      summary: flags.summary || positionals.join(" ") || "Approval requested",
      reason: flags.reason || ""
    });
  } else if (command === "show-approvals") {
    result = { approvals: await listApprovals(repoPath, { status: flags.status, approver: flags.approver }) };
  } else if (command === "resolve-approval") {
    result = await resolveApproval(repoPath, {
      id: flags.id,
      decision: flags.decision,
      resolver: flags.resolver || "lead-session",
      note: flags.note || ""
    });
  } else if (command === "wake-up") {
    result = await buildWakeUpBrief(repoPath);
  } else if (command === "brief-me") {
    result = await buildBriefingReport(repoPath);
  } else if (command === "discover-deployment") {
    result = await discoverDeploymentClues(repoPath);
  } else if (command === "write-deployment-guidance") {
    result = await writeDeploymentGuidance(repoPath, {
      title: flags.title || positionals.join(" ") || "Repo Deployment Model",
      owner: flags.owner || "lead-session",
      summary: flags.summary,
      build: flags.build,
      deploy: flags.deploy,
      environments: flags.environments,
      logs: flags.logs,
      metrics: flags.metrics,
      alerts: flags.alerts,
      telemetry: flags.telemetry,
      clues: flags.clues,
      discoveryStatus: flags.discoveryStatus,
      verifiedFrom: flags.verifiedFrom,
      missing: flags.missing,
      refreshWhen: flags.refreshWhen,
      next: flags.next
    });
  } else if (command === "show-workflow-state") {
    const workflowState = await loadWorkflowState(repoPath);
    result = {
      workflowState,
      summary: summarizeWorkflowState(workflowState)
    };
  } else if (command === "mark-badge") {
    const currentRun = await markWorkflowBadge(repoPath, {
      badge: flags.badge,
      note: flags.note || flags.reason || "",
      title: flags.title,
      goal: flags.goal,
      mode: flags.mode,
      next: flags.next
    });
    result = {
      badge: flags.badge,
      currentRun
    };
  } else if (command === "write-run-brief") {
    result = await writeArtifact(repoPath, "run-brief", {
      title: flags.title || positionals.join(" ") || "Run Brief",
      goal: flags.goal,
      mode: flags.mode,
      pace: flags.pace,
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "active" : flags.status,
      summary: flags.summary,
      scope: flags.scope,
      outOfScope: flags.outOfScope,
      files: flags.files,
      next: flags.next
    });
  } else if (command === "write-handoff") {
    result = await writeArtifact(repoPath, "handoff", {
      title: flags.title || positionals.join(" ") || "Task Handoff",
      from: flags.from || flags.owner || "lead-session",
      to: flags.to,
      goal: flags.goal,
      summary: flags.summary,
      scope: flags.scope,
      outOfScope: flags.outOfScope,
      deliverable: flags.deliverable,
      files: flags.files,
      confidence: flags.confidence,
      risks: flags.risks,
      next: flags.next
    });
  } else if (command === "write-review-result") {
    result = await writeArtifact(repoPath, "review-result", {
      title: flags.title || positionals.join(" ") || "Review Result",
      reviewer: flags.reviewer || flags.owner || "reviewer",
      decision: flags.decision,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next
    });
  } else if (command === "write-validation-plan") {
    result = await writeArtifact(repoPath, "validation-plan", {
      title: flags.title || positionals.join(" ") || "Validation Plan",
      validator: flags.validator || flags.owner || "validator",
      owner: flags.owner || "lead-session",
      environment: flags.environment,
      goal: flags.goal,
      summary: flags.summary,
      scope: flags.scope,
      outOfScope: flags.outOfScope,
      evidence: flags.evidence,
      next: flags.next
    });
  } else if (command === "write-validation-result") {
    result = await writeArtifact(repoPath, "validation-result", {
      title: flags.title || positionals.join(" ") || "Validation Result",
      validator: flags.validator || flags.owner || "validator",
      environment: flags.environment,
      decision: flags.decision,
      goal: flags.goal,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next
    });
  } else if (command === "write-deployment-check") {
    result = await writeArtifact(repoPath, "deployment-check", {
      title: flags.title || positionals.join(" ") || "Deployment Check",
      deployer: flags.deployer || flags.owner || "deployer",
      environment: flags.environment,
      resource: flags.resource,
      url: flags.url,
      revision: flags.revision,
      decision: flags.decision,
      goal: flags.goal,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next
    });
  } else if (command === "write-final-synthesis") {
    result = await writeArtifact(repoPath, "final-synthesis", {
      title: flags.title || positionals.join(" ") || "Final Synthesis",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "completed" : flags.status,
      summary: flags.summary,
      files: flags.files,
      evidence: flags.evidence,
      risks: flags.risks,
      next: flags.next
    });
  } else {
    throw new Error(`Unknown command: ${command}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
