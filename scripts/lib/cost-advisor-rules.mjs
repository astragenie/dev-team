// Cost advisor rule definitions extracted from cost-advisor.mjs.
// RULES: the full rule table. applyRules: evaluates rules against a target.

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
export const RULES = [
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
export function applyRules(target, baseline, ctx = {}) {
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
