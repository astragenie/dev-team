// brief-me orchestrator. Coordinates data collection (./briefing/collect.mjs)
// and rendering (./briefing/render.mjs) and assembles the final report shape
// consumed by the CLI's `brief-me` subcommand.
//
// Pre-split this file was 821 lines mixing git probing, filesystem reads,
// markdown rendering, and orchestration. The split below keeps each concern
// in one place and leaves this module as a thin assembly point.

import fs from "node:fs/promises";
import path from "node:path";

import { discoverDeploymentClues } from "./deployment-guidance.mjs";
import { buildWakeUpBrief } from "./wakeup.mjs";

import {
  collectGitActivity,
  collectRelevantArtifacts,
  collectRecentCosts,
  collectCostHealth,
  collectCostAggregate,
  collectModelCompliance,
  fetchAutonomousLoopBrief
} from "./briefing/collect.mjs";

const ROUTING_TABLE_STALE_DAYS = 30;

/** @param {string} repoPath */
async function checkRoutingTableStale(repoPath) {
  const candidate = path.join(repoPath, "docs", "routing-table.md");
  try {
    const stat = await fs.stat(candidate);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    return {
      present: true,
      stale: ageDays > ROUTING_TABLE_STALE_DAYS,
      ageDays
    };
  } catch {
    return { present: false, stale: false, ageDays: null };
  }
}
import {
  buildBlockedOrMissing,
  buildCurrentObjective,
  buildImportantReminders,
  buildRetrievalGuide,
  buildSecondaryOptions,
  recommendedNextStep
} from "./briefing/render.ts";

/**
 * @param {{ hooks: Array<{name: string, errorCount24h: number, status: string}> }} health
 * @returns {string}
 */
export function formatHookHealthSection(health) {
  const yellow = (health.hooks ?? []).filter((h) => h.status === "yellow");
  if (yellow.length === 0) {
    return "## Hook health\n\nAll hooks clean (0 errors in last 24h).\n";
  }
  const lines = yellow.map((h) => `- **${h.name}**: ${h.errorCount24h} error(s) in last 24h`);
  return `## Hook health\n\n${lines.join("\n")}\n`;
}

/**
 * Aggregate findings from recent artifacts into a human-readable runHealth string.
 * Scans artifacts with non-null `findings` fields; tallies the emoji signals
 * (🔴/🟡/❓ for reviewer, pass/partial/fail for validator, healthy/degraded/down
 * for deployer) and produces a compact summary string like "2🔴 1🟡 across reviewer".
 * Returns null when no artifacts carry findings.
 *
 * @param {Array<{kind?: string, label?: string, findings?: string | null}>} artifacts
 * @returns {string | null}
 */
export function computeRunHealth(artifacts) {
  const relevant = artifacts.filter(
    (a) => a && typeof a.findings === "string" && a.findings.length > 0
  );
  if (relevant.length === 0) {
    return null;
  }

  /**
   * @param {string} findings
   * @returns {Array<{key: string, count: number}>}
   */
  function parseFindings(findings) {
    return findings.split(",").map((part) => {
      const colonIdx = part.indexOf(":");
      if (colonIdx === -1) return { key: part.trim(), count: 0 };
      const key = part.slice(0, colonIdx).trim();
      const count = Number.parseInt(part.slice(colonIdx + 1).trim(), 10);
      return { key, count: Number.isFinite(count) ? count : 0 };
    });
  }

  /** @type {string[]} */
  const parts = [];
  for (const artifact of relevant) {
    const label = artifact.label || artifact.kind || "artifact";
    const parsed = parseFindings(/** @type {string} */ (artifact.findings));
    const nonZero = parsed.filter((p) => p.count > 0);
    if (nonZero.length === 0) continue;
    const tokens = nonZero.map((p) => `${p.count}${p.key}`).join(" ");
    parts.push(`${tokens} across ${label.toLowerCase()}`);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

/** @param {string} repoPath */
export async function buildBriefingReport(repoPath) {
  const [
    wakeUpBrief,
    gitActivity,
    deploymentClues,
    autonomousLoopBrief,
    costs,
    routingTable,
    costHealth,
    costAggregate,
    modelCompliance
  ] = await Promise.all([
    buildWakeUpBrief(repoPath, { readOnly: true }),
    collectGitActivity(repoPath),
    discoverDeploymentClues(repoPath),
    fetchAutonomousLoopBrief(repoPath),
    collectRecentCosts(repoPath, 5),
    checkRoutingTableStale(repoPath),
    collectCostHealth(repoPath),
    collectCostAggregate(repoPath),
    collectModelCompliance(repoPath)
  ]);
  // reuse hookHealth already collected inside buildWakeUpBrief — avoids double read
  const hookHealth = wakeUpBrief.hookHealth ?? { hooks: [] };

  // Attach cost summary to loop block when the plugin is installed, so the
  // user-facing "Autonomous Loop" section in brief-me renders it alongside
  // backlog counts and grades. Also expose top-level for non-loop users.
  if (autonomousLoopBrief && costs.recent.length > 0) {
    autonomousLoopBrief.costs = costs;
  }

  const artifacts = await collectRelevantArtifacts(wakeUpBrief);
  const runHealth = computeRunHealth(artifacts);
  const currentObjective = buildCurrentObjective(wakeUpBrief, artifacts);
  const blockedOrMissing = buildBlockedOrMissing(wakeUpBrief, deploymentClues, gitActivity);
  const reminders = buildImportantReminders(
    wakeUpBrief,
    deploymentClues,
    gitActivity,
    routingTable
  );
  const nextStep = recommendedNextStep(wakeUpBrief, deploymentClues, gitActivity);
  const secondaryOptions = buildSecondaryOptions(wakeUpBrief, deploymentClues, gitActivity);
  const retrievalGuide = buildRetrievalGuide(wakeUpBrief, artifacts);

  return {
    repoPath: wakeUpBrief.repoPath,
    wakeUp: wakeUpBrief,
    git: gitActivity,
    costHealth,
    costAggregate,
    modelCompliance,
    hookHealth,
    runHealth,
    sections: {
      hookHealth: formatHookHealthSection(hookHealth),
      currentObjective,
      recentActivity: {
        latestArtifacts: artifacts,
        repoMemory: wakeUpBrief.repoMemory,
        retrievalGuide,
        git: gitActivity
      },
      inProgress: {
        workflow: wakeUpBrief.workflow,
        activeClaims: wakeUpBrief.claims,
        openApprovals: wakeUpBrief.openApprovals
      },
      blockedOrMissing,
      importantReminders: reminders,
      recommendedNextStep: nextStep,
      secondaryOptions
    },
    summary: {
      isGitRepo: gitActivity.isGitRepo,
      hasActiveWorkflow: wakeUpBrief.workflow.hasActiveRun,
      pendingWorkflowBadges: wakeUpBrief.workflow.pendingBadges,
      hasRecentArtifacts: artifacts.length > 0,
      hasDeploymentGuidance: Boolean(wakeUpBrief.repoGuidance?.deployment),
      discoveredDeploymentClues: deploymentClues.clues.length,
      autonomousLoopInstalled: Boolean(autonomousLoopBrief),
      costReports: costs.dedupedCount,
      recentCostUsdSum: costs.sumUsdRecent || 0,
      recentCostUsdAvg: costs.avgUsdRecent || 0,
      routingTablePresent: routingTable.present,
      routingTableStale: routingTable.stale,
      routingTableAgeDays: routingTable.ageDays,
      runHealth
    },
    autonomousLoop: autonomousLoopBrief,
    costs,
    routingTable
  };
}
