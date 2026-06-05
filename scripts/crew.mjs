#!/usr/bin/env node

import path from "node:path";
import { maybeEmitCostReport } from "./lib/cost-hygiene/emit-cost-report.mjs";
import { costSliceHandler } from "./lib/cost-hygiene/cost-slice-handler.mjs";

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
  "--force": { key: "force", boolean: true },
  "--aggregate-all": { key: "aggregateAll", boolean: true },
  "--no-self": { key: "noSelf", boolean: true },
  "--non-code": { key: "nonCode", boolean: true },
  "--repo-context": { key: "repoContext", boolean: true },
  // Value-consuming flags.
  "--alerts": { key: "alerts" },
  "--approver": { key: "approver" },
  "--badge": { key: "badge" },
  "--blocked-by": { key: "blockedBy" },
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
  "--external-deltas": { key: "externalDeltas" },
  "--extra-root": { key: "extraRoot" },
  "--feature": { key: "feature" },
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
  "--phase": { key: "phase" },
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
  "--run-steps": { key: "runSteps" },
  "--run-title": { key: "runTitle" },
  "--source-project": { key: "sourceProject" },
  "--scope": { key: "scope" },
  "--severity": { key: "severity" },
  "--started-at": { key: "startedAt" },
  "--status": { key: "status" },
  "--summary": { key: "summary" },
  "--telemetry": { key: "telemetry" },
  "--test-summary": { key: "testSummary" },
  "--test-summary-skip-reason": { key: "testSummarySkipReason" },
  "--title": { key: "title" },
  "--to": { key: "to" },
  "--trigger-filename": { key: "triggerFilename" },
  "--url": { key: "url" },
  "--validation-evidence": { key: "validationEvidence" },
  "--validator": { key: "validator" },
  "--verdict": { key: "decision" }, // alias of --decision
  "--verified-from": { key: "verifiedFrom" }
};

/**
 * @typedef {{
 *   repo: string,
 *   allowExisting: boolean,
 *   help: boolean,
 *   force: boolean,
 *   noSelf: boolean,
 *   nonCode: boolean,
 *   repoContext: boolean,
 *   aggregateAll: boolean,
 *   alerts: string | null,
 *   approver: string | null,
 *   badge: string | null,
 *   blockedBy: string | null,
 *   build: string | null,
 *   clues: string | null,
 *   commitPattern: string | null,
 *   completedAt: string | null,
 *   confidence: string | null,
 *   decision: string | null,
 *   deliverable: string | null,
 *   deploy: string | null,
 *   deployer: string | null,
 *   discoveryStatus: string | null,
 *   environment: string | null,
 *   environments: string | null,
 *   evidence: string | null,
 *   externalDeltas: string | null,
 *   extraRoot: string | null,
 *   feature: string | null,
 *   files: string | null,
 *   from: string | null,
 *   goal: string | null,
 *   id: string | null,
 *   kind: string | null,
 *   logs: string | null,
 *   metrics: string | null,
 *   missing: string | null,
 *   mode: string | null,
 *   next: string | null,
 *   note: string | null,
 *   outOfScope: string | null,
 *   owner: string | null,
 *   pace: string | null,
 *   phase: string | null,
 *   preset: string | null,
 *   reason: string | null,
 *   refreshWhen: string | null,
 *   requester: string | null,
 *   resolver: string | null,
 *   resource: string | null,
 *   revision: string | null,
 *   reviewer: string | null,
 *   reviewerLabel: string | null,
 *   risks: string | null,
 *   runSteps: string | null,
 *   runTitle: string | null,
 *   scope: string | null,
 *   severity: string | null,
 *   sourceProject: string | null,
 *   startedAt: string | null,
 *   status: string | null,
 *   summary: string | null,
 *   telemetry: string | null,
 *   testSummary: string | null,
 *   testSummarySkipReason: string | null,
 *   validationEvidence: string | null,
 *   title: string | null,
 *   to: string | null,
 *   triggerFilename: string | null,
 *   url: string | null,
 *   validator: string | null,
 *   verifiedFrom: string | null,
 *   [key: string]: string | boolean | null
 * }} Flags
 */

