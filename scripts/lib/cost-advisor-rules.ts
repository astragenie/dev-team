// Cost advisor rule definitions.
// RULES: the full rule table. applyRules: evaluates rules against a target.

export interface SourceEntry {
  slug: string;
  messages: number;
  usd: number;
}

export interface CachePrimingEntry {
  name: string;
  calls: number;
  resultBytes: number;
  cacheCreateTokens: number;
  ratio: number | null;
}

export interface SummaryRecord {
  path: string;
  sliceId: string | number | null;
  runTitle: string | number | null;
  usd: number;
  durationMs: number;
  totalTokens: number;
  cacheHitPct: number;
  gradeAvg: number | null;
  reviewDecision: string | number | null;
  validationDecision: string | number | null;
  opusUsdPct: number;
  totalToolCalls: number;
  totalToolFailures: number;
  toolFailureRate: number;
  readCount: number;
  bashCount: number;
  grepCount: number;
  writeCount: number;
  editCount: number;
  explorationRatio: number;
  msgCount: number;
  userMsgCount: number;
  userMsgAvgLen: number;
  turnsBeforeFirstTool: number;
  compactionCount: number;
  skillInvocations: number;
  subagentDispatches: number;
  fileRereadCount: number;
  toolResultP90: number;
  sourceProject: string | number | null;
  autoDetected: boolean;
  aggregateAll: boolean;
  sourceCount: number;
  sources: SourceEntry[];
  cachePriming: CachePrimingEntry[];
}

export interface BaselineRecord {
  n: number;
  usdMedian: number;
  usdP75: number;
  cacheHitMedian: number;
  opusShareMedian: number;
}

export interface RuleContext {
  repoOwnSlug?: string;
}

export interface Finding {
  id: string;
  severity: string;
  message: string;
  suggestion: string;
}

type RuleTriggerFn = (
  target: SummaryRecord,
  baseline?: BaselineRecord,
  ctx?: RuleContext
) => boolean;

type RuleStringFn = (
  target: SummaryRecord,
  baseline?: BaselineRecord,
  ctx?: RuleContext
) => string;

export interface CostRule {
  id: string;
  trigger: RuleTriggerFn;
  severity: RuleStringFn;
  message: RuleStringFn;
  suggestion: string;
}

// ---- helpers used by rules ----

function findBash(s: SummaryRecord): CachePrimingEntry | undefined {
  return s.cachePriming?.find((t) => t.name === "Bash");
}

function findSkill(s: SummaryRecord): CachePrimingEntry | undefined {
  return s.cachePriming?.find((t) => t.name === "Skill");
}

// ---- rule implementations ----

function triggerCacheBusted(s: SummaryRecord): boolean {
  return s.cacheHitPct > 0 && s.cacheHitPct < 95;
}

function severityCacheBusted(s: SummaryRecord): string {
  return s.cacheHitPct < 60 ? "high" : s.cacheHitPct < 85 ? "medium" : "low";
}

function messageCacheBusted(s: SummaryRecord): string {
  return `Cache hit ${s.cacheHitPct}% is below the 95% amortisation sweet spot. Below 85% = cache rebuilds dominate cost.`;
}

function triggerOpusOveruse(s: SummaryRecord): boolean {
  return s.opusUsdPct > 50;
}

function severityOpusOveruse(s: SummaryRecord): string {
  return s.opusUsdPct > 80 ? "high" : "medium";
}

function messageOpusOveruse(s: SummaryRecord): string {
  return `Opus accounts for ${s.opusUsdPct.toFixed(1)}% of spend — Opus is ~5x Sonnet on every token category.`;
}

function triggerOpusNoGradePayoff(s: SummaryRecord): boolean {
  return s.opusUsdPct > 30 && s.gradeAvg != null && s.gradeAvg < 0.75;
}

function messageOpusNoGradePayoff(s: SummaryRecord): string {
  return `Used Opus for ${s.opusUsdPct.toFixed(1)}% of cost but grade avg is ${s.gradeAvg}.`;
}

function triggerFileRereads(s: SummaryRecord): boolean {
  return s.fileRereadCount >= 3;
}

