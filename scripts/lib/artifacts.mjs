import fs from "node:fs/promises";
import path from "node:path";
import { registerWorkflowArtifact } from "./workflow-state.mjs";

const ARTIFACT_ROOT = [".claude", "artifacts", "crew"];

function nowIso() {
  return new Date().toISOString();
}

function timestampSlug() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * @typedef {{
 *   title?: string, summary?: string, goal?: string, mode?: string, pace?: string,
 *   owner?: string, status?: string, scope?: string, outOfScope?: string, files?: string,
 *   next?: string, from?: string, to?: string, deliverable?: string, confidence?: string,
 *   risks?: string, decision?: string, evidence?: string, testSummary?: string,
 *   testSummarySkipReason?: string, validationEvidence?: string, nonCode?: boolean, reviewer?: string,
 *   environment?: string, validator?: string, deployer?: string, resource?: string,
 *   url?: string, revision?: string, runSteps?: string, externalDeltas?: string, repoContext?: boolean,
 *   feature?: string, slice?: string, phase?: string | number,
 *   cost?: CostBreakdown, outcome?: CostOutcome | null, notes?: string, runTitle?: string,
 *   force?: boolean,
 *   _reportVariant?: "slice" | "aggregate" | null
 * }} ArtifactFields
 *
 * @typedef {{
 *   window?: {durationMs?: number, start?: string, end?: string},
 *   usd?: number, totals?: Record<string, number>,
 *   byModel?: Record<string, {messages: number, usd: number, tokens: Record<string, number>, pricedAs?: string}>,
 *   modelMix?: Array<{model: string, pricedAs: string, messages: number, msgPct: number, usd: number, usdPct: number}>,
 *   conversation?: {userMsgCount?: number, userMsgAvgLen?: number, turnsBeforeFirstTool?: number, compactionCount?: number, skillInvocations?: number, subagentDispatches?: number, subagentDispatchesByRole?: Record<string, number>},
 *   toolUsage?: Array<{name: string, count: number, failures: number}>,
 *   toolResultSizes?: {count: number, sumBytes: number, p50Bytes: number, p90Bytes: number, maxBytes: number},
 *   fileReReadCount?: number, fileReReadTopPaths?: Array<{reads: number, path: string}>,
 *   toolCachePrime?: Array<{name: string, calls: number, totalResultBytes: number, attributedCacheCreate: number, ratio?: number}>,
 *   sourceProject?: string, autoDetected?: boolean, aggregateAll?: boolean,
 *   sources?: Array<{slug: string, messages: number, usd: number}>,
 *   sessionsScanned?: number, messagesCounted?: number
 * }} CostBreakdown
 *
 * @typedef {{
 *   sliceId?: string, gradeAvg?: number, reviewDecision?: string,
 *   validationDecision?: string, scores?: Record<string, unknown>
 * }} CostOutcome
 */

// Emit an optional YAML frontmatter block when feature / phase is set.
// Returns an empty string when neither is present so existing artifacts
// stay byte-for-byte identical to the pre-frontmatter shape. Consumed by
// SIMPLE_RENDERERS via writeArtifact; cost-report folds these keys into
// its own frontmatter inline (see renderCostReportFrontmatter).
/** @param {ArtifactFields} fields */
function renderOptionalFrontmatter(fields) {
  const lines = [];
  if (fields.phase !== null && fields.phase !== undefined && String(fields.phase).length > 0) {
    lines.push(`phase: ${JSON.stringify(String(fields.phase))}`);
  }
  if (fields.feature) {
    lines.push(`feature: ${fields.feature}`);
  }
  if (fields.slice) {
    lines.push(`slice: ${fields.slice}`);
  }
  if (fields.validationEvidence) {
    lines.push(`validation_evidence: ${JSON.stringify(fields.validationEvidence)}`);
  }
  if (lines.length === 0) {
    return "";
  }
  return ["---", ...lines, "---", ""].join("\n");
}

