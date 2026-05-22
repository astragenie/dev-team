#!/usr/bin/env node

import path from "node:path";
import { writeArtifact } from "./lib/artifacts.mjs";
import { discoverDeploymentClues, writeDeploymentGuidance } from "./lib/deployment-guidance.mjs";
import { buildBriefingReport } from "./lib/briefing.mjs";
import { auditRepo, bootstrapRepo, initRepo, installGlobal } from "./lib/installer.mjs";
import { listApprovals, requestApproval, resolveApproval } from "./lib/approvals.mjs";
import { claimFiles, inspectClaims, listClaims, releaseFiles } from "./lib/claims.mjs";
import { buildWakeUpBrief } from "./lib/wakeup.mjs";
import {
  loadWorkflowState,
  markWorkflowBadge,
  summarizeWorkflowState
} from "./lib/workflow-state.mjs";
import { computeSessionCost } from "./lib/session-cost.mjs";
import { collectOutcomeLinkage } from "./lib/outcome-linkage.mjs";
import { buildCostAdvisor, renderCostAdvisorMarkdown } from "./lib/cost-advisor.mjs";

// Flag schema. Each entry maps a CLI flag to the flags-object key and the
// arity (whether it consumes a value). Aliases (e.g. `--verdict` → `decision`)
// are supported by giving two entries the same target key. parseArgs() drives
// off this table instead of a 350-line if-chain.
//
// Keep entries alphabetized within each arity group for diffability.
const FLAG_SPEC = {
  // Boolean flags (no value).
  "--allow-existing": { key: "allowExisting", boolean: true },
  "--help": { key: "help", boolean: true },
  "-h": { key: "help", boolean: true },
  // Value-consuming flags.
  "--alerts": { key: "alerts" },
  "--approver": { key: "approver" },
  "--badge": { key: "badge" },
  "--build": { key: "build" },
  "--clues": { key: "clues" },
  "--commit-pattern": { key: "commitPattern" },
  "--completed-at": { key: "completedAt" },
  "--confidence": { key: "confidence" },
  "--decision": { key: "decision" },
  "--deliverable": { key: "deliverable" },
  "--deploy": { key: "deploy" },
  "--deployer": { key: "deployer" },
  "--discovery-status": { key: "discoveryStatus" },
  "--environment": { key: "environment" },
  "--environments": { key: "environments" },
  "--evidence": { key: "evidence" },
  "--files": { key: "files" },
  "--from": { key: "from" },
  "--goal": { key: "goal" },
  "--id": { key: "id" },
  "--kind": { key: "kind" },
  "--logs": { key: "logs" },
  "--metrics": { key: "metrics" },
  "--missing": { key: "missing" },
  "--mode": { key: "mode" },
  "--next": { key: "next" },
  "--note": { key: "note" },
  "--out-of-scope": { key: "outOfScope" },
  "--owner": { key: "owner" },
  "--pace": { key: "pace" },
  "--preset": { key: "preset" },
  "--reason": { key: "reason" },
  "--refresh-when": { key: "refreshWhen" },
  "--repo": { key: "repo" },
  "--requester": { key: "requester" },
  "--resolver": { key: "resolver" },
  "--resource": { key: "resource" },
  "--revision": { key: "revision" },
  "--reviewer": { key: "reviewer" },
  "--reviewer-label": { key: "reviewerLabel" },
  "--risks": { key: "risks" },
  "--run-title": { key: "runTitle" },
  "--source-project": { key: "sourceProject" },
  "--aggregate-all": { key: "aggregateAll", boolean: true },
  "--scope": { key: "scope" },
  "--severity": { key: "severity" },
  "--started-at": { key: "startedAt" },
  "--status": { key: "status" },
  "--summary": { key: "summary" },
  "--telemetry": { key: "telemetry" },
  "--title": { key: "title" },
  "--to": { key: "to" },
  "--trigger-filename": { key: "triggerFilename" },
  "--url": { key: "url" },
  "--validator": { key: "validator" },
  "--verdict": { key: "decision" }, // alias of --decision
  "--verified-from": { key: "verifiedFrom" }
};

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
    reviewerLabel: null,
    startedAt: null,
    completedAt: null,
    runTitle: null,
    sourceProject: null
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
    const spec = FLAG_SPEC[value];
    if (spec) {
      if (spec.boolean) {
        flags[spec.key] = true;
      } else {
        flags[spec.key] = rest[index + 1];
        index += 1;
      }
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
    "show-conflicts":
      "  node scripts/crew.mjs show-conflicts --repo <path> [--owner <name>] [files...]",
    "request-approval":
      "  node scripts/crew.mjs request-approval --repo <path> --summary <text> [--kind <kind>] [--severity <level>] [--requester <name>] [--approver <name>] [--reason <text>]",
    "show-approvals":
      "  node scripts/crew.mjs show-approvals --repo <path> [--status open|resolved|all] [--approver <name>]",
    "resolve-approval":
      "  node scripts/crew.mjs resolve-approval --repo <path> --id <approval-id> --decision approved|rejected|canceled [--resolver <name>] [--note <text>]",
    "wake-up": "  node scripts/crew.mjs wake-up --repo <path>",
    "brief-me": "  node scripts/crew.mjs brief-me --repo <path>",
    "discover-deployment": "  node scripts/crew.mjs discover-deployment --repo <path>",
    "write-deployment-guidance":
      "  node scripts/crew.mjs write-deployment-guidance --repo <path> --title <text> [--discovery-status repo-derived|partial|live-verified] [--verified-from <a,b>] [--missing <a,b>] [--summary <text>] [--build <text>] [--deploy <text>]",
    "show-workflow-state": "  node scripts/crew.mjs show-workflow-state --repo <path>",
    "mark-badge":
      "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped [--note <text>]",
    "write-run-brief":
      "  node scripts/crew.mjs write-run-brief --repo <path> --title <text> [--goal <text>] [--mode <mode>] [--pace <pace>]",
    "write-handoff":
      "  node scripts/crew.mjs write-handoff --repo <path> --title <text> [--from <role>] [--to <role>] [--files <a,b>]",
    "write-review-result":
      "  node scripts/crew.mjs write-review-result --repo <path> --title <text> [--reviewer <role>] [--decision <decision>] [--verdict <decision>]",
    "write-validation-plan":
      "  node scripts/crew.mjs write-validation-plan --repo <path> --title <text> [--validator <role>] [--environment <name>]",
    "write-validation-result":
      "  node scripts/crew.mjs write-validation-result --repo <path> --title <text> [--validator <role>] [--environment <name>] [--decision <decision>]",
    "write-deployment-check":
      "  node scripts/crew.mjs write-deployment-check --repo <path> --title <text> [--deployer <role>] [--environment dev|prod] [--resource <name>] [--url <service-url>] [--revision <id>] [--decision <decision>]",
    "write-final-synthesis":
      "  node scripts/crew.mjs write-final-synthesis --repo <path> --title <text> [--summary <text>] [--files <a,b>]",
    "cost-slice":
      "  node scripts/crew.mjs cost-slice --repo <path> [--started-at <iso>] [--completed-at <iso>] [--run-title <text>] [--source-project <slug>] [--aggregate-all]",
    "cost-advise": "  node scripts/crew.mjs cost-advise --repo <path>"
  };

  if (target && subcommands[target]) {
    return ["Engineering OS installer", "", "Usage:", subcommands[target]].join("\n");
  }

  return ["Engineering OS installer", "", "Usage:", ...Object.values(subcommands)].join("\n");
}

