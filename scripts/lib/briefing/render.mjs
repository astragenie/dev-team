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

export function buildBlockedOrMissing(wakeUpBrief, deploymentClues, gitActivity) {
  const pending = new Set(wakeUpBrief.workflow?.pendingBadges || []);
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);
  const gates = wakeUpBrief.workflow?.currentRun?.gates || {};

  // [condition, message-or-message-thunk]. Thunks defer string interpolation
  // until we know the condition is true, so we don't read undefined fields.
  const rules = [
    [
      pending.has("review_required"),
      "Independent review is still required before commit, PR, or final completion."
    ],
    [
      gates.review?.status === "failed",
      () => gateFailureMessage("Independent review failed", gates.review)
    ],
    [
      pending.has("validation_expected"),
      "Validation evidence is still expected for the current run."
    ],
    [
      gates.validation?.status === "failed",
      () => gateFailureMessage("Validation failed", gates.validation)
    ],
    [
      pending.has("dev_deploy_expected"),
      "Dev deployment evidence is still missing for the current run."
    ],
    [
      gates.deployment?.dev?.status === "failed",
      () => gateFailureMessage("Dev deployment checks failed", gates.deployment.dev)
    ],
    [
      pending.has("prod_deploy_expected"),
      "Production deployment evidence is still missing for the current run."
    ],
    [
      gates.deployment?.prod?.status === "failed",
      () => gateFailureMessage("Production deployment checks failed", gates.deployment.prod)
    ],
    [
      missingWrites.has("review_result_missing"),
      "Independent review appears complete, but the review artifact write-back is still missing."
    ],
    [
      missingWrites.has("validation_result_missing"),
      "Validation appears complete, but the validation-result artifact write-back is still missing."
    ],
    [
      missingWrites.has("dev_deployment_check_missing"),
      "Dev deployment evidence exists in workflow state, but the deployment-check artifact is still missing."
    ],
    [
      missingWrites.has("prod_deployment_check_missing"),
      "Production deployment evidence exists in workflow state, but the deployment-check artifact is still missing."
    ],
    [
      missingWrites.has("run_brief_missing"),
      "This run has meaningful progress, but the run-brief artifact is still missing."
    ],
    [
      missingWrites.has("final_synthesis_missing"),
      "Meaningful workflow phases completed, but the final synthesis artifact is still missing."
    ],
    [
      wakeUpBrief.openApprovals.length > 0,
      () => `${wakeUpBrief.openApprovals.length} open approval(s) still need a decision.`
    ],
    [!wakeUpBrief.hasClaudeMd, "This repo is not fully adopted into Crew yet."],
    [
      !wakeUpBrief.repoGuidance?.deployment &&
        deploymentClues.clues.length > 0 &&
        !wakeUpBrief.workflow?.hasActiveRun,
      "Deployment clues exist, but durable deployment guidance has not been recorded yet."
    ],
    [
      gitActivity.workingTree.behind > 0,
      () =>
        `Current branch is behind ${gitActivity.workingTree.upstream || "upstream"} by ${gitActivity.workingTree.behind} commit(s).`
    ]
  ];

  return rules.filter(([cond]) => cond).map(([, msg]) => (typeof msg === "function" ? msg() : msg));
}

export function buildImportantReminders(wakeUpBrief, deploymentClues, gitActivity) {
  const reminders = [];
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);

  if (gitActivity.isGitRepo && gitActivity.workingTree.hasChanges) {
    reminders.push(
      `Working tree has ${gitActivity.workingTree.stagedCount} staged, ${gitActivity.workingTree.modifiedCount} modified, and ${gitActivity.workingTree.untrackedCount} untracked path(s).`
    );
  }
  if (!wakeUpBrief.summary.hasRecentRunMemory) {
    reminders.push("No recent run artifacts are recorded for this repo yet.");
  }
  if (!wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0) {
    reminders.push(
      `Deployment clues were found in ${deploymentClues.clues.slice(0, 3).join(", ")}${deploymentClues.clues.length > 3 ? ", ..." : ""}.`
    );
  }
  if (wakeUpBrief.claims.length > 0) {
    reminders.push(
      `${wakeUpBrief.claims.length} active claim(s) are still present in repo-local state.`
    );
  }
  if (wakeUpBrief.repoMemory.length <= 1) {
    reminders.push(
      "Repo-specific memory is still thin; keep durable guidance and lessons learned up to date."
    );
  }
  if (missingWrites.size > 0) {
    reminders.push(
      "A workflow phase appears complete, but the matching artifact write-back is still missing."
    );
  }

  return reminders;
}