/** @param {string | undefined | null} value */
function slugify(value) {
  return (
    (value || "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact"
  );
}

/** @param {unknown} value */
function toList(value) {
  if (!value || typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((/** @type {string} */ item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {string} label
 * @param {unknown} value
 */
function renderField(label, value) {
  return `- ${label}: ${value || "-"}`;
}

/**
 * @param {string} label
 * @param {unknown} value
 */
function renderListField(label, value) {
  const items = toList(value);
  if (items.length === 0) {
    return `- ${label}: -`;
  }
  return [`- ${label}:`, ...items.map((item) => `  - ${item}`)].join("\n");
}

// Renderers for simple list-of-fields artifacts. Each entry maps a kind to
// the output directory, filename prefix, and a pure `(fields) => string`
// renderer. The complex cost-report renderer is a separate named function
// below and is wired in by resolveArtifactConfig.
/** @type {Record<string, {directory: string, prefix: string, render: (f: ArtifactFields) => string}>} */
const SIMPLE_RENDERERS = {
  "run-brief": {
    directory: "runs",
    prefix: "run-brief",
    render: (f) =>
      [
        `# Run Brief: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Goal", f.goal),
        renderField("Mode", f.mode),
        renderField("Pace", f.pace),
        renderField("Owner", f.owner),
        renderField("Status", f.status || "active"),
        renderField("Summary", f.summary),
        renderListField("Scope", f.scope),
        renderListField("Out Of Scope", f.outOfScope),
        renderListField("Planned Files", f.files),
        renderField("Next Step", f.next),
        ""
      ].join("\n")
  },
  handoff: {
    directory: "handoffs",
    prefix: "handoff",
    render: (f) =>
      [
        `# Task Handoff: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("From", f.from),
        renderField("To", f.to),
        renderField("Objective", f.goal || f.summary),
        renderListField("Allowed Scope", f.scope),
        renderListField("Forbidden Scope", f.outOfScope),
        renderField("Deliverable", f.deliverable),
        renderListField("Changed Files", f.files),
        renderField("Confidence", f.confidence),
        renderField("Risks", f.risks),
        renderField("Suggested Next Handoff", f.next),
        ""
      ].join("\n")
  },
  "review-result": {
    directory: "reviews",
    prefix: "review-result",
    render: (f) => {
      const lines = [
        `# Review Result: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Reviewer", f.reviewer || f.owner),
        renderField("Decision", f.decision || "approved_with_notes"),
        renderField("Summary", f.summary),
        renderListField("Evidence Checked", f.evidence),
        renderListField("Files Reviewed", f.files),
        renderField("Test Adequacy", f.testSummary)
      ];
      if (f.testSummarySkipReason) {
        lines.push(renderField("Test Adequacy Skip Reason", f.testSummarySkipReason));
      }
      if (f.nonCode) {
        lines.push(renderField("Non-Code Review", "yes"));
      }
      if (f.validationEvidence) {
        lines.push("");
        lines.push("## Validation Evidence");
        lines.push("");
        lines.push(f.validationEvidence);
      }
      lines.push(renderField("Risks", f.risks));
      lines.push(renderField("Required Follow-up", f.next));
      lines.push("");
      return lines.join("\n");
    }
  },
  "validation-plan": {
    directory: "validations",
    prefix: "validation-plan",
    render: (f) =>
      [
        `# Validation Plan: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Owner", f.owner || f.validator),
        renderField("Environment", f.environment),
        renderField("Goal", f.goal || f.summary),
        renderListField("Scope", f.scope),
        renderListField("Out Of Scope", f.outOfScope),
        renderListField("Evidence To Collect", f.evidence),
        renderField("Next Step", f.next),
        ""
      ].join("\n")
  },
  "validation-result": {
    directory: "validations",
    prefix: "validation-result",
    render: (f) =>
      [
        `# Validation Result: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Validator", f.validator || f.owner || "validator"),
        renderField("Environment", f.environment),
        renderField("Decision", f.decision || "passed_with_notes"),
        renderField("Scenario", f.goal || f.summary),
        renderListField("Evidence Collected", f.evidence),
        renderListField("Files / Surfaces Checked", f.files),
        renderField("Risks", f.risks),
        renderField("Required Follow-up", f.next),
        ""
      ].join("\n")
  },
  "deployment-check": {
    directory: "deployments",
    prefix: "deployment-check",
    render: (f) =>
      [
        `# Deployment Check: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Deployer", f.deployer || f.owner || "deployer"),
        renderField("Environment", f.environment),
        renderField("Resource", f.resource),
        renderField("Service URL", f.url),
        renderField("Revision", f.revision),
        renderField("Decision", f.decision || "passed_with_notes"),
        renderField("Action", f.goal || f.summary),
        renderListField("Evidence Collected", f.evidence),
        renderListField("Files / Surfaces Checked", f.files),
        renderField("Risks", f.risks),
        renderField("Required Follow-up", f.next),
        ""
      ].join("\n")
  },
  "final-synthesis": {
    directory: "runs",
    prefix: "final-synthesis",
    render: (f) =>
      [
        `# Final Synthesis: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Owner", f.owner),
        renderField("Outcome", f.status || "completed"),
        renderField("Summary", f.summary),
        renderListField("Changed Files / Evidence", f.files || f.evidence),
        renderListField("Run / Test Steps", f.runSteps),
        renderField("External Deltas", f.externalDeltas),
        renderField("Risks", f.risks),
        renderField("Next Step", f.next),
        ""
      ].join("\n")
  }
};

// --- cost-report: complex, multi-section renderer split into helpers ---

/**
 * @param {ArtifactFields} fields
 * @param {CostBreakdown | undefined} breakdown
 * @param {CostOutcome | null} outcome
 * @param {number} totalTokens
 * @param {number | string} cacheHitPct
 * @param {"slice" | "aggregate" | null} [variant] - when "slice", forces aggregate_all:false +
 *   source_count:1; when "aggregate", uses breakdown values (same as legacy); null = legacy.
 */
// eslint-disable-next-line complexity -- FEAT-034 variant frontmatter rendering covers slice/aggregate/legacy paths
function renderCostReportFrontmatter(
  fields,
  breakdown,
  outcome,
  totalTokens,
  cacheHitPct,
  variant = null
) {
  const durationMs = breakdown?.window?.durationMs || 0;
  // [predicate, line]. Truthy predicate emits the line. Defers evaluation of
  // the line string until we know it's emitted; keeps complexity flat instead
  // of nesting if-pushes.
  const phaseStr = fields.phase != null ? String(fields.phase) : "";

  // Per-variant aggregate_all + source_count logic:
  // - "slice":     always emit aggregate_all: false, source_count: 1
  // - "aggregate": emit aggregate_all: true when breakdown.aggregateAll, source_count from sources
  // - null/legacy: existing behaviour (aggregate_all: true only when truthy, source_count from sources)
  const isSlice = variant === "slice";
  const aggregateAllPredicate = isSlice ? true : Boolean(breakdown?.aggregateAll);
  const aggregateAllLine = isSlice ? "aggregate_all: false" : "aggregate_all: true";
  const sourceCountPredicate = isSlice ? true : Boolean(breakdown?.sources?.length);
  const sourceCountLine = isSlice
    ? "source_count: 1"
    : `source_count: ${breakdown?.sources?.length ?? 0}`;

  const optional = /** @type {Array<[unknown, function(): string]>} */ ([
    [phaseStr.length > 0, () => `phase: ${JSON.stringify(phaseStr)}`],
    [fields.feature, () => `feature: ${fields.feature}`],
    [outcome?.sliceId, () => `slice: ${outcome.sliceId}`],
    [true, () => `run_title: ${JSON.stringify(fields.runTitle || "")}`],
    [breakdown?.usd != null, () => `usd: ${breakdown.usd}`],
    [durationMs, () => `duration_ms: ${durationMs}`],
    [totalTokens, () => `total_tokens: ${totalTokens}`],
    [cacheHitPct !== "-", () => `cache_hit_pct: ${cacheHitPct}`],
    [outcome?.gradeAvg != null, () => `grade_avg: ${outcome.gradeAvg}`],
    [outcome?.reviewDecision, () => `review_decision: ${outcome.reviewDecision}`],
    [outcome?.validationDecision, () => `validation_decision: ${outcome.validationDecision}`],
    [breakdown?.sourceProject, () => `source_project: ${breakdown.sourceProject}`],
    [breakdown?.autoDetected, () => `auto_detected: true`],
    [aggregateAllPredicate, () => aggregateAllLine],
    [sourceCountPredicate, () => sourceCountLine]
  ]);
  return [
    "---",
    "kind: cost-report",
    ...optional.filter(([cond]) => cond).map(([, build]) => build()),
    `created_at: ${nowIso()}`,
    "---"
  ];
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportSources(breakdown) {
  if (!breakdown?.sources?.length || breakdown.sources.length < 2) return [];
  const lines = ["## Sources (aggregated)", ""];
  for (const src of breakdown.sources) {
    lines.push(`- ${src.slug}: ${src.messages} msgs, $${src.usd.toFixed(4)}`);
  }
  lines.push("");
  return lines;
}

/** @param {number} durationMs */
function formatDuration(durationMs) {
  if (!durationMs) return "-";
  return `${(durationMs / 60000).toFixed(1)} min (${durationMs} ms)`;
}

/** @param {number} totalTokens */
function formatTokens(totalTokens) {
  return totalTokens ? totalTokens.toLocaleString() : "-";
}

/** @param {number | string} cacheHitPct */
function formatCacheHit(cacheHitPct) {
  return cacheHitPct !== "-" ? `${cacheHitPct}%` : "-";
}

/** @param {CostBreakdown | undefined | null} breakdown */
function formatUsd(breakdown) {
  return breakdown ? `$${breakdown.usd.toFixed(4)}` : "-";
}

/** @param {unknown} value */
function formatBool(value) {
  return value ? "yes" : "no";
}

/** @param {number | null | undefined} value */
function formatCount(value) {
  return String(value ?? 0);
}

/**
 * @param {ArtifactFields} fields
 * @param {CostBreakdown | undefined} breakdown
 * @param {number} totalTokens
 * @param {number | string} cacheHitPct
 */
function renderCostReportHeader(fields, breakdown, totalTokens, cacheHitPct) {
  const window = breakdown?.window || {};
  return [
    `# Cost Report: ${fields.title || "Untitled"}`,
    "",
    renderField("Created", nowIso()),
    renderField("Run Title", fields.runTitle),
    renderField("Window Start", window.start),
    renderField("Window End", window.end),
    renderField("Duration", formatDuration(window.durationMs || 0)),
    renderField("Sessions Scanned", formatCount(breakdown?.sessionsScanned)),
    renderField("Assistant Messages Counted", formatCount(breakdown?.messagesCounted)),
    renderField("Total Tokens", formatTokens(totalTokens)),
    renderField("Cache Hit %", formatCacheHit(cacheHitPct)),
    renderField("Total USD", formatUsd(breakdown)),
    renderField("Source Project", breakdown?.sourceProject),
    renderField("Auto-detected", formatBool(breakdown?.autoDetected)),
    renderField("Aggregate All", formatBool(breakdown?.aggregateAll)),
    ""
  ];
}

/** @param {CostOutcome | null | undefined} outcome */
function renderCostReportOutcome(outcome) {
  if (!outcome?.sliceId) return [];
  const lines = ["## Outcome Linkage", ""];
  lines.push(renderField("Slice", outcome.sliceId));
  lines.push(renderField("Grade Avg", outcome.gradeAvg != null ? String(outcome.gradeAvg) : "-"));
  lines.push(renderField("Review Decision", outcome.reviewDecision || "-"));
  lines.push(renderField("Validation Decision", outcome.validationDecision || "-"));
  if (outcome.scores) {
    lines.push("- Scores:");
    for (const [k, v] of Object.entries(outcome.scores)) {
      lines.push(`  - ${k}: ${v}`);
    }
  }
  lines.push("");
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportTokens(breakdown) {
  const lines = ["## Tokens (totals)", ""];
  if (breakdown?.totals) {
    for (const [k, v] of Object.entries(breakdown.totals)) {
      lines.push(`- ${k}: ${v.toLocaleString()}`);
    }
  } else {
    lines.push("- (none)");
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportModelMix(breakdown) {
  const lines = ["", "## Model Mix", ""];
  if (breakdown?.modelMix?.length) {
    for (const m of breakdown.modelMix) {
      lines.push(
        `- ${m.model} (priced as ${m.pricedAs}): ${m.messages} msgs (${m.msgPct}%), $${m.usd.toFixed(4)} (${m.usdPct}%)`
      );
    }
  } else {
    lines.push("- (none)");
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportConversation(breakdown) {
  const conv = breakdown?.conversation || {};
  const lines = [
    "",
    "## Conversation Shape",
    "",
    `- user_msg_count: ${conv.userMsgCount ?? 0}`,
    `- user_msg_avg_len: ${conv.userMsgAvgLen ?? 0}`,
    `- turns_before_first_tool: ${conv.turnsBeforeFirstTool ?? 0}`,
    `- compaction_count: ${conv.compactionCount ?? 0}`,
    `- skill_invocations: ${conv.skillInvocations ?? 0}`,
    `- subagent_dispatches: ${conv.subagentDispatches ?? 0}`
  ];
  if (conv.subagentDispatchesByRole && Object.keys(conv.subagentDispatchesByRole).length > 0) {
    lines.push("- subagent_dispatches_by_role:");
    const sorted = Object.entries(conv.subagentDispatchesByRole).sort((a, b) => b[1] - a[1]);
    for (const [role, count] of sorted) {
      lines.push(`  - ${role}: ${count}`);
    }
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportToolUsage(breakdown) {
  const lines = ["", "## Tool Usage", ""];
  if (breakdown?.toolUsage?.length) {
    for (const t of breakdown.toolUsage) {
      const failStr = t.failures > 0 ? ` (${t.failures} failed)` : "";
      lines.push(`- ${t.name}: ${t.count}${failStr}`);
    }
  } else {
    lines.push("- (none)");
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportToolResultSizes(breakdown) {
  const lines = ["", "## Tool Result Sizes (bytes)", ""];
  const trs = breakdown?.toolResultSizes;
  if (trs && trs.count > 0) {
    lines.push(`- count: ${trs.count}`);
    lines.push(`- sum: ${trs.sumBytes.toLocaleString()}`);
    lines.push(`- p50: ${trs.p50Bytes.toLocaleString()}`);
    lines.push(`- p90: ${trs.p90Bytes.toLocaleString()}`);
    lines.push(`- max: ${trs.maxBytes.toLocaleString()}`);
  } else {
    lines.push("- (none)");
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportFileReReads(breakdown) {
  const lines = ["", "## File Re-reads", ""];
  lines.push(`- redundant_read_count: ${breakdown?.fileReReadCount ?? 0}`);
  if (breakdown?.fileReReadTopPaths?.length) {
    lines.push("- top paths:");
    for (const p of breakdown.fileReReadTopPaths) {
      lines.push(`  - ${p.reads}× ${p.path}`);
    }
  }
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportCachePriming(breakdown) {
  if (!breakdown?.toolCachePrime?.length) return [];
  const lines = ["", "## Cache Priming (per tool, approximate)", ""];
  lines.push(
    "Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios."
  );
  lines.push("");
  for (const t of breakdown.toolCachePrime) {
    const ratio = t.ratio != null ? `${t.ratio}×` : "—";
    lines.push(
      `- ${t.name}: ${t.calls} calls, ${t.totalResultBytes.toLocaleString()}B results, ~${t.attributedCacheCreate.toLocaleString()} cache_create tok (${ratio})`
    );
  }
  lines.push("");
  return lines;
}

/** @param {CostBreakdown | undefined} breakdown */
function renderCostReportByModel(breakdown) {
  const lines = ["", "## By Model (token detail)", ""];
  if (breakdown?.byModel && Object.keys(breakdown.byModel).length) {
    for (const [model, info] of Object.entries(breakdown.byModel)) {
      lines.push(`### ${model} (priced as ${info.pricedAs})`);
      lines.push(`- messages: ${info.messages}`);
      lines.push(`- usd: $${info.usd.toFixed(4)}`);
      for (const [k, v] of Object.entries(info.tokens)) {
        lines.push(`- ${k}: ${v.toLocaleString()}`);
      }
      lines.push("");
    }
  }
  return lines;
}

/**
 * Shared body renderer used by all three cost-report kinds (legacy, slice, aggregate).
 * The `variant` parameter controls frontmatter field overrides.
 * @param {ArtifactFields} fields
 * @param {"slice" | "aggregate" | null} variant
 */
function renderCostReportBody(fields, variant) {
  const breakdown = fields.cost;
  const outcome = fields.outcome || null;
  const totalTokens = breakdown?.totals
    ? Object.values(breakdown.totals).reduce((a, b) => a + b, 0)
    : 0;
  const promptTokens = breakdown?.totals
    ? breakdown.totals.input +
      breakdown.totals.cache_create_5m +
      breakdown.totals.cache_create_1h +
      breakdown.totals.cache_read
    : 0;
  const cacheHitPct =
    promptTokens > 0 ? ((breakdown.totals.cache_read / promptTokens) * 100).toFixed(1) : "-";

  return [
    ...renderCostReportFrontmatter(fields, breakdown, outcome, totalTokens, cacheHitPct, variant),
    "",
    ...renderCostReportHeader(fields, breakdown, totalTokens, cacheHitPct),
    ...renderCostReportSources(breakdown),
    ...renderCostReportOutcome(outcome),
    ...renderCostReportTokens(breakdown),
    ...renderCostReportModelMix(breakdown),
    ...renderCostReportConversation(breakdown),
    ...renderCostReportToolUsage(breakdown),
    ...renderCostReportToolResultSizes(breakdown),
    ...renderCostReportFileReReads(breakdown),
    ...renderCostReportCachePriming(breakdown),
    ...renderCostReportByModel(breakdown),
    ...(fields.notes ? ["## Notes", "", fields.notes, ""] : [])
  ].join("\n");
}

/** @param {ArtifactFields} fields */
function renderCostReport(fields) {
  return renderCostReportBody(fields, null);
}

/** @param {ArtifactFields} fields */
function renderCostReportSlice(fields) {
  return renderCostReportBody(fields, "slice");
}

/** @param {ArtifactFields} fields */
function renderCostReportAggregate(fields) {
  return renderCostReportBody(fields, "aggregate");
}

/** @param {string} kind */
function resolveArtifactConfig(kind) {
  if (kind === "cost-report") {
    return { directory: "cost", prefix: "cost-report", render: renderCostReport };
  }
  if (kind === "cost-report-slice") {
    return { directory: "cost", prefix: "cost-report-slice", render: renderCostReportSlice };
  }
  if (kind === "cost-report-aggregate") {
    return {
      directory: "cost",
      prefix: "cost-report-aggregate",
      render: renderCostReportAggregate
    };
  }
  const config = SIMPLE_RENDERERS[kind];
  if (!config) {
    throw new Error(`Unsupported artifact kind: ${kind}`);
  }
  return config;
}

/** @param {string} repoPath */
async function buildRepoLayoutBlock(repoPath) {
  /**
   * @param {string} relDir
   * @param {object} [opts]
   */
  async function safeReaddir(relDir, opts = {}) {
    try {
      return await fs.readdir(path.join(repoPath, relDir), opts);
    } catch {
      return [];
    }
  }

  const scripts =
    (await safeReaddir("scripts")).filter((e) => e.endsWith(".mjs")).join(", ") || "(not found)";

  const agents =
    (await safeReaddir("agents")).filter((e) => e.endsWith(".md")).join(", ") || "(not found)";

  let skillDirs = "(not found)";
  try {
    // Cast: fs.readdir overloads do not always narrow { withFileTypes: true }
    // to Dirent[] under the LSP's strict default. Runtime is unaffected.
    const skillEntries = /** @type {import('node:fs').Dirent[]} */ (
      await fs.readdir(path.join(repoPath, "skills"), { withFileTypes: true })
    );
    const joined = skillEntries
      .filter((e) => e.isDirectory())
      .map((e) => `${e.name}/`)
      .join(", ");
    if (joined) skillDirs = joined;
  } catch {
    // skills/ absent or unreadable
  }
  const skills = skillDirs;

  const tests =
    (await safeReaddir("tests")).filter((e) => e.endsWith(".mjs")).join(", ") || "(not found)";

  let npmScripts = "(not found)";
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repoPath, "package.json"), "utf8"));
    npmScripts = Object.keys(pkg.scripts || {}).join(", ");
  } catch {
    // package.json absent or unreadable
  }

  return [
    "",
    "## Repo Layout (auto-discovered at handoff write time)",
    `scripts/: ${scripts}`,
    `agents/: ${agents}`,
    `skills/: ${skills}`,
    `tests/: ${tests}`,
    `npm scripts: ${npmScripts}`,
    ""
  ].join("\n");
}

/**
 * @param {string} repoPath
 * @param {string} kind
 * @param {ArtifactFields} [fields]
 */
export async function writeArtifact(repoPath, kind, fields = {}) {
  const config = resolveArtifactConfig(kind);
  const artifactDir = path.join(repoPath, ...ARTIFACT_ROOT, config.directory);
  await fs.mkdir(artifactDir, { recursive: true });

  const title = fields.title || fields.summary || kind;
  const fileName = `${timestampSlug()}-${config.prefix}-${slugify(title)}.md`;
  const artifactPath = path.join(artifactDir, fileName);
  // cost-report (and its slice/aggregate variants) own their own frontmatter
  // (feature/phase folded inline by renderCostReportFrontmatter). Every other
  // artifact kind gets an optional YAML frontmatter block from
  // renderOptionalFrontmatter when feature or phase is set; otherwise the
  // body is unchanged.
  const isCostReport =
    kind === "cost-report" || kind === "cost-report-slice" || kind === "cost-report-aggregate";
  const fm = isCostReport ? "" : renderOptionalFrontmatter(fields);
  let body = config.render(fields);
  if (kind === "handoff" && fields.repoContext) {
    body += await buildRepoLayoutBlock(repoPath);
  }
  const contents = `${fm}${body}\n`;

  await fs.writeFile(artifactPath, contents);
  const artifact = {
    kind,
    path: artifactPath,
    title: fields.title || "Untitled"
  };

  // cost-report (and its slice/aggregate variants) are purely informational
  // evidence; they must not touch workflow-state badges or create a
  // spurious currentRun.
  if (!isCostReport) {
    await registerWorkflowArtifact(repoPath, artifact, fields);
  }

  return artifact;
}