/** @param {string[]} argv */
function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {Flags} */
  const flags = {
    repo: process.cwd(),
    allowExisting: false,
    help: false,
    force: false,
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
    externalDeltas: null,
    risks: null,
    runSteps: null,
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
    sourceProject: null,
    blockedBy: null,
    feature: null,
    nonCode: false,
    noSelf: false,
    aggregateAll: false,
    repoContext: false,
    extraRoot: null,
    phase: null,
    testSummary: null,
    testSummarySkipReason: null,
    validationEvidence: null
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
    const spec = /** @type {Record<string, {key: string, boolean?: boolean}>} */ (FLAG_SPEC)[value];
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
/** @param {string | null} [target] */
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
    "scope-estimate":
      "  node scripts/crew.mjs scope-estimate --files <path:lines[:eslintDisable],...>",
    "discover-deployment": "  node scripts/crew.mjs discover-deployment --repo <path>",
    "write-deployment-guidance":
      "  node scripts/crew.mjs write-deployment-guidance --repo <path> --title <text> [--discovery-status repo-derived|partial|live-verified] [--verified-from <a,b>] [--missing <a,b>] [--summary <text>] [--build <text>] [--deploy <text>]",
    "show-workflow-state": "  node scripts/crew.mjs show-workflow-state --repo <path>",
    "mark-badge":
      "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped|blocked|escalated_to_human [--note <text>] [--blocked-by <artifact-id>]",
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
      "  node scripts/crew.mjs write-final-synthesis --repo <path> --title <text> --external-deltas <text|none> [--summary <text>] [--run-steps <a,b>] [--files <a,b>] [--force]",
    "cost-slice":
      "  node scripts/crew.mjs cost-slice --repo <path> [--started-at <iso>] [--completed-at <iso>] [--run-title <text>] [--source-project <slug>] [--aggregate-all]",
    "cost-advise": "  node scripts/crew.mjs cost-advise --repo <path>"
  };

  if (target && subcommands[/** @type {keyof typeof subcommands} */ (target)]) {
    return [
      "Engineering OS installer",
      "",
      "Usage:",
      subcommands[/** @type {keyof typeof subcommands} */ (target)]
    ].join("\n");
  }

  return ["Engineering OS installer", "", "Usage:", ...Object.values(subcommands)].join("\n");
}