function severityFileRereads(s: SummaryRecord): string {
  return s.fileRereadCount >= 15 ? "high" : s.fileRereadCount >= 5 ? "medium" : "low";
}

function messageFileRereads(s: SummaryRecord): string {
  return `${s.fileRereadCount} redundant Read calls of files already loaded this session.`;
}

function triggerLargeToolOutput(s: SummaryRecord): boolean {
  return s.toolResultP90 > 4000;
}

function severityLargeToolOutput(s: SummaryRecord): string {
  return s.toolResultP90 > 30000 ? "high" : s.toolResultP90 > 8000 ? "medium" : "low";
}

function messageLargeToolOutput(s: SummaryRecord): string {
  return `90th-percentile tool result is ${s.toolResultP90.toLocaleString()} bytes.`;
}

function triggerSubagentOveruse(s: SummaryRecord): boolean {
  return s.subagentDispatches > 2;
}

function severitySubagentOveruse(s: SummaryRecord): string {
  return s.subagentDispatches > 6 ? "high" : s.subagentDispatches > 3 ? "medium" : "low";
}

function messageSubagentOveruse(s: SummaryRecord): string {
  return `${s.subagentDispatches} subagent dispatches.`;
}

function triggerCompaction(s: SummaryRecord): boolean {
  return s.compactionCount > 0;
}

function severityCompaction(s: SummaryRecord): string {
  return s.compactionCount > 2 ? "high" : "medium";
}

function messageCompaction(s: SummaryRecord): string {
  return `${s.compactionCount} compaction/meta event(s) — context was summarised mid-slice.`;
}

function triggerPreamble(s: SummaryRecord): boolean {
  return s.turnsBeforeFirstTool > 3;
}

function severityPreamble(s: SummaryRecord): string {
  return s.turnsBeforeFirstTool > 6 ? "medium" : "low";
}

function messagePreamble(s: SummaryRecord): string {
  return `${s.turnsBeforeFirstTool} assistant turns before the first tool call.`;
}

function triggerToolFailureRate(s: SummaryRecord): boolean {
  return s.totalToolCalls >= 10 && s.toolFailureRate > 0.05;
}

function severityToolFailureRate(s: SummaryRecord): string {
  return s.toolFailureRate > 0.25 ? "high" : s.toolFailureRate > 0.1 ? "medium" : "low";
}

function messageToolFailureRate(s: SummaryRecord): string {
  return `${(s.toolFailureRate * 100).toFixed(1)}% tool failure rate (${s.totalToolFailures}/${s.totalToolCalls}).`;
}

function triggerExplorationHeavy(s: SummaryRecord): boolean {
  return Number.isFinite(s.explorationRatio) && s.explorationRatio > 4 && s.totalToolCalls >= 10;
}

function severityExplorationHeavy(s: SummaryRecord): string {
  return s.explorationRatio > 8 ? "high" : "medium";
}

function messageExplorationHeavy(s: SummaryRecord): string {
  return `Exploration:execution tool ratio is ${s.explorationRatio.toFixed(1)}:1 (Reads/Greps/Bashes vs Edits/Writes).`;
}

function triggerExpensiveFailure(
  s: SummaryRecord,
  base?: BaselineRecord
): boolean {
  return base != null && s.usd > base.usdP75 && s.reviewDecision === "rejected";
}

function messageExpensiveFailure(s: SummaryRecord): string {
  return `Spent $${s.usd.toFixed(2)} (>$${"top quartile"}) on a slice the review rejected.`;
}

function triggerCompactionCascade(s: SummaryRecord): boolean {
  return s.compactionCount > 10 && s.subagentDispatches > 5;
}

function messageCompactionCascade(s: SummaryRecord): string {
  return `${s.compactionCount} compactions + ${s.subagentDispatches} subagent dispatches — context overflow driven by excessive dispatching.`;
}

function triggerXrepoAttribution(s: SummaryRecord): boolean {
  return s.autoDetected === true && !s.aggregateAll;
}

function messageXrepoAttribution(s: SummaryRecord): string {
  return `Cost was auto-attributed to ${s.sourceProject} (not the repo-derived dir). Single-source view may under-count if work spanned multiple sessions.`;
}

