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

function slugify(value) {
  return (
    (value || "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact"
  );
}

function toList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderField(label, value) {
  return `- ${label}: ${value || "-"}`;
}

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
    render: (f) =>
      [
        `# Review Result: ${f.title || "Untitled"}`,
        "",
        renderField("Created", nowIso()),
        renderField("Reviewer", f.reviewer || f.owner),
        renderField("Decision", f.decision || "approved_with_notes"),
        renderField("Summary", f.summary),
        renderListField("Evidence Checked", f.evidence),
        renderListField("Files Reviewed", f.files),
        renderField("Test Adequacy", f.testSummary),
        renderField("Risks", f.risks),
        renderField("Required Follow-up", f.next),
        ""
      ].join("\n")
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
        renderField("Risks", f.risks),
        renderField("Next Step", f.next),
        ""
      ].join("\n")
  }
};

// --- cost-report: complex, multi-section renderer split into helpers ---

function renderCostReportFrontmatter(fields, breakdown, outcome, totalTokens, cacheHitPct) {
  const lines = ["---", "kind: cost-report"];
  if (outcome?.sliceId) lines.push(`slice: ${outcome.sliceId}`);
  lines.push(`run_title: ${JSON.stringify(fields.runTitle || "")}`);
  if (breakdown?.usd != null) lines.push(`usd: ${breakdown.usd}`);
  const durationMs = breakdown?.window?.durationMs || 0;
  if (durationMs) lines.push(`duration_ms: ${durationMs}`);
  if (totalTokens) lines.push(`total_tokens: ${totalTokens}`);
  if (cacheHitPct !== "-") lines.push(`cache_hit_pct: ${cacheHitPct}`);
  if (outcome?.gradeAvg != null) lines.push(`grade_avg: ${outcome.gradeAvg}`);
  if (outcome?.reviewDecision) lines.push(`review_decision: ${outcome.reviewDecision}`);
  if (outcome?.validationDecision)
    lines.push(`validation_decision: ${outcome.validationDecision}`);
  if (breakdown?.sourceProject) lines.push(`source_project: ${breakdown.sourceProject}`);
  if (breakdown?.autoDetected) lines.push(`auto_detected: true`);
  if (breakdown?.aggregateAll) lines.push(`aggregate_all: true`);
  if (breakdown?.sources?.length) lines.push(`source_count: ${breakdown.sources.length}`);
  lines.push(`created_at: ${nowIso()}`);
  lines.push("---");
  return lines;
}

function renderCostReportSources(breakdown) {
  if (!breakdown?.sources?.length || breakdown.sources.length < 2) return [];
  const lines = ["## Sources (aggregated)", ""];
  for (const src of breakdown.sources) {
    lines.push(`- ${src.slug}: ${src.messages} msgs, $${src.usd.toFixed(4)}`);
  }
  lines.push("");
  return lines;
}

function renderCostReportHeader(fields, breakdown, totalTokens, cacheHitPct) {
  const durationMs = breakdown?.window?.durationMs || 0;
  const durationMin = (durationMs / 60000).toFixed(1);
  return [
    `# Cost Report: ${fields.title || "Untitled"}`,
    "",
    renderField("Created", nowIso()),
    renderField("Run Title", fields.runTitle),
    renderField("Window Start", breakdown?.window?.start),
    renderField("Window End", breakdown?.window?.end),
    renderField("Duration", durationMs ? `${durationMin} min (${durationMs} ms)` : "-"),
    renderField("Sessions Scanned", String(breakdown?.sessionsScanned ?? 0)),
    renderField("Assistant Messages Counted", String(breakdown?.messagesCounted ?? 0)),
    renderField("Total Tokens", totalTokens ? totalTokens.toLocaleString() : "-"),
    renderField("Cache Hit %", cacheHitPct !== "-" ? `${cacheHitPct}%` : "-"),
    renderField("Total USD", breakdown ? `$${breakdown.usd.toFixed(4)}` : "-"),
    renderField("Source Project", breakdown?.sourceProject),
    renderField("Auto-detected", breakdown?.autoDetected ? "yes" : "no"),
    renderField("Aggregate All", breakdown?.aggregateAll ? "yes" : "no"),
    ""
  ];
}

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

function renderCostReportConversation(breakdown) {
  const conv = breakdown?.conversation || {};
  return [
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
}

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

function renderCostReport(fields) {
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
    ...renderCostReportFrontmatter(fields, breakdown, outcome, totalTokens, cacheHitPct),
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
    ...renderCostReportByModel(breakdown),
    ...(fields.notes ? ["## Notes", "", fields.notes, ""] : [])
  ].join("\n");
}

function resolveArtifactConfig(kind) {
  if (kind === "cost-report") {
    return { directory: "runs", prefix: "cost-report", render: renderCostReport };
  }
  const config = SIMPLE_RENDERERS[kind];
  if (!config) {
    throw new Error(`Unsupported artifact kind: ${kind}`);
  }
  return config;
}

export async function writeArtifact(repoPath, kind, fields = {}) {
  const config = resolveArtifactConfig(kind);
  const artifactDir = path.join(repoPath, ...ARTIFACT_ROOT, config.directory);
  await fs.mkdir(artifactDir, { recursive: true });

  const title = fields.title || fields.summary || kind;
  const fileName = `${timestampSlug()}-${config.prefix}-${slugify(title)}.md`;
  const artifactPath = path.join(artifactDir, fileName);
  const contents = `${config.render(fields)}\n`;

  await fs.writeFile(artifactPath, contents);
  const artifact = {
    kind,
    path: artifactPath,
    title: fields.title || "Untitled"
  };

  // cost-report is purely informational evidence; it must not touch
  // workflow-state badges or create a spurious currentRun.
  if (kind !== "cost-report") {
    await registerWorkflowArtifact(repoPath, artifact, fields);
  }

  return artifact;
}