// Slug source priority: explicit --title → advisor target slice → advisor
// target runTitle → fallback "advise". --title lets the loop side pass the
// enriched FEAT/PHASE/SLICE tag so cost-advise filenames match the rest of
// the artifact surface.
/** @param {string | null} title @param {Record<string, any> | null} advisor */
function buildCostAdviseSlug(title, advisor) {
  const source = title || advisor?.target?.sliceId || advisor?.target?.runTitle || "advise";
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Optional YAML frontmatter block; "" when both feature + phase absent so
// existing output stays byte-identical for legacy callers.
/** @param {string | null} feature @param {string | null} phase */
function buildOptionalFrontmatter(feature, phase) {
  const lines = [];
  if (phase !== null && phase !== undefined && String(phase).length > 0) {
    lines.push(`phase: ${JSON.stringify(String(phase))}`);
  }
  if (feature) lines.push(`feature: ${feature}`);
  if (lines.length === 0) return "";
  return ["---", ...lines, "---", ""].join("\n");
}

/** @param {string} repoPath @param {string} md @param {Record<string, any> | null} advisor @param {Record<string, any>} [options] */
async function writeCostAdviseArtifact(repoPath, md, advisor, options = {}) {
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const { title = null, feature = null, phase = null } = options;
  const dir = pathMod.join(repoPath, ".claude", "artifacts", "crew", "cost-insights");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const slug = buildCostAdviseSlug(title, advisor);
  const fm = buildOptionalFrontmatter(feature, phase);
  const file = pathMod.join(dir, `${stamp}-cost-advise-${slug}.md`);
  await fs.writeFile(file, fm + md + "\n");
  return file;
}

// Auto-emit a cost-report artifact when a run window is available. Designed
// to be called immediately after write-final-synthesis. Failures here are
// non-fatal: they return null so the synthesis result still surfaces.
// Best-effort cost-advise emit. Returns a description object on success,
// `{ error }` on failure. Extracted from maybeEmitCostReport to keep its
// cyclomatic complexity under the eslint cap.
/** @param {string} repoPath @param {{ title: string | null, feature: string | null, phase: string | null }} opts */
async function emitCostAdvise(repoPath, { title, feature, phase }) {
  try {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.mjs");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const advisePath = await writeCostAdviseArtifact(repoPath, md, advisor, {
      title,
      feature,
      phase
    });
    return {
      path: advisePath,
      recommendations: advisor.recommendations?.length || 0,
      aggregateFlags: advisor.aggregateFlags?.length || 0
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Normalize an MSYS / Git Bash POSIX path like `/c/work/foo` to a Windows
// path `C:/work/foo` when running on win32. Node's path.resolve treats a
// leading "/" as drive-relative, so `/c/work` becomes `C:\c\work` (a phantom
// nested dir). This converter restores the intended drive-letter form.
/** @param {string} value */
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

/**
 * @typedef {{ repoPath: string, flags: Flags, positionals: string[] }} CommandContext
 */

// Command registry. Each entry is `(ctx) => Promise<result>` where
// `ctx = { repoPath, flags, positionals }`. main() dispatches by name; the
// table replaces a 240-line else-if chain. Adding a command = one entry.
const COMMANDS = {
  "install-global": async () => {
    const { installGlobal } = await import("./lib/installer.mjs");
    return installGlobal();
  },
  audit: async (/** @type {CommandContext} */ { repoPath }) => {
    const { auditRepo } = await import("./lib/installer.mjs");
    return auditRepo(repoPath);
  },
  bootstrap: async (/** @type {CommandContext} */ { repoPath }) => {
    const { bootstrapRepo } = await import("./lib/installer.mjs");
    return bootstrapRepo(repoPath);
  },
  init: async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { initRepo } = await import("./lib/installer.mjs");
    return initRepo(repoPath, { allowExisting: flags.allowExisting });
  },

  claim: async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { claimFiles } = await import("./lib/claims.mjs");
    return claimFiles(repoPath, positionals, { owner: flags.owner || "lead-session" });
  },
  release: async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { releaseFiles } = await import("./lib/claims.mjs");
    return releaseFiles(repoPath, positionals, { owner: flags.owner });
  },
  "show-claims": async (/** @type {CommandContext} */ { repoPath }) => {
    const { listClaims } = await import("./lib/claims.mjs");
    return { claims: await listClaims(repoPath) };
  },
  "show-conflicts": async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { inspectClaims } = await import("./lib/claims.mjs");
    return inspectClaims(repoPath, positionals, { owner: flags.owner || "lead-session" });
  },

  "request-approval": async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { requestApproval } = await import("./lib/approvals.mjs");
    return requestApproval(repoPath, {
      requester: flags.requester || "lead-session",
      approver: flags.approver,
      kind: flags.kind || "scope_change",
      severity: flags.severity || "medium",
      summary: flags.summary || positionals.join(" ") || "Approval requested",
      reason: flags.reason || ""
    });
  },
  "show-approvals": async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { listApprovals } = await import("./lib/approvals.mjs");
    return {
      approvals: await listApprovals(repoPath, { status: flags.status, approver: flags.approver })
    };
  },
  "resolve-approval": async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { resolveApproval } = await import("./lib/approvals.mjs");
    return resolveApproval(repoPath, {
      id: flags.id,
      decision: flags.decision,
      resolver: flags.resolver || "lead-session",
      note: flags.note || ""
    });
  },

  "wake-up": async (/** @type {CommandContext} */ { repoPath }) => {
    const { buildWakeUpBrief } = await import("./lib/wakeup.mjs");
    return buildWakeUpBrief(repoPath);
  },
  "brief-me": async (/** @type {CommandContext} */ { repoPath }) => {
    const { buildBriefingReport } = await import("./lib/briefing.mjs");
    return buildBriefingReport(repoPath);
  },
  "scope-estimate": async (/** @type {CommandContext} */ { flags, positionals }) => {
    const { estimateScope } = await import("./lib/scope-estimate.mjs");
    const rawFiles = (flags.files || positionals.join(",") || "").split(",").filter(Boolean);
    const files = rawFiles.map((entry) => {
      const [p, linesStr, eslintDisableStr] = entry.split(":");
      return {
        path: p || "",
        lines: parseInt(linesStr, 10) || 0,
        eslintDisable: eslintDisableStr === "true"
      };
    });
    return estimateScope({ files });
  },
  fleet: async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { buildFleetReport } = await import("./lib/fleet.mjs");
    return buildFleetReport(repoPath, {
      extraRoots: flags.extraRoot ? [flags.extraRoot] : [],
      includeSelf: !flags.noSelf
    });
  },
  "discover-deployment": async (/** @type {CommandContext} */ { repoPath }) => {
    const { discoverDeploymentClues } = await import("./lib/deployment-guidance.mjs");
    return discoverDeploymentClues(repoPath);
  },
  "write-deployment-guidance": async (
    /** @type {CommandContext} */ { repoPath, flags, positionals }
  ) => {
    const { writeDeploymentGuidance } = await import("./lib/deployment-guidance.mjs");
    return writeDeploymentGuidance(repoPath, {
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
  },

  "show-workflow-state": async (/** @type {CommandContext} */ { repoPath }) => {
    const { loadWorkflowState, summarizeWorkflowState } = await import("./lib/workflow-state.mjs");
    const workflowState = await loadWorkflowState(repoPath);
    return { workflowState, summary: summarizeWorkflowState(workflowState) };
  },
  "mark-badge": async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { markWorkflowBadge } = await import("./lib/workflow-state.mjs");
    const currentRun = await markWorkflowBadge(repoPath, {
      badge: flags.badge,
      note: flags.note || flags.reason || "",
      blockedBy: flags.blockedBy,
      title: flags.title,
      goal: flags.goal,
      mode: flags.mode,
      next: flags.next
    });
    return { badge: flags.badge, currentRun };
  },

  "write-run-brief": async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "run-brief", {
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
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase
    });
  },
  "write-handoff": async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "handoff", {
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
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase,
      repoContext: flags.repoContext
    });
  },
  "write-review-result": async (/** @type {CommandContext} */ { repoPath, flags, positionals }) => {
    const decision = flags.decision;
    const VALID_DECISIONS = new Set(["approved", "approved_with_notes", "rejected"]);
    if (decision && !VALID_DECISIONS.has(decision)) {
      process.stderr.write(
        `[crew] write-review-result refused: unknown decision "${decision}". Valid values: approved, approved_with_notes, rejected.\n`
      );
      process.exit(2);
    }
    const isApproved = decision === "approved" || decision === "approved_with_notes";
    const isCodeBearing = !flags.nonCode;
    if (isApproved && isCodeBearing && !flags.testSummary && !flags.testSummarySkipReason) {
      process.stderr.write(
        "[crew] write-review-result refused: --test-summary or --test-summary-skip-reason is required for approved code-bearing reviews. " +
          "Pass --non-code if the diff is doc-only.\n"
      );
      process.exit(2);
    }
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "review-result", {
      title: flags.title || positionals.join(" ") || "Review Result",
      reviewer: flags.reviewer || flags.owner || "reviewer",
      decision,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase,
      testSummary: flags.testSummary,
      testSummarySkipReason: flags.testSummarySkipReason,
      validationEvidence: flags.validationEvidence,
      nonCode: flags.nonCode
    });
  },
  "write-validation-plan": async (
    /** @type {CommandContext} */ { repoPath, flags, positionals }
  ) => {
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "validation-plan", {
      title: flags.title || positionals.join(" ") || "Validation Plan",
      validator: flags.validator || flags.owner || "validator",
      owner: flags.owner || "lead-session",
      environment: flags.environment,
      goal: flags.goal,
      summary: flags.summary,
      scope: flags.scope,
      outOfScope: flags.outOfScope,
      evidence: flags.evidence,
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase
    });
  },
  "write-validation-result": async (
    /** @type {CommandContext} */ { repoPath, flags, positionals }
  ) => {
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "validation-result", {
      title: flags.title || positionals.join(" ") || "Validation Result",
      validator: flags.validator || flags.owner || "validator",
      environment: flags.environment,
      decision: flags.decision,
      goal: flags.goal,
      summary: flags.summary,
      evidence: flags.evidence,
      files: flags.files,
      risks: flags.risks,
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase
    });
  },
  "write-deployment-check": async (
    /** @type {CommandContext} */ { repoPath, flags, positionals }
  ) => {
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    return writeArtifact(repoPath, "deployment-check", {
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
      next: flags.next,
      feature: flags.feature,
      phase: flags.phase
    });
  },
  "write-final-synthesis": async (
    /** @type {CommandContext} */ { repoPath, flags, positionals }
  ) => {
    if (flags.externalDeltas === null || flags.externalDeltas === undefined) {
      throw new Error(
        "write-final-synthesis requires --external-deltas. " +
          "Enumerate sibling-config changes the synthesis depends on " +
          "(env var renames, terraform/helm updates, sibling-repo PRs, feature flags, DB migrations, IAM). " +
          "Pass --external-deltas none explicitly if there are none. " +
          "A silent default is how renamed env vars silently fall back to old defaults in prod."
      );
    }
    const { writeArtifact } = await import("./lib/artifacts.mjs");
    const synthesis = await writeArtifact(repoPath, "final-synthesis", {
      title: flags.title || positionals.join(" ") || "Final Synthesis",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "completed" : flags.status,
      summary: flags.summary,
      files: flags.files,
      evidence: flags.evidence,
      externalDeltas: flags.externalDeltas,
      runSteps: flags.runSteps,
      risks: flags.risks,
      next: flags.next,
      force: flags.force,
      feature: flags.feature,
      phase: flags.phase
    });
    const costArtifact = await maybeEmitCostReport(
      repoPath,
      {
        runTitle: flags.title || positionals.join(" ") || null,
        feature: flags.feature,
        phase: flags.phase
      },
      emitCostAdvise
    );
    return costArtifact ? { ...synthesis, costReport: costArtifact } : synthesis;
  },

  "cost-advise": async (/** @type {CommandContext} */ { repoPath, flags }) => {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.mjs");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const writePath = await writeCostAdviseArtifact(repoPath, md, advisor, {
      title: flags.title,
      feature: flags.feature,
      phase: flags.phase
    });
    return {
      target: advisor.target?.sliceId || advisor.target?.runTitle || null,
      recommendations: advisor.recommendations,
      aggregateFlags: advisor.aggregateFlags || [],
      baseline: advisor.baseline,
      reportsAnalyzed: advisor.reports.length,
      artifactPath: writePath
    };
  },
  "cost-slice": (/** @type {CommandContext} */ { repoPath, flags }) =>
    costSliceHandler({ repoPath, flags })
};

async function main() {
  const { command, helpTarget, flags, positionals } = parseArgs(process.argv.slice(2));
  const repoPath = path.resolve(normalizeMsysPath(flags.repo));

  if (command === "help") {
    console.log(usage(helpTarget));
    return;
  }

  const handler = COMMANDS[/** @type {keyof typeof COMMANDS} */ (command)];
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