function triggerNonRepoDominant(
  s: SummaryRecord,
  _base?: BaselineRecord,
  ctx?: RuleContext
): boolean {
  if (!s.aggregateAll || !s.sources?.length || !ctx?.repoOwnSlug) return false;
  const own = s.sources.find((src) => src.slug === ctx.repoOwnSlug);
  const ownUsd = own?.usd ?? 0;
  const total = s.sources.reduce((a, b) => a + b.usd, 0);
  if (total === 0) return false;
  return ownUsd / total < 0.3;
}

function messageNonRepoDominant(
  s: SummaryRecord,
  _base?: BaselineRecord,
  ctx?: RuleContext
): string {
  const own = s.sources.find((src) => src.slug === ctx?.repoOwnSlug);
  const ownUsd = own?.usd ?? 0;
  const total = s.sources.reduce((a, b) => a + b.usd, 0);
  const pct = total > 0 ? ((ownUsd / total) * 100).toFixed(1) : "0";
  return `Only ${pct}% of spend ($${ownUsd.toFixed(2)} of $${total.toFixed(2)}) came from the repo-derived session. Bookkeeping is misaligned with where work actually happened.`;
}

function triggerManySources(s: SummaryRecord): boolean {
  return s.aggregateAll && s.sourceCount >= 3;
}

function severityManySources(s: SummaryRecord): string {
  return s.sourceCount >= 5 ? "high" : "low";
}

function messageManySources(s: SummaryRecord): string {
  return `Slice spend spread across ${s.sourceCount} different Claude sessions. Hard to reason about; cache reuse is fragmented.`;
}

function triggerBashBloat(s: SummaryRecord): boolean {
  const bash = findBash(s);
  if (!bash || bash.calls < 5) return false;
  const avgBytes = bash.resultBytes / bash.calls;
  return avgBytes > 5000;
}

function severityBashBloat(s: SummaryRecord): string {
  const bash = findBash(s);
  const avg = bash ? bash.resultBytes / bash.calls : 0;
  return avg > 15000 ? "high" : avg > 8000 ? "medium" : "low";
}

function messageBashBloat(s: SummaryRecord): string {
  const bash = findBash(s);
  const avg = bash ? Math.round(bash.resultBytes / bash.calls) : 0;
  return `Bash result size averages ${avg.toLocaleString()}B over ${bash?.calls ?? 0} calls. Big Bash output inflates cache_create.`;
}

function triggerDeadWeightSkill(s: SummaryRecord): boolean {
  const skill = findSkill(s);
  if (!skill || skill.calls < 2) return false;
  return skill.ratio != null && skill.ratio > 5 && s.cacheHitPct > 0 && s.cacheHitPct < 95;
}

function messageDeadWeightSkill(s: SummaryRecord): string {
  const skill = findSkill(s);
  return `Skill invocations have a ${skill?.ratio}× cache_create-to-result ratio while slice cache hit is only ${s.cacheHitPct}%. Skill prose is being injected but not amortized.`;
}

