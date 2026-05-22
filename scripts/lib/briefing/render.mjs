// Render layer for brief-me. Pure data -> string transforms; no I/O.
// Consumes shapes produced by ./collect.mjs.
// Extracted from briefing.mjs during the Tier B-7 split.

export function buildRetrievalGuide(wakeUpBrief, artifacts) {
  const guide = [];

  for (const entry of wakeUpBrief.repoMemory.slice(0, 3)) {
    guide.push({
      kind: entry.kind,
      path: entry.path
    });
  }
  if (wakeUpBrief.repoGuidance?.deployment?.path) {
    guide.push({
      kind: "deployment-guidance",
      path: wakeUpBrief.repoGuidance.deployment.path
    });
  }
  for (const artifact of artifacts.slice(0, 3)) {
    guide.push({
      kind: artifact.kind,
      path: artifact.path
    });
  }

  return guide.filter(
    (entry, index, list) => list.findIndex((candidate) => candidate.path === entry.path) === index
  );
}

export function buildCurrentObjective(wakeUpBrief, artifacts) {
  const currentRun = wakeUpBrief.workflow?.currentRun;
  if (currentRun) {
    return {
      source: "workflow",
      title: currentRun.title || "Workflow Run",
      goal: currentRun.goal || "",
      mode: currentRun.mode || "",
      status: currentRun.status || "",
      next: currentRun.next || ""
    };
  }

  const latestRun = artifacts.find((artifact) => artifact.kind === "runBrief");
  if (latestRun) {
    return {
      source: "run-artifact",
      title: latestRun.title,
      goal: latestRun.goal || "",
      mode: latestRun.mode || "",
      status: "idle",
      next: latestRun.next || ""
    };
  }

  const latestSynthesis = wakeUpBrief.latestArtifacts?.finalSynthesis;
  if (latestSynthesis) {
    return {
      source: "latest-final-synthesis",
      title: latestSynthesis.title,
      goal: "",
      mode: "",
      status: "completed",
      next: ""
    };
  }

  return {
    source: "none",
    title: "No active objective recorded",
    goal: "",
    mode: "",
    status: "idle",
    next: ""
  };
}

// Formats a gate failure message: prefer the operator-supplied note when
// present, otherwise terminate with a period.
function gateFailureMessage(label, gate) {
  return `${label}${gate?.note ? `: ${gate.note}` : "."}`;
}

// Static maps for the simple "if-badge-then-message" cases. Keeps the
// dynamic builder below short.
const PENDING_BADGE_MESSAGES = {
  review_required: "Independent review is still required before commit, PR, or final completion.",
  validation_expected: "Validation evidence is still expected for the current run.",
  dev_deploy_expected: "Dev deployment evidence is still missing for the current run.",
  prod_deploy_expected: "Production deployment evidence is still missing for the current run."
};
const MISSING_WRITE_MESSAGES = {
  review_result_missing:
    "Independent review appears complete, but the review artifact write-back is still missing.",
  validation_result_missing:
    "Validation appears complete, but the validation-result artifact write-back is still missing.",
  dev_deployment_check_missing:
    "Dev deployment evidence exists in workflow state, but the deployment-check artifact is still missing.",
  prod_deployment_check_missing:
    "Production deployment evidence exists in workflow state, but the deployment-check artifact is still missing.",
  run_brief_missing:
    "This run has meaningful progress, but the run-brief artifact is still missing.",
  final_synthesis_missing:
    "Meaningful workflow phases completed, but the final synthesis artifact is still missing."
};
const GATE_FAILURE_SPECS = [
  { label: "Independent review failed", gate: (g) => g.review },
  { label: "Validation failed", gate: (g) => g.validation },
  { label: "Dev deployment checks failed", gate: (g) => g.deployment?.dev },
  { label: "Production deployment checks failed", gate: (g) => g.deployment?.prod }
];

function collectGateFailureMessages(gates) {
  return GATE_FAILURE_SPECS.filter((spec) => spec.gate(gates)?.status === "failed").map((spec) =>
    gateFailureMessage(spec.label, spec.gate(gates))
  );
}

