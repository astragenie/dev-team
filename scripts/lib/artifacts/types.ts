// Shared TypeScript types for artifacts module.
// Extracted from the JSDoc @typedef blocks in artifacts.mjs.

export interface ArtifactFields {
  title?: string;
  summary?: string;
  goal?: string;
  mode?: string;
  pace?: string;
  owner?: string;
  status?: string;
  scope?: string;
  outOfScope?: string;
  files?: string;
  next?: string;
  from?: string;
  to?: string;
  deliverable?: string;
  confidence?: string;
  risks?: string;
  decision?: string;
  evidence?: string;
  testSummary?: string;
  testSummarySkipReason?: string;
  validationEvidence?: string;
  nonCode?: boolean;
  reviewer?: string;
  environment?: string;
  validator?: string;
  deployer?: string;
  resource?: string;
  url?: string;
  revision?: string;
  runSteps?: string;
  externalDeltas?: string;
  repoContext?: boolean;
  feature?: string;
  slice?: string;
  phase?: string | number;
  cost?: CostBreakdown;
  outcome?: CostOutcome | null;
  notes?: string;
  runTitle?: string;
  force?: boolean;
  findings?: string | null;
  _reportVariant?: "slice" | "aggregate" | null;
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