export const RULES: CostRule[] = [
  {
    id: "cache-busted",
    trigger: triggerCacheBusted,
    severity: severityCacheBusted,
    message: messageCacheBusted,
    suggestion:
      "Front-load file reads in the first 1-2 turns then iterate; avoid interleaving big Bash output with code edits since fresh tool results invalidate the cache."
  },
  {
    id: "opus-overuse",
    trigger: triggerOpusOveruse,
    severity: severityOpusOveruse,
    message: messageOpusOveruse,
    suggestion:
      "Switch routine slices to Sonnet via /model. Reserve Opus for design, ambiguous problem framing, or hard refactors."
  },
  {
    id: "opus-no-grade-payoff",
    trigger: triggerOpusNoGradePayoff,
    severity: () => "high",
    message: messageOpusNoGradePayoff,
    suggestion:
      "Opus did not buy quality on this slice. Try Sonnet next time and invest the savings into more validation."
  },
  {
    id: "file-rereads",
    trigger: triggerFileRereads,
    severity: severityFileRereads,
    message: messageFileRereads,
    suggestion:
      "Trust prior Read results unless the file was edited. Each redundant Read injects fresh tool output that busts the cache."
  },
  {
    id: "large-tool-output",
    trigger: triggerLargeToolOutput,
    severity: severityLargeToolOutput,
    message: messageLargeToolOutput,
    suggestion:
      "Prefer Grep with head_limit, Bash | head -N, or narrower file Read offsets over broad output. Big tool results inflate cache_create."
  },
  {
    id: "subagent-overuse",
    trigger: triggerSubagentOveruse,
    severity: severitySubagentOveruse,
    message: messageSubagentOveruse,
    suggestion:
      "Subagents cold-start with no cache reuse — each one re-derives session context. Reserve for genuinely independent parallel work."
  },
  {
    id: "compaction",
    trigger: triggerCompaction,
    severity: severityCompaction,
    message: messageCompaction,
    suggestion:
      "Slice ran past the context window. Checkpoint to a handoff artifact earlier and split the work."
  },
  {
    id: "preamble",
    trigger: triggerPreamble,
    severity: severityPreamble,
    message: messagePreamble,
    suggestion:
      "Long narration before action wastes output tokens. Skip narration on routine slices; act first, summarise after."
  },
  {
    id: "tool-failure-rate",
    trigger: triggerToolFailureRate,
    severity: severityToolFailureRate,
    message: messageToolFailureRate,
    suggestion:
      "Tool failures are pure waste. Plan the call shape (paths, flags, JSON schemas) before invoking; check pwd / file existence first."
  },
  {
    id: "exploration-heavy",
    trigger: triggerExplorationHeavy,
    severity: severityExplorationHeavy,
    message: messageExplorationHeavy,
    suggestion:
      "Lots of looking, little doing. After the second exploration pass, write the plan down and start editing; do not keep grepping. Prefer LSP for code-symbol lookups (see `docs/process/grep-guidance.md` in hero-crew); use Grep only for prose, configs, or regex hunts."
  },
  {
    id: "expensive-failure",
    trigger: triggerExpensiveFailure,
    severity: () => "high",
    message: messageExpensiveFailure,
    suggestion:
      "Mandate a written plan + brainstorming gate for similar slices before code is touched."
  },
  {
    id: "compaction-cascade",
    trigger: triggerCompactionCascade,
    severity: () => "high",
    message: messageCompactionCascade,
    suggestion:
      "Each subagent cold-starts the cache; the lead's context grows with each handoff read. Target ≤3 dispatches per slice. Bundle review + validation when scope is small. Write checkpoint handoffs at ≥3 compactions instead of dispatching more agents."
  },
  // ---- per-source / cross-repo rules ----
  {
    id: "xrepo-attribution",
    trigger: triggerXrepoAttribution,
    severity: () => "medium",
    message: messageXrepoAttribution,
    suggestion:
      "Re-run cost-slice with --aggregate-all to capture cross-repo spend, or pass --source-project explicitly if you know the right slug."
  },
  {
    id: "non-repo-dominant",
    trigger: triggerNonRepoDominant,
    severity: () => "medium",
    message: messageNonRepoDominant,
    suggestion:
      "Either work directly inside the repo's own Claude session, or move the work to its real home. Cross-repo work hides accountability and inflates the next session's context."
  },
  {
    id: "many-sources",
    trigger: triggerManySources,
    severity: severityManySources,
    message: messageManySources,
    suggestion:
      "Scope sessions per slice. Open one Claude Code session in the target repo and stay there until the slice closes."
  },
  // ---- Item 3: cache-priming rules (approximate signals) ----
  {
    id: "bash-bloat",
    trigger: triggerBashBloat,
    severity: severityBashBloat,
    message: messageBashBloat,
    suggestion:
      "Prefer Grep with head_limit, or pipe Bash through `| head -N`, or read a narrower file slice. Each broad Bash result is fresh cache_create on the next turn."
  },
  {
    id: "dead-weight-skill",
    trigger: triggerDeadWeightSkill,
    severity: () => "medium",
    message: messageDeadWeightSkill,
    suggestion:
      "Audit which skills auto-load. Heavy skills (caveman, crew, superpowers) inject 2-10KB of prose each — if they're not used in subsequent turns, disable autoload."
  }
];

export function applyRules(
  target: SummaryRecord,
  baseline: BaselineRecord,
  ctx: RuleContext = {}
): Finding[] {
  const fired: Finding[] = [];
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
