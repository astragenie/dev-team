// write.ts — ArtifactWriter: write operation + all render helpers.
// Part of the ISP split from scripts/lib/artifacts.mjs (AC-1).

import fs from "node:fs/promises";
import path from "node:path";
import { registerWorkflowArtifact } from "../workflow-state.ts";
import { renderCostReportFrontmatter } from "../cost-hygiene/render-frontmatter.ts";
import { buildRepoLayoutBlock } from "./read.ts";
import { ok, err } from "../result.ts";
import type { Result } from "../result.ts";
import type { ArtifactFields, CostBreakdown, CostOutcome, DispatchBreakdown } from "./types.ts";
import { renderDispatchBreakdownSection } from "../dispatch-timing-reader.ts";
import { fireGuarded } from "../gepa/guarded-fire.ts";
import type { captureTee as CaptureTeeFn } from "../gepa/capture-tee.ts";

export type { ArtifactFields, CostBreakdown, CostOutcome } from "./types.ts";

// ---------------------------------------------------------------------------
// Interfaces (AC-6)
// ---------------------------------------------------------------------------

export interface ArtifactRecord {
  kind: string;
  path: string;
  title: string;
}

/** Writes a crew artifact file and registers it in workflow state. */
export interface ArtifactWriter {
  writeArtifact(
    repoPath: string,
    kind: string,
    fields?: ArtifactFields
  ): Promise<Result<ArtifactRecord, Error>>;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function renderField(label: string, value: unknown): string {
  return `- ${label}: ${value || "-"}`;
}

function toList(value: unknown): string[] {
  if (!value || typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderListField(label: string, value: unknown): string {
  const items = toList(value);
  if (items.length === 0) {
    return `- ${label}: -`;
  }
  return [`- ${label}:`, ...items.map((item) => `  - ${item}`)].join("\n");
}

function slugify(value: string | undefined | null): string {
  return (
    (value ?? "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact"
  );
}

function timestampSlug(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

// ---------------------------------------------------------------------------
// Optional frontmatter block (non-cost-report artifacts)
// ---------------------------------------------------------------------------

function renderOptionalFrontmatter(fields: ArtifactFields): string {
  const lines: string[] = [];
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
  if (fields.findings) {
    lines.push(`findings: ${JSON.stringify(fields.findings)}`);
  }
  if (fields.status) {
    lines.push(`status: ${fields.status}`);
  }
  // P1.3: canonical review/validation verdict enum, distinct from the legacy
  // free-form `decision` body-prose field (see ArtifactFields.verdict).
  if (fields.verdict) {
    lines.push(`decision: ${fields.verdict}`);
  }
  if (fields.skipReason) {
    lines.push(`skip_reason: ${JSON.stringify(fields.skipReason)}`);
  }
  if (lines.length === 0) {
    return "";
  }
  return ["---", ...lines, "---", ""].join("\n");
}

// ---------------------------------------------------------------------------
// Scaffold renderers (deterministic templates with empty judgment fields)
// ---------------------------------------------------------------------------

function renderReviewResultScaffold(fields: ArtifactFields): string {
  const lines = [
    `# Review Result: ${fields.title || "Untitled"}`,
    "",
    "## Verdict",
    "- decision: ",
    "- confidence: ",
    "",
    "## Test Summary",
    "- test-command: ",
    "- coverage: ",
    "",
    "## Changed Files",
    "- (auto-populated by git during review)",
    "",
    "## Findings",
    "- pass: 0",
    "- partial: 0",
    "- fail: 0",
    "",
    "## Risks",
    "- (describe residual risks or 'none')",
    "",
    "## Notes",
    "- (reviewer judgment here)"
  ];
  return lines.join("\n");
}

function renderValidationResultScaffold(fields: ArtifactFields): string {
  const lines = [
    `# Validation Result: ${fields.title || "Untitled"}`,
    "",
    "## Environment",
    "- tested: local",
    "",
    "## Scenario",
    "- goal: ",
    "",
    "## Gates",
    "- lint: ",
    "- format: ",
    "- tests: ",
    "- verify:all: ",
    "",
    "## Evidence",
    "- (command output and observed behavior)",
    "",
    "## Findings",
    "- pass: 0",
    "- partial: 0",
    "- fail: 0",
    "",
    "## Risks",
    "- (residual risks or 'none')",
    "",
    "## Decision",
    "- outcome: "
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Simple (list-of-fields) artifact renderers
// ---------------------------------------------------------------------------

type Renderer = (f: ArtifactFields) => string;

interface ArtifactConfig {
  directory: string;
  prefix: string;
  render: Renderer;
}

const SIMPLE_RENDERERS: Record<string, ArtifactConfig> = {
  "run-brief": {
    directory: "runs",
    prefix: "run-brief",
    render: (f) =>
      [
        `# Run Brief: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Tier", f.tier || "full"),
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
    render: (f) => {
      const lines = [
        `# Task Handoff: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("From", f.from),
        renderField("To", f.to),
        renderField("Objective", f.goal || f.summary)
      ];
      if (f.status) {
        lines.push(renderField("Status", f.status));
      }
      lines.push(
        renderListField("Allowed Scope", f.scope),
        renderListField("Forbidden Scope", f.outOfScope),
        renderField("Deliverable", f.deliverable),
        renderListField("Changed Files", f.files),
        renderField("Confidence", f.confidence),
        renderField("Risks", f.risks),
        renderField("Suggested Next Handoff", f.next),
        ""
      );
      return lines.join("\n");
    }
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
        renderField("Decision", f.decision || "approved_with_notes")
      ];
      if (f.status) {
        lines.push(renderField("Status", f.status));
      }
      lines.push(
        renderField("Summary", f.summary),
        renderListField("Evidence Checked", f.evidence),
        renderListField("Files Reviewed", f.files),
        renderField("Test Adequacy", f.testSummary)
      );
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
    render: (f) => {
      const lines = [
        `# Validation Result: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Validator", f.validator || f.owner || "verifier"),
        renderField("Environment", f.environment),
        renderField("Decision", f.decision || "passed_with_notes")
      ];
      if (f.status) {
        lines.push(renderField("Status", f.status));
      }
      lines.push(
        renderField("Scenario", f.goal || f.summary),
        renderListField("Evidence Collected", f.evidence),
        renderListField("Files / Surfaces Checked", f.files),
        renderField("Risks", f.risks),
        renderField("Required Follow-up", f.next),
        ""
      );
      return lines.join("\n");
    }
  },
  "deployment-check": {
    directory: "deployments",
    prefix: "deployment-check",
    render: (f) =>
      [
        `# Deployment Check: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Deployer", f.deployer || f.owner || "release-engineer"),
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

// ---------------------------------------------------------------------------
// cost-report renderers
// ---------------------------------------------------------------------------

function renderCostReportSources(breakdown: CostBreakdown | undefined): string[] {
  if (!breakdown?.sources?.length || breakdown.sources.length < 2) return [];
  const lines = ["## Sources (aggregated)", ""];
  for (const src of breakdown.sources) {
    lines.push(`- ${src.slug}: ${src.messages} msgs, $${src.usd.toFixed(4)}`);
  }
  lines.push("");
  return lines;
}

function formatDuration(durationMs: number): string {
  if (!durationMs) return "-";
  return `${(durationMs / 60000).toFixed(1)} min (${durationMs} ms)`;
}

function formatTokens(totalTokens: number): string {
  return totalTokens ? totalTokens.toLocaleString() : "-";
}

function formatCacheHit(cacheHitPct: number | string): string {
  return cacheHitPct !== "-" ? `${cacheHitPct}%` : "-";
}

function formatUsd(breakdown: CostBreakdown | undefined | null): string {
  return breakdown ? `$${breakdown.usd?.toFixed(4) ?? "0.0000"}` : "-";
}

function formatBool(value: unknown): string {
  return value ? "yes" : "no";
}

function formatCount(value: number | null | undefined): string {
  return String(value ?? 0);
}

function renderCostReportHeader(
  fields: ArtifactFields,
  breakdown: CostBreakdown | undefined,
  totalTokens: number,
  cacheHitPct: number | string
): string[] {
  const window = breakdown?.window ?? {};
  return [
    `# Cost Report: ${fields.title || "Untitled"}`,
    "",
    renderField("Created", nowIso()),
    renderField("Run Title", fields.runTitle),
    renderField("Window Start", window.start),
    renderField("Window End", window.end),
    renderField("Duration", formatDuration(window.durationMs ?? 0)),
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

function renderCostReportOutcome(outcome: CostOutcome | null | undefined): string[] {
  if (!outcome?.sliceId) return [];
  const lines = ["## Outcome Linkage", ""];
  lines.push(renderField("Slice", outcome.sliceId));
  lines.push(renderField("Grade Avg", outcome.gradeAvg != null ? String(outcome.gradeAvg) : "-"));
  lines.push(renderField("Review Decision", outcome.reviewDecision ?? "-"));
  lines.push(renderField("Validation Decision", outcome.validationDecision ?? "-"));
  if (outcome.scores) {
    lines.push("- Scores:");
    for (const [k, v] of Object.entries(outcome.scores)) {
      lines.push(`  - ${k}: ${v}`);
    }
  }
  lines.push("");
  return lines;
}

function renderCostReportTokens(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportModelMix(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportConversation(breakdown: CostBreakdown | undefined): string[] {
  const conv = breakdown?.conversation ?? {};
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

function renderCostReportToolUsage(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportToolResultSizes(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportFileReReads(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportCachePriming(breakdown: CostBreakdown | undefined): string[] {
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

function renderCostReportByModel(breakdown: CostBreakdown | undefined): string[] {
  const lines = ["", "## By Model (token detail)", ""];
  if (breakdown?.byModel && Object.keys(breakdown.byModel).length) {
    for (const [model, info] of Object.entries(breakdown.byModel)) {
      lines.push(`### ${model} (priced as ${info.pricedAs ?? "unknown"})`);
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
 * Render the ## Per-dispatch breakdown section from pre-aggregated telemetry.
 * Returns an empty array when data is absent.
 */
function renderCostReportDispatchBreakdown(
  dispatchBreakdown: DispatchBreakdown | undefined
): string[] {
  if (!dispatchBreakdown) return [];
  const section = renderDispatchBreakdownSection(
    dispatchBreakdown.dispatch,
    dispatchBreakdown.gates
  );
  if (!section) return [];
  return [section];
}

/**
 * Shared body renderer for all three cost-report kinds.
 * variant controls frontmatter field overrides.
 */
/**
 * Render the ## Agent stats (rolling) cost-report section (FEAT-159 SLICE-B).
 * Top-5 agents by sample_count desc. Empty array → no section emitted.
 */
function renderCostReportAgentStats(rows: ArtifactFields["agentStats"]): string[] {
  if (!rows || rows.length === 0) return [];
  const top = [...rows].sort((a, b) => b.sample_count - a.sample_count).slice(0, 5);
  const win = top[0]?.window ?? "";
  const fmtPct = (x: number): string => `${(x * 100).toFixed(0)}%`;
  const out: string[] = [
    "## Agent stats (rolling)",
    "",
    `Window: \`${win}\` · top-5 by sample count`,
    "",
    "| Agent | N | pass% | wallMs | tokens | rework% | valfail% | medDisp |",
    "|---|---:|---:|---:|---:|---:|---:|---:|"
  ];
  for (const r of top) {
    out.push(
      `| ${r.agent} | ${r.sample_count} | ${fmtPct(r.pass_rate)} | ${r.mean_wall_ms} | ${r.mean_tokens} | ${fmtPct(r.review_rework_rate)} | ${fmtPct(r.validation_fail_rate)} | ${r.median_dispatches_to_pass} |`
    );
  }
  out.push("");
  return out;
}

function renderCostReportBody(
  fields: ArtifactFields,
  variant: "slice" | "aggregate" | null
): string {
  const breakdown = fields.cost;
  const outcome = fields.outcome ?? null;
  const totalTokens = breakdown?.totals
    ? Object.values(breakdown.totals).reduce((a, b) => a + b, 0)
    : 0;
  const promptTokens =
    breakdown?.totals != null
      ? (breakdown.totals["input"] ?? 0) +
        (breakdown.totals["cache_create_5m"] ?? 0) +
        (breakdown.totals["cache_create_1h"] ?? 0) +
        (breakdown.totals["cache_read"] ?? 0)
      : 0;
  const cacheHitPct: number | string =
    promptTokens > 0 && breakdown?.totals != null
      ? Number((((breakdown.totals["cache_read"] ?? 0) / promptTokens) * 100).toFixed(1))
      : "-";

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
    ...(fields.notes ? ["## Notes", "", fields.notes, ""] : []),
    ...renderCostReportDispatchBreakdown(fields.dispatchBreakdown),
    ...renderCostReportAgentStats(fields.agentStats)
  ].join("\n");
}

// ---------------------------------------------------------------------------
// resolveArtifactConfig — keeps the directory/prefix lookup in this module
// ---------------------------------------------------------------------------

export function resolveArtifactConfig(kind: string): ArtifactConfig {
  if (kind === "cost-report") {
    return {
      directory: "cost",
      prefix: "cost-report",
      render: (f) => renderCostReportBody(f, null)
    };
  }
  if (kind === "cost-report-slice") {
    return {
      directory: "cost",
      prefix: "cost-report-slice",
      render: (f) => renderCostReportBody(f, "slice")
    };
  }
  if (kind === "cost-report-aggregate") {
    return {
      directory: "cost",
      prefix: "cost-report-aggregate",
      render: (f) => renderCostReportBody(f, "aggregate")
    };
  }
  const config = SIMPLE_RENDERERS[kind];
  if (!config) {
    throw new Error(`Unsupported artifact kind: ${kind}`);
  }
  return config;
}

// ---------------------------------------------------------------------------
// Main write function (AC-5: returns Result<ArtifactRecord, Error>)
// ---------------------------------------------------------------------------

const ARTIFACT_ROOT = [".claude", "artifacts", "crew"];

/**
 * Write a crew artifact file.
 * Returns Result<ArtifactRecord, Error> — callers must check .ok before using .value.
 *
 * When fields.updatePath is provided, writes to that exact path (idempotent update).
 * Otherwise, generates a new timestamped filename (backward-compatible behavior).
 */
function isCostReportKind(kind: string): boolean {
  return kind === "cost-report" || kind === "cost-report-slice" || kind === "cost-report-aggregate";
}

// Resolve the destination path: `updatePath` for idempotent updates,
// otherwise a fresh timestamped filename under the artifact directory.
function resolveArtifactPath(
  artifactDir: string,
  kind: string,
  fields: ArtifactFields,
  config: { prefix: string }
): string {
  if (fields.updatePath) return fields.updatePath;
  const title = fields.title ?? fields.summary ?? kind;
  const fileName = `${timestampSlug()}-${config.prefix}-${slugify(title)}.md`;
  return path.join(artifactDir, fileName);
}

// Render the frontmatter block. Cost-report kinds have no frontmatter;
// scaffold mode forces an "in-progress" status into the frontmatter set.
function renderArtifactFrontmatter(kind: string, fields: ArtifactFields): string {
  if (isCostReportKind(kind)) return "";
  if (fields.scaffold) return renderOptionalFrontmatter({ ...fields, status: "in-progress" });
  return renderOptionalFrontmatter(fields);
}

// Render the body. Scaffold mode has per-kind scaffold renderers; non-scaffold
// uses the kind's normal renderer.
function renderArtifactBody(
  kind: string,
  fields: ArtifactFields,
  config: { render: (f: ArtifactFields) => string }
): string {
  if (!fields.scaffold) return config.render(fields);
  if (kind === "review-result") return renderReviewResultScaffold(fields);
  if (kind === "validation-result") return renderValidationResultScaffold(fields);
  return config.render(fields);
}

// Test-only overrides for writeArtifact (Wave 1.5 / runner-plugin issue
// #360). Mirrors the `__resolveRemote` seam in astramem-provider.ts:
// underscore-prefixed, optional, never set by production callers. When
// omitted (every production call site), the default dynamic-import loader
// runs — byte-identical to pre-seam behavior.
export interface WriteArtifactTestOverrides {
  /** Overrides the dynamic-import loader fireCaptureTeeSilent uses to reach
   * captureTee — lets tests inject a slow/fake module instead of racing a
   * real (possibly cold) @astragenie/gepa-core parse. */
  __captureTeeLoader?: () => Promise<{ captureTee: typeof CaptureTeeFn }>;
  /** Shrinks the fireGuarded race ceiling below the production default so
   * tests don't have to wait out the real timeout to observe it winning. */
  __guardTimeoutMs?: number;
}

const defaultCaptureTeeLoader = () => import("../gepa/capture-tee.ts");

// Fire-and-forget GEPA capture tee. Guarded (Wave 1.5 / issue #360): races
// the dynamic import + write against a bounded ceiling so a cold
// @astragenie/gepa-core parse can never hang this call open indefinitely.
// Never propagates errors.
async function fireCaptureTeeSilent(
  repoPath: string,
  artifact: ArtifactRecord,
  fields: ArtifactFields,
  overrides: WriteArtifactTestOverrides = {}
): Promise<void> {
  await fireGuarded(async () => {
    const loader = overrides.__captureTeeLoader ?? defaultCaptureTeeLoader;
    const { captureTee } = await loader();
    await captureTee(repoPath, artifact, fields);
  }, overrides.__guardTimeoutMs);
}

// Test-only bookkeeping (Wave 1.5 / issue #360): production code never
// awaits writeArtifact's fire-and-forget captures (see writeArtifact below)
// — they are detached so a slow/cold capture never delays the artifact
// write's return, and a process that exits before a detached capture
// settles simply drops it (accepted trade, documented on
// capture-failure-trial-guard.ts / guarded-fire.ts). Tests, however, need a
// deterministic way to know the background work has settled before
// asserting on its side effects, without sleeping. This tracker is
// additive and inert in production: nothing outside tests calls
// __drainPendingCaptures.
const pendingCaptures = new Set<Promise<void>>();

function trackDetached(capture: Promise<void>): void {
  pendingCaptures.add(capture);
  // Defensive: the detached captures already swallow their own errors
  // (fireGuarded never rejects; fireFailureCaptureSilent is fully try/caught),
  // but a terminal .catch keeps trackDetached robust to a future capture path
  // that could reject — a detached rejection would otherwise surface as a
  // process-level unhandledRejection. Non-blocking hardening (review #360).
  void capture.finally(() => pendingCaptures.delete(capture)).catch(() => {});
}

/** Test seam: await every fire-and-forget capture triggered by writeArtifact
 * so far. Never called by production code. */
export async function __drainPendingCaptures(): Promise<void> {
  await Promise.allSettled([...pendingCaptures]);
}

// FEAT-188 S1a AC-2: auto-capture a `failure`-kind learnings entry whenever
// a review-result write carries the "rejected" verdict, or a
// validation-result write carries the "fail" verdict. Fire-and-forget,
// mirrors fireCaptureTeeSilent above — never blocks or fails the write this
// hooks onto.
function isFailingVerdict(kind: string, fields: ArtifactFields): boolean {
  if (kind === "review-result") return fields.verdict === "rejected";
  if (kind === "validation-result") return fields.verdict === "fail";
  return false;
}

async function fireFailureCaptureSilent(
  repoPath: string,
  kind: string,
  fields: ArtifactFields
): Promise<void> {
  if (!isFailingVerdict(kind, fields)) return;
  const agent = kind === "review-result" ? fields.reviewer : fields.validator;
  const rationale = fields.findings || fields.summary || `${kind} verdict: ${fields.verdict}`;
  try {
    const { captureFailureLearning } = await import("../memory/capture-learning.ts");
    await captureFailureLearning(repoPath, {
      agent: agent ?? null,
      severity: "high",
      summary: rationale,
      tags: [kind, fields.slice, fields.feature].filter((t): t is string => Boolean(t)),
      source: kind === "review-result" ? "review_fail" : "validation_fail"
    });
  } catch {
    // never propagate
  }
  // FEAT-193 S1: dual-write — also append a failing Trial to the agent's GEPA
  // trial store, alongside the learnings.jsonl append above. Two parallel
  // providers (operator decision): lessons → learnings.jsonl, failing trials
  // → the GEPA reflection corpus.
  //
  // Goes through captureFailureTrialGuarded (timeout-raced, ~1.5s ceiling),
  // NOT captureFailureTrial directly: @astragenie/gepa-core's installed
  // package resolves to raw .ts source, so the first dynamic import that
  // touches it in a process can take multiple seconds cold — long enough to
  // blow this CLI command's expected latency (regression caught + fixed
  // here; see capture-failure-trial-guard.ts's header comment for the full
  // root cause).
  try {
    const { captureFailureTrialGuarded } = await import("../gepa/capture-failure-trial-guard.ts");
    await captureFailureTrialGuarded(repoPath, {
      agent: agent ?? "unknown",
      phase: kind === "review-result" ? "review" : "validate",
      rationale,
      input: { slice: fields.slice ?? null, feature: fields.feature ?? null, kind }
    });
  } catch {
    // never propagate
  }
}

export async function writeArtifact(
  repoPath: string,
  kind: string,
  fields: ArtifactFields = {},
  overrides: WriteArtifactTestOverrides = {}
): Promise<Result<ArtifactRecord, Error>> {
  try {
    const config = resolveArtifactConfig(kind);
    const artifactDir = path.join(repoPath, ...ARTIFACT_ROOT, config.directory);
    await fs.mkdir(artifactDir, { recursive: true });

    const artifactPath = resolveArtifactPath(artifactDir, kind, fields, config);
    const fm = renderArtifactFrontmatter(kind, fields);
    let body = renderArtifactBody(kind, fields, config);

    if (kind === "handoff" && fields.repoContext) {
      body += await buildRepoLayoutBlock(repoPath);
    }

    await fs.writeFile(artifactPath, `${fm}${body}\n`);
    const artifact: ArtifactRecord = {
      kind,
      path: artifactPath,
      title: fields.title ?? "Untitled"
    };

    if (!isCostReportKind(kind)) {
      await registerWorkflowArtifact(repoPath, artifact, fields);
    }
    // Wave 1.5 (issue #360): detached, not inline-awaited. Both captures are
    // best-effort derived duplicates (astramem / the GEPA trial corpus
    // remain source of truth) — a slow/cold capture must never delay this
    // write's return. See fireCaptureTeeSilent + guarded-fire.ts headers.
    trackDetached(fireCaptureTeeSilent(repoPath, artifact, fields, overrides));
    trackDetached(fireFailureCaptureSilent(repoPath, kind, fields));

    return ok(artifact);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