export function recommendedNextStep(wakeUpBrief, deploymentClues, gitActivity) {
  const pending = new Set(wakeUpBrief.workflow?.pendingBadges || []);
  const missingWrites = new Set(wakeUpBrief.workflow?.missingArtifactWrites || []);
  const currentRun = wakeUpBrief.workflow?.currentRun || null;
  const gates = currentRun?.gates || {};

  // Ordered priority rules. First matching condition wins. Messages that
  // need runtime data go through a thunk so they're only built on hit.
  const rules = [
    [
      !wakeUpBrief.hasClaudeMd,
      "Run /crew:adopt so the repo has the Crew harness, repo guidance, and local workflow state."
    ],
    [
      pending.has("review_required"),
      "Run independent review next before committing, opening a PR, or calling the work done."
    ],
    [
      gates.review?.status === "failed",
      "Address the failed review findings before moving the work forward."
    ],
    [
      pending.has("validation_expected"),
      "Run validation next and record the evidence before moving the work forward."
    ],
    [
      gates.validation?.status === "failed",
      "Investigate the failed validation evidence and fix the issue before continuing."
    ],
    [
      pending.has("dev_deploy_expected"),
      "Use /crew:ship to gather dev deployment evidence and verify the environment transition."
    ],
    [
      gates.deployment?.dev?.status === "failed",
      "Investigate the failed dev deployment checks before attempting another rollout."
    ],
    [
      pending.has("prod_deploy_expected"),
      "Decide whether production promotion is appropriate, then use /crew:ship to collect prod evidence."
    ],
    [
      gates.deployment?.prod?.status === "failed",
      "Investigate the failed production checks immediately before any further promotion work."
    ],
    [
      missingWrites.has("review_result_missing"),
      "Write the review-result artifact now so the run has an inspectable review gate record."
    ],
    [
      missingWrites.has("validation_result_missing"),
      "Write the validation-result artifact now so the run keeps the evidence it already collected."
    ],
    [
      missingWrites.has("dev_deployment_check_missing"),
      "Write the dev deployment-check artifact now so the environment evidence is recoverable next time."
    ],
    [
      missingWrites.has("prod_deployment_check_missing"),
      "Write the production deployment-check artifact now so the rollout evidence is preserved."
    ],
    [
      missingWrites.has("run_brief_missing"),
      "Write the run-brief artifact now so this workstream has a bounded starting point for recovery."
    ],
    [
      missingWrites.has("final_synthesis_missing"),
      "Write the final synthesis now so the completed work and next step are preserved before you move on."
    ],
    [
      wakeUpBrief.openApprovals.length > 0,
      "Resolve the open approval queue before pushing the workflow forward."
    ],
    [Boolean(currentRun?.next), () => currentRun.next],
    [
      !wakeUpBrief.repoGuidance?.deployment && deploymentClues.clues.length > 0,
      "Capture durable deployment guidance next so ship work can reuse repo-specific environment knowledge."
    ],
    [
      gitActivity.workingTree.behind > 0,
      () =>
        `Review or pull the ${gitActivity.workingTree.behind} upstream commit(s) before starting the next work chunk.`
    ],
    [
      gitActivity.workingTree.hasChanges,
      "Decide whether the current uncommitted changes belong in the active work chunk or should be reviewed and split."
    ]
  ];

  const hit = rules.find(([cond]) => cond);
  if (hit) {
    const [, msg] = hit;
    return typeof msg === "function" ? msg() : msg;
  }
  return "Start the next work chunk with /crew:build or /crew:fix, or just describe the task to the lead.";
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
