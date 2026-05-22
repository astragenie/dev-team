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

function resolveArtifactConfig(kind) {
  if (kind === "run-brief") {
    return {
      directory: "runs",
      prefix: "run-brief",
      render(fields) {
        return [
          `# Run Brief: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Goal", fields.goal),
          renderField("Mode", fields.mode),
          renderField("Pace", fields.pace),
          renderField("Owner", fields.owner),
          renderField("Status", fields.status || "active"),
          renderField("Summary", fields.summary),
          renderListField("Scope", fields.scope),
          renderListField("Out Of Scope", fields.outOfScope),
          renderListField("Planned Files", fields.files),
          renderField("Next Step", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "handoff") {
    return {
      directory: "handoffs",
      prefix: "handoff",
      render(fields) {
        return [
          `# Task Handoff: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("From", fields.from),
          renderField("To", fields.to),
          renderField("Objective", fields.goal || fields.summary),
          renderListField("Allowed Scope", fields.scope),
          renderListField("Forbidden Scope", fields.outOfScope),
          renderField("Deliverable", fields.deliverable),
          renderListField("Changed Files", fields.files),
          renderField("Confidence", fields.confidence),
          renderField("Risks", fields.risks),
          renderField("Suggested Next Handoff", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "review-result") {
    return {
      directory: "reviews",
      prefix: "review-result",
      render(fields) {
        return [
          `# Review Result: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Reviewer", fields.reviewer || fields.owner),
          renderField("Decision", fields.decision || "approved_with_notes"),
          renderField("Summary", fields.summary),
          renderListField("Evidence Checked", fields.evidence),
          renderListField("Files Reviewed", fields.files),
          renderField("Test Adequacy", fields.testSummary),
          renderField("Risks", fields.risks),
          renderField("Required Follow-up", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "validation-plan") {
    return {
      directory: "validations",
      prefix: "validation-plan",
      render(fields) {
        return [
          `# Validation Plan: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Owner", fields.owner || fields.validator),
          renderField("Environment", fields.environment),
          renderField("Goal", fields.goal || fields.summary),
          renderListField("Scope", fields.scope),
          renderListField("Out Of Scope", fields.outOfScope),
          renderListField("Evidence To Collect", fields.evidence),
          renderField("Next Step", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "validation-result") {
    return {
      directory: "validations",
      prefix: "validation-result",
      render(fields) {
        return [
          `# Validation Result: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Validator", fields.validator || fields.owner || "validator"),
          renderField("Environment", fields.environment),
          renderField("Decision", fields.decision || "passed_with_notes"),
          renderField("Scenario", fields.goal || fields.summary),
          renderListField("Evidence Collected", fields.evidence),
          renderListField("Files / Surfaces Checked", fields.files),
          renderField("Risks", fields.risks),
          renderField("Required Follow-up", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "deployment-check") {
    return {
      directory: "deployments",
      prefix: "deployment-check",
      render(fields) {
        return [
          `# Deployment Check: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Deployer", fields.deployer || fields.owner || "deployer"),
          renderField("Environment", fields.environment),
          renderField("Resource", fields.resource),
          renderField("Service URL", fields.url),
          renderField("Revision", fields.revision),
          renderField("Decision", fields.decision || "passed_with_notes"),
          renderField("Action", fields.goal || fields.summary),
          renderListField("Evidence Collected", fields.evidence),
          renderListField("Files / Surfaces Checked", fields.files),
          renderField("Risks", fields.risks),
          renderField("Required Follow-up", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  if (kind === "cost-report") {
    return {
      directory: "runs",
      prefix: "cost-report",
      render(fields) {
        const breakdown = fields.cost;
        const outcome = fields.outcome || null;
        const durationMs = breakdown?.window?.durationMs || 0;
        const durationMin = (durationMs / 60000).toFixed(1);
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

        // Frontmatter — machine-readable outcome linkage
        const fmLines = ["---"];
        fmLines.push(`kind: cost-report`);
        if (outcome?.sliceId) fmLines.push(`slice: ${outcome.sliceId}`);
        fmLines.push(`run_title: ${JSON.stringify(fields.runTitle || "")}`);
        if (breakdown?.usd != null) fmLines.push(`usd: ${breakdown.usd}`);
        if (durationMs) fmLines.push(`duration_ms: ${durationMs}`);
        if (totalTokens) fmLines.push(`total_tokens: ${totalTokens}`);
        if (cacheHitPct !== "-") fmLines.push(`cache_hit_pct: ${cacheHitPct}`);
        if (outcome?.gradeAvg != null) fmLines.push(`grade_avg: ${outcome.gradeAvg}`);
        if (outcome?.reviewDecision) fmLines.push(`review_decision: ${outcome.reviewDecision}`);
        if (outcome?.validationDecision)
          fmLines.push(`validation_decision: ${outcome.validationDecision}`);
        fmLines.push(`created_at: ${nowIso()}`);
        fmLines.push("---");

        const lines = [
          ...fmLines,
          "",
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
          ""
        ];

        if (outcome?.sliceId) {
          lines.push("## Outcome Linkage", "");
          lines.push(renderField("Slice", outcome.sliceId));
          lines.push(
            renderField("Grade Avg", outcome.gradeAvg != null ? String(outcome.gradeAvg) : "-")
          );
          lines.push(renderField("Review Decision", outcome.reviewDecision || "-"));
          lines.push(renderField("Validation Decision", outcome.validationDecision || "-"));
          if (outcome.scores) {
            lines.push("- Scores:");
            for (const [k, v] of Object.entries(outcome.scores)) {
              lines.push(`  - ${k}: ${v}`);
            }
          }
          lines.push("");
        }

        lines.push("## Tokens (totals)", "");
        if (breakdown?.totals) {
          for (const [k, v] of Object.entries(breakdown.totals)) {
            lines.push(`- ${k}: ${v.toLocaleString()}`);
          }
        } else {
          lines.push("- (none)");
        }

        lines.push("", "## Model Mix", "");
        if (breakdown?.modelMix?.length) {
          for (const m of breakdown.modelMix) {
            lines.push(
              `- ${m.model} (priced as ${m.pricedAs}): ${m.messages} msgs (${m.msgPct}%), $${m.usd.toFixed(4)} (${m.usdPct}%)`
            );
          }
        } else {
          lines.push("- (none)");
        }

        lines.push("", "## Conversation Shape", "");
        const conv = breakdown?.conversation || {};
        lines.push(`- user_msg_count: ${conv.userMsgCount ?? 0}`);
        lines.push(`- user_msg_avg_len: ${conv.userMsgAvgLen ?? 0}`);
        lines.push(`- turns_before_first_tool: ${conv.turnsBeforeFirstTool ?? 0}`);
        lines.push(`- compaction_count: ${conv.compactionCount ?? 0}`);
        lines.push(`- skill_invocations: ${conv.skillInvocations ?? 0}`);
        lines.push(`- subagent_dispatches: ${conv.subagentDispatches ?? 0}`);

        lines.push("", "## Tool Usage", "");
        if (breakdown?.toolUsage?.length) {
          for (const t of breakdown.toolUsage) {
            const failStr = t.failures > 0 ? ` (${t.failures} failed)` : "";
            lines.push(`- ${t.name}: ${t.count}${failStr}`);
          }
        } else {
          lines.push("- (none)");
        }

        lines.push("", "## Tool Result Sizes (bytes)", "");
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

        lines.push("", "## File Re-reads", "");
        lines.push(`- redundant_read_count: ${breakdown?.fileReReadCount ?? 0}`);
        if (breakdown?.fileReReadTopPaths?.length) {
          lines.push("- top paths:");
          for (const p of breakdown.fileReReadTopPaths) {
            lines.push(`  - ${p.reads}× ${p.path}`);
          }
        }

        lines.push("", "## By Model (token detail)", "");
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

        if (fields.notes) {
          lines.push("## Notes", "", fields.notes, "");
        }
        return lines.join("\n");
      }
    };
  }

  if (kind === "final-synthesis") {
    return {
      directory: "runs",
      prefix: "final-synthesis",
      render(fields) {
        return [
          `# Final Synthesis: ${fields.title || "Untitled"}`,
          "",
          renderField("Created", nowIso()),
          renderField("Owner", fields.owner),
          renderField("Outcome", fields.status || "completed"),
          renderField("Summary", fields.summary),
          renderListField("Changed Files / Evidence", fields.files || fields.evidence),
          renderListField("Run / Test Steps", fields.runSteps),
          renderField("Risks", fields.risks),
          renderField("Next Step", fields.next),
          ""
        ].join("\n");
      }
    };
  }

  throw new Error(`Unsupported artifact kind: ${kind}`);
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
