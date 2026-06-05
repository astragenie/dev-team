import fs from "node:fs/promises";
import path from "node:path";
import { computeGrade } from "./cost-advisor-grades.mjs";
import { applyRules } from "./cost-advisor-rules.mjs";

/**
 * @typedef {import('./cost-advisor-rules.mjs').SummaryRecord} SummaryRecord
 * @typedef {import('./cost-advisor-rules.mjs').BaselineRecord} BaselineRecord
 */

// Cost reports now land in cost/ (Item 1 split). Older reports may still
// live in the legacy runs/ dir, so loadReports scans both for backward compat.
const REPORTS_DIR_PARTS = [".claude", "artifacts", "crew", "cost"];
const LEGACY_REPORTS_DIR_PARTS = [".claude", "artifacts", "crew", "runs"];

/**
 * @param {string} text
 */
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { fm: null, body: text };
  const block = text.slice(3, end).trim();
  const body = text.slice(end + 4);
  /** @type {Record<string, string | number>} */
  const fm = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([\w_]+):\s*(.*)$/);
    if (!m) continue;
    /** @type {string | number} */
    let v = m[2].trim();
    if (typeof v === "string" && v.startsWith('"') && v.endsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        /* keep raw string on parse failure */
      }
    } else if (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v)) {
      v = Number(v);
    }
    fm[m[1]] = v;
  }
  return { fm, body };
}

/**
 * @param {string} body
 * @param {string} label
 */
