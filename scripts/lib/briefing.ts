// brief-me orchestrator. Coordinates data collection (./briefing/collect.ts)
// and rendering (./briefing/render.ts) and assembles the final report shape
// consumed by the CLI's `brief-me` subcommand.
//
// Pre-split this file was 821 lines mixing git probing, filesystem reads,
// markdown rendering, and orchestration. The split below keeps each concern
// in one place and leaves this module as a thin assembly point.

import fs from "node:fs/promises";
import path from "node:path";

import { discoverDeploymentClues } from "./deployment-guidance/read.ts";
import { buildWakeUpBrief } from "./wakeup.mjs";

import {
  collectGitActivity,
  collectRelevantArtifacts,
  collectRecentCosts,
  collectCostHealth,
  collectCostAggregate,
  collectModelCompliance,
  fetchAutonomousLoopBrief
} from "./briefing/collect.ts";
import type { HookHealth, ArtifactEntry, WakeUpBriefLike } from "./briefing/collect.ts";

const ROUTING_TABLE_STALE_DAYS = 30;

async function checkRoutingTableStale(repoPath: string) {
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

export function formatHookHealthSection(health: HookHealth): string {
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
 */
export function computeRunHealth(
  artifacts: Array<{ kind?: string; label?: string; findings?: unknown }>
): string | null {
  const relevant = artifacts.filter(
    (a) => a && typeof a.findings === "string" && (a.findings as string).length > 0
  );
  if (relevant.length === 0) {
    return null;
  }

  function parseFindings(findings: string): Array<{ key: string; count: number }> {
    return findings.split(",").map((part) => {
      const colonIdx = part.indexOf(":");
      if (colonIdx === -1) return { key: part.trim(), count: 0 };
      const key = part.slice(0, colonIdx).trim();
      const count = Number.parseInt(part.slice(colonIdx + 1).trim(), 10);
      return { key, count: Number.isFinite(count) ? count : 0 };
    });
  }

  const parts: string[] = [];
  for (const artifact of relevant) {
    const label = artifact.label ?? artifact.kind ?? "artifact";
    const parsed = parseFindings(artifact.findings as string);
    const nonZero = parsed.filter((p) => p.count > 0);
    if (nonZero.length === 0) continue;
    const tokens = nonZero.map((p) => `${p.count}${p.key}`).join(" ");
    parts.push(`${tokens} across ${label.toLowerCase()}`);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

function buildSummary(params: {
  gitActivity: { isGitRepo: boolean };
  wakeUpBrief: WakeUpBriefLike;
  artifacts: unknown[];
  deploymentClues: { clues?: unknown[] };
  costs: { dedupedCount: number; sumUsdRecent?: number; avgUsdRecent?: number };
  routingTable: { present: boolean; stale: boolean; ageDays: number | null };
  autonomousLoopBrief: unknown;
  runHealth: string | null;
}): Record<string, unknown> {
  const {
    gitActivity,
    wakeUpBrief,
    artifacts,
    deploymentClues,
    costs,
    routingTable,
    autonomousLoopBrief,
    runHealth
  } = params;
  const workflow = wakeUpBrief.workflow as
    | { hasActiveRun?: boolean; pendingBadges?: string[] }
    | undefined;
  return {
    isGitRepo: gitActivity.isGitRepo,
    hasActiveWorkflow: workflow?.hasActiveRun ?? false,
    pendingWorkflowBadges: workflow?.pendingBadges ?? [],
    hasRecentArtifacts: artifacts.length > 0,
    hasDeploymentGuidance: Boolean(
      (wakeUpBrief.repoGuidance as { deployment?: unknown } | undefined)?.deployment
    ),
    discoveredDeploymentClues: deploymentClues.clues?.length ?? 0,
    autonomousLoopInstalled: Boolean(autonomousLoopBrief),
    costReports: costs.dedupedCount,
    recentCostUsdSum: costs.sumUsdRecent ?? 0,
    recentCostUsdAvg: costs.avgUsdRecent ?? 0,
    routingTablePresent: routingTable.present,
    routingTableStale: routingTable.stale,
    routingTableAgeDays: routingTable.ageDays,
    runHealth
  };
}

export async function buildBriefingReport(repoPath: string): Promise<Record<string, unknown>> {
  const [
    wakeUpBriefRaw,
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

  // Cast the JS wakeUpBrief to satisfy the typed render functions.
  // buildWakeUpBrief is a JS module (checkJs:false); cast through unknown
  // to the WakeUpBrief shape expected by the render layer.
  type RenderWakeUpBrief = Parameters<typeof buildCurrentObjective>[0];
  const wakeUpBrief = wakeUpBriefRaw as unknown as RenderWakeUpBrief;

  // reuse hookHealth already collected inside buildWakeUpBrief — avoids double read
  const hookHealth: HookHealth = (wakeUpBrief.hookHealth as HookHealth | undefined) ?? {
    hooks: []
  };

  // Attach cost summary to loop block when the plugin is installed, so the
  // user-facing "Autonomous Loop" section in brief-me renders it alongside
  // backlog counts and grades. Also expose top-level for non-loop users.
  if (autonomousLoopBrief && costs.recent.length > 0) {
    (autonomousLoopBrief as Record<string, unknown>)["costs"] = costs;
  }

  const artifacts: ArtifactEntry[] = await collectRelevantArtifacts(wakeUpBrief as WakeUpBriefLike);
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
    repoPath: wakeUpBrief.repoPath as string,
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
    summary: buildSummary({
      gitActivity,
      wakeUpBrief: wakeUpBrief as WakeUpBriefLike,
      artifacts,
      deploymentClues: deploymentClues as { clues?: unknown[] },
      costs,
      routingTable,
      autonomousLoopBrief,
      runHealth
    }),
    autonomousLoop: autonomousLoopBrief,
    costs,
    routingTable
  };
}
