// Shared TypeScript types for artifacts module.
// Extracted from the JSDoc @typedef blocks in artifacts.mjs.

export interface ArtifactFields {
  title?: string | undefined;
  summary?: string | undefined;
  goal?: string | undefined;
  mode?: string | undefined;
  pace?: string | undefined;
  owner?: string | undefined;
  status?: string | undefined;
  scope?: string | undefined;
  outOfScope?: string | undefined;
  files?: string | undefined;
  next?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  deliverable?: string | undefined;
  confidence?: string | undefined;
  risks?: string | undefined;
  decision?: string | undefined;
  /**
   * Canonical enum verdict for review-result / validation-result (P1.3).
   * `decision` stays the raw legacy value (back-compat body prose); `verdict`
   * is the normalized enum written to frontmatter and consumed by
   * workflow-state's ARTIFACT_HANDLERS gate mapping. Absent = legacy artifact.
   */
  verdict?: string | undefined;
  /** Required (enforced by ValidationArtifactSchema) when `verdict` is "skipped". */
  skipReason?: string | undefined;
  evidence?: string | undefined;
  testSummary?: string | undefined;
  testSummarySkipReason?: string | undefined;
  validationEvidence?: string | undefined;
  nonCode?: boolean;
  reviewer?: string | undefined;
  environment?: string | undefined;
  validator?: string | undefined;
  deployer?: string | undefined;
  resource?: string | undefined;
  url?: string | undefined;
  revision?: string | undefined;
  runSteps?: string | undefined;
  externalDeltas?: string | undefined;
  repoContext?: boolean;
  feature?: string | undefined;
  slice?: string | undefined;
  phase?: string | number | undefined;
  cost?: CostBreakdown;
  outcome?: CostOutcome | null;
  notes?: string | undefined;
  runTitle?: string | undefined;
  force?: boolean;
  findings?: string | null;
  _reportVariant?: "slice" | "aggregate" | null;
  updatePath?: string | undefined;
  scaffold?: boolean;
  tier?: "full" | "light";
  /** Pre-aggregated dispatch + bash-gate telemetry for the Per-dispatch breakdown section (FEAT-151). */
  dispatchBreakdown?: DispatchBreakdown | undefined;
  /** Per-agent rolling stats for the `## Agent stats (rolling)` cost-report section (FEAT-159 SLICE-B). */
  agentStats?: import("../agent-stats-aggregator.ts").AgentStatsRow[] | undefined;
  /** What the reviewer deliberately did NOT cover (dev-team#247). Absent/empty = legacy artifact. */
  notChecked?: string[] | undefined;
  /** Reviewer/author identity for self-approval detection (dev-team#247). */
  authorId?: string | undefined;
  judgeId?: string | undefined;
  /** Derived: `authorId != null && authorId === judgeId`. Not settable via CLI flag. */
  selfApproval?: boolean | undefined;
  /**
   * OPTIONAL dispatch-memory-credit-loop field (runner-plugin upstream
   * request 2026-07-16): atom ids a specialist self-reported it relied on in
   * this handoff. Never validated, never gated — absent/empty credits
   * nothing. See docs/contracts/dispatch-memory-credit-loop-v1.md.
   */
  memoriesUsed?: string[] | undefined;
}

/** Aggregated telemetry for the ## Per-dispatch breakdown cost-report section (FEAT-151). */
export interface DispatchBreakdown {
  dispatch: import("../dispatch-timing-reader.ts").DispatchAggregate;
  gates: import("../dispatch-timing-reader.ts").BashGateAggregate;
}

export interface CostBreakdown {
  window?: { durationMs?: number; start?: string; end?: string };
  usd?: number;
  totals?: Record<string, number>;
  byModel?: Record<
    string,
    {
      messages: number;
      usd: number;
      tokens: Record<string, number>;
      pricedAs?: string;
    }
  >;
  modelMix?: Array<{
    model: string;
    pricedAs: string;
    messages: number;
    msgPct: number;
    usd: number;
    usdPct: number;
  }>;
  conversation?: {
    userMsgCount?: number;
    userMsgAvgLen?: number;
    turnsBeforeFirstTool?: number;
    compactionCount?: number;
    skillInvocations?: number;
    subagentDispatches?: number;
    subagentDispatchesByRole?: Record<string, number>;
  };
  toolUsage?: Array<{ name: string; count: number; failures: number }>;
  toolResultSizes?: {
    count: number;
    sumBytes: number;
    p50Bytes: number;
    p90Bytes: number;
    maxBytes: number;
  };
  fileReReadCount?: number;
  fileReReadTopPaths?: Array<{ reads: number; path: string }>;
  toolCachePrime?: Array<{
    name: string;
    calls: number;
    totalResultBytes: number;
    attributedCacheCreate: number;
    ratio?: number;
  }>;
  sourceProject?: string;
  autoDetected?: boolean;
  aggregateAll?: boolean;
  sources?: Array<{ slug: string; messages: number; usd: number }>;
  sessionsScanned?: number;
  messagesCounted?: number;
}

export interface CostOutcome {
  sliceId?: string;
  gradeAvg?: number;
  reviewDecision?: string;
  validationDecision?: string;
  scores?: Record<string, unknown>;
}
