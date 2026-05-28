import fs from "node:fs/promises";
import path from "node:path";

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

/** @param {string} repoPath @param {number} [limit] */
async function loadReports(repoPath, limit = 20) {
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
      if (/-cost-report-.+\.md$/.test(e)) files.push({ dir, name: e });
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

// ---------------------------------------------------------------------------
// Performance letter grade (A-F)
// ---------------------------------------------------------------------------

/**
 * Grade thresholds keyed by metric name. Each row is [maxValue, grade] where
 * maxValue is the INCLUSIVE upper bound that still earns that grade.
 * cacheHitPct uses INCLUSIVE lower bound (inverted — higher is better).
 *
 * @type {Record<string, Array<[number, string]>>}
 */
const GRADE_THRESHOLDS = {
  // [minPct, grade] — highest threshold first
  cacheHitPct: [
    [98, "A"],
    [95, "B"],
    [90, "C"],
    [80, "D"]
  ],
  // [maxCount, grade] — lowest threshold first
  compactionCount: [
    [1, "A"],
    [3, "B"],
    [6, "C"],
    [15, "D"]
  ],
  subagentDispatches: [
    [2, "A"],
    [4, "B"],
    [6, "C"],
    [10, "D"]
  ],
  fileRereadCount: [
    [3, "A"],
    [8, "B"],
    [15, "C"],
    [30, "D"]
  ],
  // toolFailureRate is a fraction 0-1; thresholds are fractions
  toolFailureRate: [
    [0.03, "A"],
    [0.05, "B"],
    [0.08, "C"],
    [0.15, "D"]
  ]
};

const GRADE_ORDER = ["A", "B", "C", "D", "F"];

/**
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function worseGrade(a, b) {
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

/**
 * Compute a composite performance letter grade (A-F) from cost-report metrics.
 * Logic: start at A, downgrade to the worst band any single metric falls into.
 *
 * @param {{ cacheHitPct: number, compactionCount: number, subagentDispatches: number,
 *           fileRereadCount: number, toolFailureRate?: number }} target
 * @returns {"A"|"B"|"C"|"D"|"F"}
 */
export function computeGrade(target) {
  let grade = "A";

  /** @type {Record<string, number>} */
  const targetMap = /** @type {Record<string, number>} */ (/** @type {unknown} */ (target));

  // cacheHitPct: higher is better
  const cacheHit = target.cacheHitPct ?? 0;
  let cacheGrade = "F";
  for (const [min, g] of GRADE_THRESHOLDS.cacheHitPct) {
    if (cacheHit >= /** @type {number} */ (min)) {
      cacheGrade = /** @type {string} */ (g);
      break;
    }
  }
  grade = worseGrade(grade, cacheGrade);

  // Count-based metrics: lower is better
  /** @type {Array<[string, Array<[number, string]>]>} */
  const countMetrics = [
    ["compactionCount", GRADE_THRESHOLDS.compactionCount],
    ["subagentDispatches", GRADE_THRESHOLDS.subagentDispatches],
    ["fileRereadCount", GRADE_THRESHOLDS.fileRereadCount],
    ["toolFailureRate", GRADE_THRESHOLDS.toolFailureRate]
  ];

  for (const [key, thresholds] of countMetrics) {
    const val = targetMap[key] ?? 0;
    let metricGrade = "F";
    for (const [max, g] of thresholds) {
      if (val <= /** @type {number} */ (max)) {
        metricGrade = /** @type {string} */ (g);
        break;
      }
    }
    grade = worseGrade(grade, metricGrade);
  }

  return /** @type {"A"|"B"|"C"|"D"|"F"} */ (grade);
}

/**
 * @typedef {object} SourceEntry
 * @property {string} slug
 * @property {number} messages
 * @property {number} usd
 */

/**
 * @typedef {object} CachePrimingEntry
 * @property {string} name
 * @property {number} calls
 * @property {number} resultBytes
 * @property {number} cacheCreateTokens
 * @property {number | null} ratio
 */

/**
 * @typedef {object} SummaryRecord
 * @property {string} path
 * @property {string | number | null} sliceId
 * @property {string | number | null} runTitle
 * @property {number} usd
 * @property {number} durationMs
 * @property {number} totalTokens
 * @property {number} cacheHitPct
 * @property {number | null} gradeAvg
 * @property {string | number | null} reviewDecision
 * @property {string | number | null} validationDecision
 * @property {number} opusUsdPct
 * @property {number} totalToolCalls
 * @property {number} totalToolFailures
 * @property {number} toolFailureRate
 * @property {number} readCount
 * @property {number} bashCount
 * @property {number} grepCount
 * @property {number} writeCount
 * @property {number} editCount
 * @property {number} explorationRatio
 * @property {number} msgCount
 * @property {number} userMsgCount
 * @property {number} userMsgAvgLen
 * @property {number} turnsBeforeFirstTool
 * @property {number} compactionCount
 * @property {number} skillInvocations
 * @property {number} subagentDispatches
 * @property {number} fileRereadCount
 * @property {number} toolResultP90
 * @property {string | number | null} sourceProject
 * @property {boolean} autoDetected
 * @property {boolean} aggregateAll
 * @property {number} sourceCount
 * @property {SourceEntry[]} sources
 * @property {CachePrimingEntry[]} cachePriming
 */

/**
 * @typedef {object} BaselineRecord
 * @property {number} n
 * @property {number} usdMedian
 * @property {number} usdP75
 * @property {number} cacheHitMedian
 * @property {number} opusShareMedian
 */

/**
 * @typedef {object} RuleContext
 * @property {string} [repoOwnSlug]
 */

/**
 * @typedef {object} CostRule
 * @property {string} id
 * @property {(target: SummaryRecord, baseline?: BaselineRecord, ctx?: RuleContext) => boolean} trigger
 * @property {(target: SummaryRecord, baseline?: BaselineRecord, ctx?: RuleContext) => string} severity
 * @property {(target: SummaryRecord, baseline?: BaselineRecord, ctx?: RuleContext) => string} message
 * @property {string} suggestion
 */

/** @type {CostRule[]} */
const RULES = [
  {
    id: "cache-busted",
    trigger: (s) => s.cacheHitPct > 0 && s.cacheHitPct < 95,
    severity: (s) => (s.cacheHitPct < 60 ? "high" : s.cacheHitPct < 85 ? "medium" : "low"),
    message: (s) =>
      `Cache hit ${s.cacheHitPct}% is below the 95% amortisation sweet spot. Below 85% = cache rebuilds dominate cost.`,
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
    trigger: (s) => s.fileRereadCount >= 3,
    severity: (s) => (s.fileRereadCount >= 15 ? "high" : s.fileRereadCount >= 5 ? "medium" : "low"),
    message: (s) =>
      `${s.fileRereadCount} redundant Read calls of files already loaded this session.`,
    suggestion:
      "Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache."
  },
  {
    id: "large-tool-output",
    trigger: (s) => s.toolResultP90 > 4000,
    severity: (s) => (s.toolResultP90 > 30000 ? "high" : s.toolResultP90 > 8000 ? "medium" : "low"),
    message: (s) => `90th-percentile tool result is ${s.toolResultP90.toLocaleString()} bytes.`,
    suggestion:
      "Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create."
  },
  {
    id: "subagent-overuse",
    trigger: (s) => s.subagentDispatches > 2,
    severity: (s) =>
      s.subagentDispatches > 6 ? "high" : s.subagentDispatches > 3 ? "medium" : "low",
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
    trigger: (s) => s.turnsBeforeFirstTool > 3,
    severity: (s) => (s.turnsBeforeFirstTool > 6 ? "medium" : "low"),
    message: (s) => `${s.turnsBeforeFirstTool} assistant turns before the first tool call.`,
    suggestion:
      "Long narration before action wastes output tokens. Skip narration on routine slices; act first, summarise after."
  },
  {
    id: "tool-failure-rate",
    trigger: (s) => s.totalToolCalls >= 10 && s.toolFailureRate > 0.05,
    severity: (s) =>
      s.toolFailureRate > 0.25 ? "high" : s.toolFailureRate > 0.1 ? "medium" : "low",
    message: (s) =>
      `${(s.toolFailureRate * 100).toFixed(1)}% tool failure rate (${s.totalToolFailures}/${s.totalToolCalls}).`,
    suggestion:
      "Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first."
  },
  {
    id: "exploration-heavy",
    trigger: (s) =>
      Number.isFinite(s.explorationRatio) && s.explorationRatio > 4 && s.totalToolCalls >= 10,
    severity: (s) => (s.explorationRatio > 8 ? "high" : "medium"),
    message: (s) =>
      `Exploration:execution tool ratio is ${s.explorationRatio.toFixed(1)}:1 (Reads/Greps/Bashes vs Edits/Writes).`,
    suggestion:
      "Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts."
  },
  {
    id: "expensive-failure",
    trigger: (s, base) => s.usd > base.usdP75 && s.reviewDecision === "rejected",
    severity: () => "high",
    message: (s) =>
      `Spent $${s.usd.toFixed(2)} (>$${"top quartile"}) on a slice the review rejected.`,
    suggestion:
      "Mandate a written plan + brainstorming gate for similar slices before code is touched."
  },
  {
    id: "compaction-cascade",
    trigger: (s) => s.compactionCount > 10 && s.subagentDispatches > 5,
    severity: () => "high",
    message: (s) =>
      `${s.compactionCount} compactions + ${s.subagentDispatches} subagent dispatches — context overflow driven by excessive dispatching.`,
    suggestion:
      "Each subagent cold-starts the cache; the lead's context grows with each handoff read. Target ≤3 dispatches per slice. Bundle review + validation when scope is small. Write checkpoint handoffs at ≥3 compactions instead of dispatching more agents."
  },
  // ---- per-source / cross-repo rules ----
  {
    id: "xrepo-attribution",
    trigger: (s) => s.autoDetected === true && !s.aggregateAll,
    severity: () => "medium",
    message: (s) =>
      `Cost was auto-attributed to ${s.sourceProject} (not the repo-derived dir). Single-source view may under-count if work spanned multiple sessions.`,
    suggestion:
      "Re-run cost-slice with --aggregate-all to capture cross-repo spend, or pass --source-project explicitly if you know the right slug."
  },
  {
    id: "non-repo-dominant",
    trigger: (s, _base, ctx) => {
      if (!s.aggregateAll || !s.sources?.length || !ctx?.repoOwnSlug) return false;
      const own = s.sources.find((src) => src.slug === ctx.repoOwnSlug);
      const ownUsd = own?.usd || 0;
      const total = s.sources.reduce((a, b) => a + b.usd, 0);
      if (total === 0) return false;
      return ownUsd / total < 0.3; // <30% in the repo's own dir
    },
    severity: () => "medium",
    message: (s, _base, ctx) => {
      const own = s.sources.find((src) => src.slug === ctx?.repoOwnSlug);
      const ownUsd = own?.usd || 0;
      const total = s.sources.reduce((a, b) => a + b.usd, 0);
      const pct = total > 0 ? ((ownUsd / total) * 100).toFixed(1) : "0";
      return `Only ${pct}% of spend ($${ownUsd.toFixed(2)} of $${total.toFixed(2)}) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.`;
    },
    suggestion:
      "Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context."
  },
  {
    id: "many-sources",
    trigger: (s) => s.aggregateAll && s.sourceCount >= 3,
    severity: (s) => (s.sourceCount >= 5 ? "high" : "low"),
    message: (s) =>
      `Slice spend spread across ${s.sourceCount} different Claude sessions. Hard to reason about; cache reuse is fragmented.`,
    suggestion:
      "Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes."
  },
  // ---- Item 3: cache-priming rules (approximate signals) ----
  {
    id: "bash-bloat",
    trigger: (s) => {
      const bash = s.cachePriming?.find((t) => t.name === "Bash");
      if (!bash || bash.calls < 5) return false;
      const avgBytes = bash.resultBytes / bash.calls;
      return avgBytes > 5000;
    },
    severity: (s) => {
      const bash = s.cachePriming?.find((t) => t.name === "Bash");
      const avg = bash ? bash.resultBytes / bash.calls : 0;
      return avg > 15000 ? "high" : avg > 8000 ? "medium" : "low";
    },
    message: (s) => {
      const bash = s.cachePriming?.find((t) => t.name === "Bash");
      const avg = bash ? Math.round(bash.resultBytes / bash.calls) : 0;
      return `Bash result size averages ${avg.toLocaleString()}B over ${bash?.calls || 0} calls. Big Bash output inflates cache_create.`;
    },
    suggestion:
      "Prefer Grep with head_limit, or pipe Bash through `| head -N`, or read a narrower file slice. Each broad Bash result is fresh cache_create on the next turn."
  },
  {
    id: "dead-weight-skill",
    trigger: (s) => {
      const skill = s.cachePriming?.find((t) => t.name === "Skill");
      if (!skill || skill.calls < 2) return false;
      // Approximate "dead weight": ratio > 5× means skill prose dominated
      // cache_create relative to its own result size, and (heuristically)
      // wasn't reused enough to amortize. Combine with low cache hit on
      // the slice to filter false positives.
      return skill.ratio != null && skill.ratio > 5 && s.cacheHitPct > 0 && s.cacheHitPct < 95;
    },
    severity: () => "medium",
    message: (s) => {
      const skill = s.cachePriming?.find((t) => t.name === "Skill");
      return `Skill invocations have a ${skill?.ratio}× cache_create-to-result ratio while slice cache hit is only ${s.cacheHitPct}%. Skill prose is being injected but not amortized.`;
    },
    suggestion:
      "Audit which skills auto-load. Heavy skills (caveman, crew, superpowers) inject 2-10KB of prose each — if they're not used in subsequent turns, disable autoload."
  }
];

/**
 * @param {SummaryRecord} target
 * @param {BaselineRecord} baseline
 * @param {RuleContext} [ctx]
 */
function applyRules(target, baseline, ctx = {}) {
  const fired = [];
  for (const rule of RULES) {
    try {
      if (rule.trigger(target, baseline, ctx)) {
        fired.push({
          id: rule.id,
          severity: rule.severity(target, baseline, ctx),
          message: rule.message(target, baseline, ctx),
          suggestion: rule.suggestion
        });
      }
    } catch {
      // rule failed on missing field, skip
    }
  }
  return fired;
}

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

/** @param {string} repoPath @param {{ limit?: number }} [opts] */
export async function buildCostAdvisor(repoPath, { limit = 10 } = {}) {
  const reports = await loadReports(repoPath, limit);
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