function collectRepoStateMessages(wakeUpBrief, deploymentClues, gitActivity) {
  const out = [];
  if (wakeUpBrief.openApprovals.length > 0) {
    out.push(`${wakeUpBrief.openApprovals.length} open approval(s) still need a decision.`);
  }
  if (!wakeUpBrief.hasClaudeMd) {
    out.push("This repo is not fully adopted into Crew yet.");
  }
  if (
    !wakeUpBrief.repoGuidance?.deployment &&
    deploymentClues.clues.length > 0 &&
    !wakeUpBrief.workflow?.hasActiveRun
  ) {
    out.push("Deployment clues exist, but durable deployment guidance has not been recorded yet.");
  }
  if (gitActivity.workingTree.behind > 0) {
    out.push(
      `Current branch is behind ${gitActivity.workingTree.upstream || "upstream"} by ${gitActivity.workingTree.behind} commit(s).`
    );
  }
  return out;
}

export function buildBlockedOrMissing(wakeUpBrief, deploymentClues, gitActivity) {
  const pending = wakeUpBrief.workflow?.pendingBadges || [];
  const missingWrites = wakeUpBrief.workflow?.missingArtifactWrites || [];
  const gates = wakeUpBrief.workflow?.currentRun?.gates || {};

  return [
    ...pending.map((b) => PENDING_BADGE_MESSAGES[b]).filter(Boolean),
    ...collectGateFailureMessages(gates),
    ...missingWrites.map((w) => MISSING_WRITE_MESSAGES[w]).filter(Boolean),
    ...collectRepoStateMessages(wakeUpBrief, deploymentClues, gitActivity)
  ];
}

const REMINDER_RULES = [
  {
    when: (ctx) => ctx.gitActivity.isGitRepo && ctx.gitActivity.workingTree.hasChanges,
    message: (ctx) =>
      `Working tree has ${ctx.gitActivity.workingTree.stagedCount} staged, ${ctx.gitActivity.workingTree.modifiedCount} modified, and ${ctx.gitActivity.workingTree.untrackedCount} untracked path(s).`
  },
  {
    when: (ctx) => !ctx.wakeUpBrief.summary.hasRecentRunMemory,
    message: () => "No recent run artifacts are recorded for this repo yet."
  },
  {
    when: (ctx) =>
      !ctx.wakeUpBrief.repoGuidance?.deployment && ctx.deploymentClues.clues.length > 0,
    message: (ctx) =>
      `Deployment clues were found in ${ctx.deploymentClues.clues.slice(0, 3).join(", ")}${ctx.deploymentClues.clues.length > 3 ? ", ..." : ""}.`
  },
  {
    when: (ctx) => ctx.wakeUpBrief.claims.length > 0,
    message: (ctx) =>
      `${ctx.wakeUpBrief.claims.length} active claim(s) are still present in repo-local state.`
  },
  {
    when: (ctx) => ctx.wakeUpBrief.repoMemory.length <= 1,
    message: () =>
      "Repo-specific memory is still thin; keep durable guidance and lessons learned up to date."
  },
  {
    when: (ctx) => ctx.missingWrites.size > 0,
    message: () =>
      "A workflow phase appears complete, but the matching artifact write-back is still missing."
  },
  {
    when: (ctx) => ctx.routingTable?.present && ctx.routingTable.stale,
    message: (ctx) =>
      `Routing table (docs/routing-table.md) is ${ctx.routingTable.ageDays} days stale. Review against the last ~30 runs and refresh signal → role rows.`
  }
];

export function buildImportantReminders(wakeUpBrief, deploymentClues, gitActivity, routingTable) {
  const ctx = {
    wakeUpBrief,
    deploymentClues,
    gitActivity,
    routingTable,
    missingWrites: new Set(wakeUpBrief.workflow?.missingArtifactWrites || [])
  };
  return REMINDER_RULES.filter((rule) => rule.when(ctx)).map((rule) => rule.message(ctx));
}

// Returns a message for whichever repo/git/deployment state warrants a
// nudge, or null when none apply. Same priority order as the original
// if-chain; first match wins.
function repoStateNextStep(wakeUpBrief, deploymentClues, gitActivity) {
  const probes = [
    {
      cond: !wakeUpBrief.hasClaudeMd,
      msg: "Run /crew:adopt so the repo has the Crew harness, repo guidance, and local workflow state."
    },
    {
      cond: wakeUpBrief.openApprovals.length > 0,
      msg: "Resolve the open approval queue before pushing the workflow forward."
    },
    {
      cond: !wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0,
      msg: "Capture durable deployment guidance next so ship work can reuse repo-specific environment knowledge."
    },
    {
      cond: gitActivity.workingTree.behind > 0,
      msg: `Review or pull the ${gitActivity.workingTree.behind} upstream commit(s) before starting the next work chunk.`
    },
    {
      cond: gitActivity.workingTree.hasChanges,
      msg: "Decide whether the current uncommitted changes belong in the active work chunk or should be reviewed and split."
    }
  ];
  return probes.find((p) => p.cond)?.msg || null;
}

