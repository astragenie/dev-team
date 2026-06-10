// Data-collection layer for brief-me. Pure I/O — no rendering, no markdown.
//
// Returns shapes that briefing.ts orchestrator hands to ./render.ts.
// Refactored from monolithic 792-line file into focused modules (git, cost,
// workflow, hook, bundle). This file is a pure re-export barrel; all logic
// has moved to the modules below. Clients import from this barrel unchanged.

export {
  collectGitActivity,
  type GitActivity,
  type WorkingTreeStatus,
  type CommitEntry
} from "./git.ts";
export {
  collectRecentCosts,
  collectCostHealth,
  collectCostAggregate,
  computeModelCompliance,
  collectModelCompliance,
  type CostHealthResult,
  type ModelCompliance
} from "./cost.ts";
export {
  collectRelevantArtifacts,
  fetchAutonomousLoopBrief,
  findAutonomousLoopCli,
  type ArtifactEntry,
  type ArtifactSummary,
  type WakeUpBriefLike
} from "./workflow.ts";
export { collectHookHealth, type HookStatus, type HookHealth } from "./hook.ts";
export { collectBundleStats, type BundleStats } from "./bundle.ts";