function extractBodyMetric(body, label) {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

/**
 * @param {string} body
 * @param {string} label
 */
function extractCounter(body, label) {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*([\\d.,]+)`, "m"));
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

// Pull tool usage out of the "## Tool Usage" section.
/** @param {string} body */
function extractToolUsage(body) {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Tool Usage"));
  if (!section) return [];
  const out = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^-\s+([\w-]+):\s*([\d,]+)(?:\s*\((\d+)\s+failed\))?/);
    if (m)
      out.push({
        name: m[1],
        count: Number(m[2].replace(/,/g, "")),
        failures: m[3] ? Number(m[3]) : 0
      });
  }
  return out;
}

/** @param {string} body */
function extractModelMix(body) {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Model Mix"));
  if (!section) return [];
  const out = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+(\S+)\s+\(priced as\s+(\S+)\):\s*(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/
    );
    if (m)
      out.push({
        model: m[1],
        pricedAs: m[2],
        messages: Number(m[3]),
        msgPct: Number(m[4]),
        usd: Number(m[5]),
        usdPct: Number(m[6])
      });
  }
  return out;
}

/** @param {number[]} arr */
function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * @param {number[]} arr
 * @param {number} p
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/**
 * @param {string} repoPath
 * @param {number} [limit]
 * @param {((name: string) => boolean) | null} [nameFilter] optional extra filter on filename
 */
async function loadReports(repoPath, limit = 20, nameFilter = null) {
  // Scan new cost/ dir first, then legacy runs/ dir for backward compat.
  // Filenames carry a timestamp prefix (YYYYMMDDTHHMMSSZ-...) so lexicographic
  // sort is chronological. We exploit that to skip an N-wide fs.stat batch:
  // sort by basename desc and read only the top N. Cheaper than the previous
  // "stat every file then sort by mtime" path, especially on large dirs.
  const dirs = [
    path.join(repoPath, ...REPORTS_DIR_PARTS),
    path.join(repoPath, ...LEGACY_REPORTS_DIR_PARTS)
  ];
  const files = [];
  for (const dir of dirs) {
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (/-cost-report-.+\.md$/.test(e) && (nameFilter === null || nameFilter(e))) {
        files.push({ dir, name: e });
      }
    }
  }
  // Sort by basename desc (newest first via timestamp prefix), then slice.
  files.sort((a, b) => b.name.localeCompare(a.name));
  const top = files.slice(0, limit);
  const reports = [];
  for (const { dir, name } of top) {
    const f = path.join(dir, name);
    try {
      const text = await fs.readFile(f, "utf8");
      const { fm, body } = parseFrontmatter(text);
      reports.push({ path: f, fm: fm || {}, body });
    } catch {
      /* skip unreadable / malformed report files silently */
    }
  }
  return reports;
}

// Parse the "## Cache Priming (per tool, approximate)" block. Lines look
// like: "- Bash: 7 calls, 5,190B results, ~18,601 cache_create tok (3.58×)".
/** @param {string} body */
function extractCachePriming(body) {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Cache Priming"));
  if (!section) return [];
  const out = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+([\w-]+):\s+(\d+)\s+calls,\s+([\d,]+)B\s+results,\s+~([\d,]+)\s+cache_create\s+tok\s+\(([\d.]+|—)/
    );
    if (m) {
      const ratio = m[5] === "—" ? null : Number(m[5]);
      out.push({
        name: m[1],
        calls: Number(m[2]),
        resultBytes: Number(m[3].replace(/,/g, "")),
        cacheCreateTokens: Number(m[4].replace(/,/g, "")),
        ratio
      });
    }
  }
  return out;
}

// Parse the "## Sources (aggregated)" block out of a cost-report body.
// Lines look like: "- C--work-mega: 14 msgs, $9.5937".
/** @param {string} body */
function extractSources(body) {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Sources"));
  if (!section) return [];
  const out = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^-\s+(\S+):\s*(\d+)\s+msgs,\s+\$([\d.]+)/);
    if (m) out.push({ slug: m[1], messages: Number(m[2]), usd: Number(m[3]) });
  }
  return out;
}

// Slug that the repo path itself would resolve to. Used to detect when
// spend is concentrated in a NON-repo source dir (cross-repo work signal).
/** @param {string | null | undefined} repoPath */
function repoOwnSlug(repoPath) {
  if (!repoPath) return null;
  return repoPath.replace(/[^A-Za-z0-9]/g, "-");
}

/**
 * @param {Array<{name: string, count: number, failures: number}>} tools
 * @param {string} name
 */
function toolCount(tools, name) {
  return tools.find((t) => t.name === name)?.count || 0;
}

/** @param {Array<{name: string, count: number, failures: number}>} tools */
function computeExplorationRatio(tools) {
  const exploration =
    toolCount(tools, "Read") + toolCount(tools, "Grep") + toolCount(tools, "Bash");
  const execution = toolCount(tools, "Write") + toolCount(tools, "Edit");
  if (execution > 0) return exploration / execution;
  return exploration > 0 ? Infinity : 0;
}

/** @param {string} body */
function summarizeToolStats(body) {
  const tools = extractToolUsage(body);
  const totalToolCalls = tools.reduce((a, t) => a + t.count, 0);
  const totalToolFailures = tools.reduce((a, t) => a + t.failures, 0);
  return {
    totalToolCalls,
    totalToolFailures,
    toolFailureRate: totalToolCalls > 0 ? totalToolFailures / totalToolCalls : 0,
    readCount: toolCount(tools, "Read"),
    bashCount: toolCount(tools, "Bash"),
    grepCount: toolCount(tools, "Grep"),
    writeCount: toolCount(tools, "Write"),
    editCount: toolCount(tools, "Edit"),
    explorationRatio: computeExplorationRatio(tools)
  };
}

/**
 * @param {{ path: string, fm: Record<string, string | number>, body: string }} r
 */
function summarizeReport(r) {
  const body = r.body;
  const opusShare = extractModelMix(body)
    .filter((m) => /opus/i.test(m.model))
    .reduce((a, b) => a + b.usdPct, 0);
  const tool = summarizeToolStats(body);

  return {
    path: r.path,
    sliceId: r.fm.slice || null,
    runTitle: r.fm.run_title || extractBodyMetric(body, "Run Title"),
    usd: Number(r.fm.usd) || 0,
    durationMs: Number(r.fm.duration_ms) || 0,
    totalTokens: Number(r.fm.total_tokens) || 0,
    cacheHitPct: Number(r.fm.cache_hit_pct) || 0,
    gradeAvg: r.fm.grade_avg != null ? Number(r.fm.grade_avg) : null,
    reviewDecision: r.fm.review_decision || null,
    validationDecision: r.fm.validation_decision || null,
    opusUsdPct: opusShare,
    ...tool,
    msgCount: extractCounter(body, "Assistant Messages Counted"),
    userMsgCount: extractCounter(body, "user_msg_count"),
    userMsgAvgLen: extractCounter(body, "user_msg_avg_len"),
    turnsBeforeFirstTool: extractCounter(body, "turns_before_first_tool"),
    compactionCount: extractCounter(body, "compaction_count"),
    skillInvocations: extractCounter(body, "skill_invocations"),
    subagentDispatches: extractCounter(body, "subagent_dispatches"),
    fileRereadCount: extractCounter(body, "redundant_read_count"),
    toolResultP90: extractCounter(body, "p90"),
    // Cross-repo / aggregate-source metadata
    sourceProject: r.fm.source_project || null,
    autoDetected: String(r.fm.auto_detected || "").toLowerCase() === "true",
    aggregateAll: String(r.fm.aggregate_all || "").toLowerCase() === "true",
    sourceCount: r.fm.source_count ? Number(r.fm.source_count) : 0,
    sources: extractSources(body),
    cachePriming: extractCachePriming(body)
  };
}

// Performance letter grade (A-F) — imported from cost-advisor-grades.mjs.
// Re-export computeGrade so existing callers of cost-advisor.mjs are unaffected.
export { computeGrade } from "./cost-advisor-grades.mjs";

// Rules and applyRules imported from cost-advisor-rules.mjs.

/**
 * Detect regression trends by comparing the last 3 summarized reports.
 *
 * Reports are expected newest-first (same order as loadReports / summaries).
 * Returns findings with the same shape as per-slice recommendations:
 * { id, severity, message, suggestion }.
 *
 * Three signals:
 *   compaction-drift   — compactionCount strictly increasing across last 3 (medium)
 *   subagent-creep     — subagentDispatches strictly increasing across last 3 (medium)
 *   cost-regression    — current usd >20% above median of last 3 (high)
 *
 * @param {Array<ReturnType<summarizeReport>>} reports  Newest-first array of summaries.
 * @returns {{ id: string, severity: string, message: string, suggestion: string }[]}
 */
export function detectTrends(reports) {
  if (!reports || reports.length < 3) return [];

  const [r0, r1, r2] = reports; // r0 = newest, r2 = oldest
  const findings = [];

  // --- compaction-drift -------------------------------------------------------
  // Each newer report has MORE compactions than the previous one.
  // newest > middle > oldest  ⟹  r0 > r1 > r2
  if (r0.compactionCount > r1.compactionCount && r1.compactionCount > r2.compactionCount) {
    findings.push({
      id: "compaction-drift",
      severity: "medium",
      message: `Compaction count has increased across the last 3 slices: ${r2.compactionCount} → ${r1.compactionCount} → ${r0.compactionCount}. Context window pressure is growing.`,
      suggestion:
        "Split work into smaller slices and write checkpoint handoffs earlier. If compaction hit once, treat it as a budget warning and wrap up that slice."
    });
  }

  // --- subagent-creep ---------------------------------------------------------
  // Each newer report dispatches MORE subagents than the previous one.
  if (
    r0.subagentDispatches > r1.subagentDispatches &&
    r1.subagentDispatches > r2.subagentDispatches
  ) {
    findings.push({
      id: "subagent-creep",
      severity: "medium",
      message: `Subagent dispatch count has grown across the last 3 slices: ${r2.subagentDispatches} → ${r1.subagentDispatches} → ${r0.subagentDispatches}. Each cold-start re-derives session context.`,
      suggestion:
        "Bundle review + validation into a single subagent when scope is small. Reserve parallel dispatches for genuinely independent parallel work."
    });
  }

  // --- cost-regression --------------------------------------------------------
  // Current slice USD is more than 20% above the median of the last 3 slices.
  const usds = [r0.usd, r1.usd, r2.usd];
  const med = median(usds);
  if (med > 0 && r0.usd > med * 1.2) {
    const pctAbove = (((r0.usd - med) / med) * 100).toFixed(0);
    findings.push({
      id: "cost-regression",
      severity: "high",
      message: `Current slice cost $${r0.usd.toFixed(4)} is ${pctAbove}% above the last-3 median of $${med.toFixed(4)}.`,
      suggestion:
        "Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice."
    });
  }

  return findings;
}

/**
 * @param {string} repoPath
 * @param {{ limit?: number, nameFilter?: ((name: string) => boolean) | null }} [opts]
 */
export async function buildCostAdvisor(repoPath, { limit = 10, nameFilter = null } = {}) {
  const reports = await loadReports(repoPath, limit, nameFilter);
  if (reports.length === 0) {
    return {
      reports: /** @type {SummaryRecord[]} */ ([]),
      target: /** @type {SummaryRecord | null} */ (null),
      baseline: /** @type {BaselineRecord | null} */ (null),
      recommendations:
        /** @type {Array<{id:string,severity:string,message:string,suggestion:string}>} */ ([])
    };
  }
  const summaries = reports.map(summarizeReport);
  const target = summaries[0]; // most recent
  const history = summaries.slice(1);

  const usds = history.map((s) => s.usd).filter((v) => v > 0);
  const cacheHits = history.map((s) => s.cacheHitPct).filter((v) => v > 0);
  const opusShares = history.map((s) => s.opusUsdPct);
  const baseline = {
    n: history.length,
    usdMedian: median(usds),
    usdP75: percentile(usds, 75),
    cacheHitMedian: median(cacheHits),
    opusShareMedian: median(opusShares)
  };

  const recommendations = applyRules(target, baseline, { repoOwnSlug: repoOwnSlug(repoPath) });
  const grade = computeGrade(target);

  // Cross-history aggregate signals (existing median checks + new trend detectors)
  const aggregateFlags = [...detectTrends(summaries)];
  if (baseline.n >= 3 && baseline.cacheHitMedian > 0 && baseline.cacheHitMedian < 90) {
    aggregateFlags.push({
      id: "trend-cache",
      severity: "medium",
      message: `Median cache hit across recent slices is ${baseline.cacheHitMedian.toFixed(1)}%.`,
      suggestion:
        "Recurring cache-bust pattern. Audit the workflow for steps that always inject fresh large content (e.g. broad Bash output before each Edit)."
    });
  }
  if (baseline.n >= 3 && baseline.opusShareMedian > 40) {
    aggregateFlags.push({
      id: "trend-opus",
      severity: "medium",
      message: `Median Opus $ share is ${baseline.opusShareMedian.toFixed(1)}% across recent slices.`,
      suggestion:
        "Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped."
    });
  }

  return {
    reports: summaries,
    target,
    baseline,
    recommendations,
    aggregateFlags,
    grade
  };
}

/**
 * @param {{ target: SummaryRecord | null, baseline?: BaselineRecord | null,
 *           grade?: string, recommendations: Array<{id:string,severity:string,message:string,suggestion:string}>,
 *           aggregateFlags?: Array<{id:string,severity:string,message:string,suggestion:string}> }} advisor
 */
export function renderCostAdvisorMarkdown(advisor) {
  const lines = [];
  lines.push("# Cost Advisor", "");
  if (!advisor.target) {
    lines.push("- No cost reports found. Run cost-slice first.");
    return lines.join("\n");
  }
  const t = advisor.target;
  if (advisor.grade) {
    lines.push(`## Performance Grade: ${advisor.grade}`, "");
  }
  lines.push(`Target slice: **${t.sliceId || t.runTitle || "?"}**`);
  lines.push(
    `Cost: $${t.usd.toFixed(4)} · duration ${(t.durationMs / 60000).toFixed(1)} min · cache hit ${t.cacheHitPct}% · grade avg ${t.gradeAvg ?? "-"}`
  );
  lines.push("");

  const b = advisor.baseline;
  if (b && b.n > 0) {
    lines.push("## Baseline (last " + b.n + " slices)");
    lines.push(`- median $: $${b.usdMedian.toFixed(2)}`);
    lines.push(`- p75 $: $${b.usdP75.toFixed(2)}`);
    lines.push(`- median cache hit: ${b.cacheHitMedian.toFixed(1)}%`);
    lines.push(`- median Opus share: ${b.opusShareMedian.toFixed(1)}%`);
    lines.push("");
  }

  if (advisor.recommendations.length === 0) {
    lines.push("## Per-slice findings");
    lines.push("- No rules fired. This slice is within healthy bounds.");
  } else {
    lines.push("## Per-slice findings");
    for (const r of advisor.recommendations) {
      lines.push(`### [${r.severity.toUpperCase()}] ${r.id}`);
      lines.push(`- ${r.message}`);
      lines.push(`- **Suggested action:** ${r.suggestion}`);
      lines.push("");
    }
  }

  if (advisor.aggregateFlags?.length) {
    lines.push("## Cross-slice trends");
    for (const r of advisor.aggregateFlags) {
      lines.push(`### [${r.severity.toUpperCase()}] ${r.id}`);
      lines.push(`- ${r.message}`);
      lines.push(`- **Suggested action:** ${r.suggestion}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
