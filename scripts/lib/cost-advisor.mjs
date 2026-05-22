import fs from "node:fs/promises";
import path from "node:path";

const REPORTS_DIR_PARTS = [".claude", "artifacts", "crew", "runs"];

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { fm: null, body: text };
  const block = text.slice(3, end).trim();
  const body = text.slice(end + 4);
  const fm = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([\w_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        /* keep raw string on parse failure */
      }
    } else if (/^-?\d+(?:\.\d+)?$/.test(v)) {
      v = Number(v);
    }
    fm[m[1]] = v;
  }
  return { fm, body };
}

function extractBodyMetric(body, label) {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

function extractCounter(body, label) {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*([\\d.,]+)`, "m"));
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

// Pull tool usage out of the "## Tool Usage" section.
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

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function loadReports(repoPath, limit = 20) {
  const dir = path.join(repoPath, ...REPORTS_DIR_PARTS);
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => /-cost-report-.+\.md$/.test(f)).map((f) => path.join(dir, f));
  const stats = await Promise.all(
    files.map(async (f) => {
      try {
        return { f, m: (await fs.stat(f)).mtimeMs };
      } catch {
        return null;
      }
    })
  );
  const sorted = stats
    .filter(Boolean)
    .sort((a, b) => b.m - a.m)
    .slice(0, limit);
  const reports = [];
  for (const { f } of sorted) {
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

function summarizeReport(r) {
  const body = r.body;
  const opusShare = extractModelMix(body)
    .filter((m) => /opus/i.test(m.model))
    .reduce((a, b) => a + b.usdPct, 0);
  const tools = extractToolUsage(body);
  const totalToolCalls = tools.reduce((a, t) => a + t.count, 0);
  const totalToolFailures = tools.reduce((a, t) => a + t.failures, 0);
  const readCount = tools.find((t) => t.name === "Read")?.count || 0;
  const bashCount = tools.find((t) => t.name === "Bash")?.count || 0;
  const grepCount = tools.find((t) => t.name === "Grep")?.count || 0;
  const writeCount = tools.find((t) => t.name === "Write")?.count || 0;
  const editCount = tools.find((t) => t.name === "Edit")?.count || 0;
  const explorationTokens = readCount + grepCount + bashCount;
  const executionTokens = writeCount + editCount;
  const explorationRatio =
    executionTokens > 0
      ? explorationTokens / executionTokens
      : explorationTokens > 0
        ? Infinity
        : 0;

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
    totalToolCalls,
    totalToolFailures,
    toolFailureRate: totalToolCalls > 0 ? totalToolFailures / totalToolCalls : 0,
    readCount,
    bashCount,
    grepCount,
    writeCount,
    editCount,
    explorationRatio,
    msgCount: extractCounter(body, "Assistant Messages Counted"),
    userMsgCount: extractCounter(body, "user_msg_count"),
    userMsgAvgLen: extractCounter(body, "user_msg_avg_len"),
    turnsBeforeFirstTool: extractCounter(body, "turns_before_first_tool"),
    compactionCount: extractCounter(body, "compaction_count"),
    skillInvocations: extractCounter(body, "skill_invocations"),
    subagentDispatches: extractCounter(body, "subagent_dispatches"),
    fileRereadCount: extractCounter(body, "redundant_read_count"),
    toolResultP90: extractCounter(body, "p90")
  };
}

const RULES = [
  {
    id: "cache-busted",
    trigger: (s) => s.cacheHitPct > 0 && s.cacheHitPct < 85,
    severity: (s) => (s.cacheHitPct < 60 ? "high" : "medium"),
    message: (s) =>
      `Cache hit ${s.cacheHitPct}% is below the 85% target. Repeated cache rebuilds are dominating cost.`,
    suggestion:
      "Front-load file reads in the first 1-2 turns then iterate; avoid interleaving big Bash output with code edits since fresh tool results invalidate the cache."
  },
  {
    id: "opus-overuse",
    trigger: (s) => s.opusUsdPct > 50,
    severity: (s) => (s.opusUsdPct > 80 ? "high" : "medium"),
    message: (s) =>
      `Opus accounts for ${s.opusUsdPct.toFixed(1)}% of spend — Opus is ~5x Sonnet on every token category.`,
    suggestion:
      "Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors."
  },
  {
    id: "opus-no-grade-payoff",
    trigger: (s) => s.opusUsdPct > 30 && s.gradeAvg != null && s.gradeAvg < 0.75,
    severity: () => "high",
    message: (s) =>
      `Used Opus for ${s.opusUsdPct.toFixed(1)}% of cost but grade avg is ${s.gradeAvg}.`,
    suggestion:
      "Opus did not buy quality on this slice. Try Sonnet next time and invest the savings into more validation."
  },
  {
    id: "file-rereads",
    trigger: (s) => s.fileRereadCount >= 5,
    severity: (s) => (s.fileRereadCount >= 15 ? "high" : "medium"),
    message: (s) =>
      `${s.fileRereadCount} redundant Read calls of files already loaded this session.`,
    suggestion:
      "Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache."
  },
  {
    id: "large-tool-output",
    trigger: (s) => s.toolResultP90 > 8000,
    severity: (s) => (s.toolResultP90 > 30000 ? "high" : "medium"),
    message: (s) => `90th-percentile tool result is ${s.toolResultP90.toLocaleString()} bytes.`,
    suggestion:
      "Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create."
  },
  {
    id: "subagent-overuse",
    trigger: (s) => s.subagentDispatches > 3,
    severity: (s) => (s.subagentDispatches > 6 ? "high" : "medium"),
    message: (s) => `${s.subagentDispatches} subagent dispatches.`,
    suggestion:
      "Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work."
  },
  {
    id: "compaction",
    trigger: (s) => s.compactionCount > 0,
    severity: (s) => (s.compactionCount > 2 ? "high" : "medium"),
    message: (s) =>
      `${s.compactionCount} compaction/meta event(s) — context was summarised mid-slice.`,
    suggestion:
      "Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work."
  },
  {
    id: "preamble",
    trigger: (s) => s.turnsBeforeFirstTool > 5,
    severity: () => "low",
    message: (s) => `${s.turnsBeforeFirstTool} assistant turns before the first tool call.`,
    suggestion:
      "Long narration before action wastes output tokens. Skip narration on routine slices; act first, summarise after."
  },
  {
    id: "tool-failure-rate",
    trigger: (s) => s.totalToolCalls >= 10 && s.toolFailureRate > 0.1,
    severity: (s) => (s.toolFailureRate > 0.25 ? "high" : "medium"),
    message: (s) =>
      `${(s.toolFailureRate * 100).toFixed(1)}% tool failure rate (${s.totalToolFailures}/${s.totalToolCalls}).`,
    suggestion:
      "Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first."
  },
  {
    id: "exploration-heavy",
    trigger: (s) =>
      Number.isFinite(s.explorationRatio) && s.explorationRatio > 4 && s.totalToolCalls >= 10,
    severity: () => "low",
    message: (s) =>
      `Exploration:execution tool ratio is ${s.explorationRatio.toFixed(1)}:1 (Reads/Greps/Bashes vs Edits/Writes).`,
    suggestion:
      "Lots of looking, little doing. Decide on the change after the second pass of exploration; do not keep grepping."
  },
  {
    id: "expensive-failure",
    trigger: (s, base) => s.usd > base.usdP75 && s.reviewDecision === "rejected",
    severity: () => "high",
    message: (s) =>
      `Spent $${s.usd.toFixed(2)} (>$${"top quartile"}) on a slice the review rejected.`,
    suggestion:
      "Mandate a written plan + brainstorming gate for similar slices before code is touched."
  }
];

function applyRules(target, baseline) {
  const fired = [];
  for (const rule of RULES) {
    try {
      if (rule.trigger(target, baseline)) {
        fired.push({
          id: rule.id,
          severity: rule.severity(target, baseline),
          message: rule.message(target, baseline),
          suggestion: rule.suggestion
        });
      }
    } catch {
      // rule failed on missing field, skip
    }
  }
  return fired;
}

export async function buildCostAdvisor(repoPath, { limit = 10 } = {}) {
  const reports = await loadReports(repoPath, limit);
  if (reports.length === 0) {
    return { reports: [], target: null, baseline: null, recommendations: [] };
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

  const recommendations = applyRules(target, baseline);

  // Cross-history aggregate signals
  const aggregateFlags = [];
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
    aggregateFlags
  };
}

export function renderCostAdvisorMarkdown(advisor) {
  const lines = [];
  lines.push("# Cost Advisor", "");
  if (!advisor.target) {
    lines.push("- No cost reports found. Run cost-slice first.");
    return lines.join("\n");
  }
  const t = advisor.target;
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