async function writeCostAdviseArtifact(repoPath, md, advisor) {
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const dir = pathMod.join(repoPath, ".claude", "artifacts", "crew", "cost-insights");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const slug = (advisor?.target?.sliceId || advisor?.target?.runTitle || "advise")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const file = pathMod.join(dir, `${stamp}-cost-advise-${slug}.md`);
  await fs.writeFile(file, md + "\n");
  return file;
}

// Auto-emit a cost-report artifact when a run window is available. Designed
// to be called immediately after write-final-synthesis. Failures here are
// non-fatal: they return null so the synthesis result still surfaces.
async function maybeEmitCostReport(repoPath, { runTitle } = {}) {
  try {
    const state = await loadWorkflowState(repoPath);
    const run = state?.currentRun || null;
    if (!run?.startedAt) return null;
    const completedAt = run.completedAt || new Date().toISOString();
    const cost = await computeSessionCost(repoPath, {
      startedAt: run.startedAt,
      completedAt,
      // Default to aggregate-all on auto-emit so cross-repo work is captured
      // by default. Manual `cost-slice` still defaults to single-source unless
      // --aggregate-all is passed.
      aggregateAll: true
    });
    const title = runTitle || run.title || "cost-report";
    const outcome = await collectOutcomeLinkage(repoPath, title);
    const reportArtifact = await writeArtifact(repoPath, "cost-report", {
      title: `Cost — ${title}`,
      runTitle: title,
      cost,
      outcome
    });
    // Chain the advisor — runs the rule library against the freshly-written
    // cost-report (now the most recent) plus prior history, and writes a
    // sibling advise artifact. Failure here is also non-fatal.
    let adviseArtifact = null;
    try {
      const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
      const md = renderCostAdvisorMarkdown(advisor);
      const advisePath = await writeCostAdviseArtifact(repoPath, md, advisor);
      adviseArtifact = {
        path: advisePath,
        recommendations: advisor.recommendations?.length || 0,
        aggregateFlags: advisor.aggregateFlags?.length || 0
      };
    } catch (err) {
      adviseArtifact = { error: err.message };
    }
    return { report: reportArtifact, advise: adviseArtifact };
  } catch (err) {
    return { error: err.message };
  }
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

// Command registry. Each entry is `(ctx) => Promise<result>` where
// `ctx = { repoPath, flags, positionals }`. main() dispatches by name; the
// table replaces a 240-line else-if chain. Adding a command = one entry.
const COMMANDS = {
  "install-global": () => installGlobal(),
  audit: ({ repoPath }) => auditRepo(repoPath),
  bootstrap: ({ repoPath }) => bootstrapRepo(repoPath),
  init: ({ repoPath, flags }) => initRepo(repoPath, { allowExisting: flags.allowExisting }),

  claim: ({ repoPath, flags, positionals }) =>
    claimFiles(repoPath, positionals, { owner: flags.owner || "lead-session" }),
  release: ({ repoPath, flags, positionals }) =>
    releaseFiles(repoPath, positionals, { owner: flags.owner }),
  "show-claims": async ({ repoPath }) => ({ claims: await listClaims(repoPath) }),
  "show-conflicts": ({ repoPath, flags, positionals }) =>
    inspectClaims(repoPath, positionals, { owner: flags.owner || "lead-session" }),

  "request-approval": ({ repoPath, flags, positionals }) =>
    requestApproval(repoPath, {
      requester: flags.requester || "lead-session",
      approver: flags.approver,
      kind: flags.kind || "scope_change",
      severity: flags.severity || "medium",
      summary: flags.summary || positionals.join(" ") || "Approval requested",
      reason: flags.reason || ""
    }),
  "show-approvals": async ({ repoPath, flags }) => ({
    approvals: await listApprovals(repoPath, { status: flags.status, approver: flags.approver })
  }),
  "resolve-approval": ({ repoPath, flags }) =>
    resolveApproval(repoPath, {
      id: flags.id,
      decision: flags.decision,
      resolver: flags.resolver || "lead-session",
      note: flags.note || ""
    }),

  "wake-up": ({ repoPath }) => buildWakeUpBrief(repoPath),
  "brief-me": ({ repoPath }) => buildBriefingReport(repoPath),
  "discover-deployment": ({ repoPath }) => discoverDeploymentClues(repoPath),
  "write-deployment-guidance": ({ repoPath, flags, positionals }) =>
    writeDeploymentGuidance(repoPath, {
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
    }),

  "show-workflow-state": async ({ repoPath }) => {
    const workflowState = await loadWorkflowState(repoPath);
    return { workflowState, summary: summarizeWorkflowState(workflowState) };
  },
  "mark-badge": async ({ repoPath, flags }) => {
    const currentRun = await markWorkflowBadge(repoPath, {
      badge: flags.badge,
      note: flags.note || flags.reason || "",
      title: flags.title,
      goal: flags.goal,
      mode: flags.mode,
      next: flags.next
    });
    return { badge: flags.badge, currentRun };
  },

  "write-run-brief": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "run-brief", {
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
    }),
  "write-handoff": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "handoff", {
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
    }),
  "write-review-result": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "review-result", {
      title: flags.title || positionals.join(" ") || "Review Result",
      reviewer: flags.reviewer || flags.owner || "reviewer",
      decision: flags.decision,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next
    }),
  "write-validation-plan": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "validation-plan", {
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
    }),
  "write-validation-result": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "validation-result", {
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
    }),
  "write-deployment-check": ({ repoPath, flags, positionals }) =>
    writeArtifact(repoPath, "deployment-check", {
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
    }),
  "write-final-synthesis": async ({ repoPath, flags, positionals }) => {
    const synthesis = await writeArtifact(repoPath, "final-synthesis", {
      title: flags.title || positionals.join(" ") || "Final Synthesis",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "completed" : flags.status,
      summary: flags.summary,
      files: flags.files,
      evidence: flags.evidence,
      risks: flags.risks,
      next: flags.next
    });
    const costArtifact = await maybeEmitCostReport(repoPath, {
      runTitle: flags.title || positionals.join(" ") || null
    });
    return costArtifact ? { ...synthesis, costReport: costArtifact } : synthesis;
  },

  "cost-advise": async ({ repoPath }) => {
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const writePath = await writeCostAdviseArtifact(repoPath, md, advisor);
    return {
      target: advisor.target?.sliceId || advisor.target?.runTitle || null,
      recommendations: advisor.recommendations,
      aggregateFlags: advisor.aggregateFlags || [],
      baseline: advisor.baseline,
      reportsAnalyzed: advisor.reports.length,
      artifactPath: writePath
    };
  },
  "cost-slice": async ({ repoPath, flags }) => {
    const state = await loadWorkflowState(repoPath);
    const run = state?.currentRun || null;
    const startedAt = flags.startedAt || run?.startedAt;
    const completedAt = flags.completedAt || run?.completedAt || null;
    const runTitle = flags.runTitle || flags.title || run?.title || "manual-cost-slice";
    if (!startedAt) {
      throw new Error("cost-slice requires --started-at or an active/last run with startedAt");
    }
    const cost = await computeSessionCost(repoPath, {
      startedAt,
      completedAt,
      sourceProject: flags.sourceProject,
      aggregateAll: flags.aggregateAll === true
    });
    const outcome = await collectOutcomeLinkage(repoPath, runTitle);
    const artifact = await writeArtifact(repoPath, "cost-report", {
      title: `Cost — ${runTitle}`,
      runTitle,
      cost,
      outcome,
      notes: flags.summary || null
    });
    artifact.cost = cost;
    artifact.outcome = outcome;
    return artifact;
  }
};

async function main() {
  const { command, helpTarget, flags, positionals } = parseArgs(process.argv.slice(2));
  const repoPath = path.resolve(normalizeMsysPath(flags.repo));

  if (command === "help") {
    console.log(usage(helpTarget));
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await handler({ repoPath, flags, positionals });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