export function recommendedNextStep(wakeUpBrief, deploymentClues, gitActivity) {
  const pending = wakeUpBrief.workflow?.pendingBadges || [];
  const missingWrites = wakeUpBrief.workflow?.missingArtifactWrites || [];
  const currentRun = wakeUpBrief.workflow?.currentRun || null;
  const gates = currentRun?.gates || {};

  // Priority chain (first match wins): repo-not-adopted → pending gate →
  // failed gate → missing artifact → open approval → user-supplied next →
  // repo/git state nudges → default.
  const repoNotAdopted = !wakeUpBrief.hasClaudeMd
    ? "Run /crew:adopt so the repo has the Crew harness, repo guidance, and local workflow state."
    : null;
  const ordered = [
    repoNotAdopted,
    NEXT_STEP_FROM_PENDING[pending[0]],
    collectGateFailureNextStep(gates),
    NEXT_STEP_FROM_MISSING[missingWrites[0]],
    currentRun?.next || null,
    repoStateNextStep(wakeUpBrief, deploymentClues, gitActivity)
  ];
  return (
    ordered.find(Boolean) ||
    "Start the next work chunk with /crew:build or /crew:fix, or just describe the task to the lead."
  );
}

const NEXT_STEP_FROM_PENDING = {
  review_required:
    "Run independent review next before committing, opening a PR, or calling the work done.",
  validation_expected:
    "Run validation next and record the evidence before moving the work forward.",
  dev_deploy_expected:
    "Use /crew:ship to gather dev deployment evidence and verify the environment transition.",
  prod_deploy_expected:
    "Decide whether production promotion is appropriate, then use /crew:ship to collect prod evidence."
};

const NEXT_STEP_FROM_MISSING = {
  review_result_missing:
    "Write the review-result artifact now so the run has an inspectable review gate record.",
  validation_result_missing:
    "Write the validation-result artifact now so the run keeps the evidence it already collected.",
  dev_deployment_check_missing:
    "Write the dev deployment-check artifact now so the environment evidence is recoverable next time.",
  prod_deployment_check_missing:
    "Write the production deployment-check artifact now so the rollout evidence is preserved.",
  run_brief_missing:
    "Write the run-brief artifact now so this workstream has a bounded starting point for recovery.",
  final_synthesis_missing:
    "Write the final synthesis now so the completed work and next step are preserved before you move on."
};

const GATE_NEXT_STEP_SPECS = [
  {
    gate: (g) => g.review,
    message: "Address the failed review findings before moving the work forward."
  },
  {
    gate: (g) => g.validation,
    message: "Investigate the failed validation evidence and fix the issue before continuing."
  },
  {
    gate: (g) => g.deployment?.dev,
    message: "Investigate the failed dev deployment checks before attempting another rollout."
  },
  {
    gate: (g) => g.deployment?.prod,
    message:
      "Investigate the failed production checks immediately before any further promotion work."
  }
];

function collectGateFailureNextStep(gates) {
  const hit = GATE_NEXT_STEP_SPECS.find((spec) => spec.gate(gates)?.status === "failed");
  return hit ? hit.message : null;
}

export function buildSecondaryOptions(wakeUpBrief, deploymentClues, gitActivity) {
  const options = [];

  if (gitActivity.isGitRepo && gitActivity.workingTree.hasChanges) {
    options.push(
      "Inspect the current working tree and decide whether anything should be staged, split, or discarded."
    );
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0) {
    options.push(
      "Write repo deployment guidance now so later ship work does not need to rediscover CI/CD from scratch."
    );
  }
  if (!wakeUpBrief.summary.hasRecentRunMemory) {
    options.push(
      "Leave a run brief once substantial work starts so the next session has bounded context to recover."
    );
  }
  if (wakeUpBrief.workflow?.hasActiveRun && !wakeUpBrief.workflow.currentRun?.next) {
    options.push(
      "Record a concrete next step in workflow state or the next artifact so recovery nudges stay specific."
    );
  }

  return options.slice(0, 3);
}

// Best-effort lookup of the autonomous-loop plugin CLI from the Claude Code
// plugin cache. Returns null if not installed. The brief integration is
// optional — crew works fine without the plugin present.
