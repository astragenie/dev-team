// Internal cost-report parsing helpers extracted from collect.mjs.
// All functions here are used by collectRecentCosts in collect.mjs.

export interface ModelMixEntry {
  model: string;
  messages: number;
  msgPct: number;
  usd: number;
  usdPct: number;
}

export interface DominantModel {
  model: string;
  pct: number;
}

export interface DeriveMetrics {
  compactionCount: number;
  subagentDispatches: number;
  fileReReadCount: number;
  toolFailures: number;
  toolResultP90: number;
  turnsBeforeFirstTool: number;
  gradeAvg: number | null;
  reviewDecision: string | null;
  validationDecision: string | null;
  autoDetected: boolean;
  sourceProject: string | null;
  aggregateAll: boolean;
  sourceCount: number;
}

export function parseFrontmatterBlock(text: string): Record<string, string> {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  const fm: Record<string, string> = {};
  if (match) {
    for (const line of match[1]!.split(/\r?\n/)) {
      const kv = line.match(/^([\w_]+):\s*(.*)$/);
      if (kv) fm[kv[1]!] = kv[2]!.trim();
    }
  }
  return fm;
}

export function parseModelMix(text: string): ModelMixEntry[] {
  const out: ModelMixEntry[] = [];
  const section = text.split(/^##\s+/m).find((s: string) => s.startsWith("Model Mix"));
  if (!section) return out;
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+(\S+)\s+\(priced as\s+\S+\):\s+(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/
    );
    if (m)
      out.push({
        model: m[1]!,
        messages: Number(m[2]),
        msgPct: Number(m[3]),
        usd: Number(m[4]),
        usdPct: Number(m[5])
      });
  }
  return out;
}

export function parseToolUsage(text: string): { toolCalls: number; toolFailures: number } {
  let toolCalls = 0;
  let toolFailures = 0;
  const section = text.split(/^##\s+/m).find((s: string) => s.startsWith("Tool Usage"));
  if (section) {
    for (const line of section.split(/\r?\n/)) {
      const m = line.match(/^-\s+\S+:\s*([\d,]+)(?:\s*\((\d+)\s+failed\))?/);
      if (m) {
        toolCalls += Number(m[1]!.replace(/,/g, ""));
        if (m[2]) toolFailures += Number(m[2]);
      }
    }
  }
  return { toolCalls, toolFailures };
}

export function computeDominantModel(modelMix: ModelMixEntry[]): DominantModel | null {
  const dominantEntry =
    modelMix.find((m: ModelMixEntry) => !/^<|unknown/i.test(m.model)) || modelMix[0] || null;
  if (!dominantEntry) return null;
  return { model: dominantEntry.model, pct: dominantEntry.msgPct };
}

export function deriveFlags(metrics: DeriveMetrics): string[] {
  const flags: string[] = [];
  if (metrics.compactionCount > 0) flags.push(`compact:${metrics.compactionCount}`);
  if (metrics.subagentDispatches > 3) flags.push(`subagent:${metrics.subagentDispatches}`);
  if (metrics.fileReReadCount > 5) flags.push(`reread:${metrics.fileReReadCount}`);
  if (metrics.toolFailures > 3) flags.push(`fails:${metrics.toolFailures}`);
  if (metrics.toolResultP90 > 8000) flags.push(`p90:${metrics.toolResultP90}b`);
  if (metrics.turnsBeforeFirstTool > 5) flags.push(`preamble:${metrics.turnsBeforeFirstTool}`);
  if (metrics.gradeAvg != null && metrics.gradeAvg < 0.75) flags.push(`grade:${metrics.gradeAvg}`);
  if (metrics.reviewDecision === "rejected") flags.push("review:rejected");
  if (metrics.validationDecision === "failed") flags.push("validation:failed");
  if (metrics.autoDetected && metrics.sourceProject) flags.push(`xrepo:${metrics.sourceProject}`);
  if (metrics.aggregateAll && metrics.sourceCount > 1)
    flags.push(`multi-src:${metrics.sourceCount}`);
  return flags;
}

export function bodyNum(text: string, re: RegExp): number {
  return Number(text.match(re)?.[1]?.replace(/,/g, "") || 0);
}

// Header/window fields. Frontmatter wins when present; falls through to
// body markdown patterns for pre-frontmatter cost-reports.
export function parseRunTitle(text: string, fm: Record<string, string>): string | null {
  const raw = fm["run_title"] ?? text.match(/^- Run Title:\s*(.+)$/m)?.[1] ?? "";
  const stripped = raw.replace(/^"|"$/g, "").trim();
  return stripped || null;
}

export function parseUsd(text: string, fm: Record<string, string>): number | null {
  if (fm["usd"] != null) return Number(fm["usd"]);
  const fromBody = Number(text.match(/^- Total USD:\s*\$([\d.]+)/m)?.[1] || 0);
  return fromBody || null;
}

export function parseDurationMs(
  fm: Record<string, string>,
  windowStart: string | null,
  windowEnd: string | null
): number {
  if (fm["duration_ms"]) return Number(fm["duration_ms"]);
  if (windowStart && windowEnd) return Date.parse(windowEnd) - Date.parse(windowStart);
  return 0;
}

export function parseHeaderFields(
  text: string,
  fm: Record<string, string>
): {
  runTitle: string | null;
  usd: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  durationMs: number;
} {
  const windowStart = text.match(/^- Window Start:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const windowEnd = text.match(/^- Window End:\s*(.+)$/m)?.[1]?.trim() ?? null;
  return {
    runTitle: parseRunTitle(text, fm),
    usd: parseUsd(text, fm),
    windowStart,
    windowEnd,
    durationMs: parseDurationMs(fm, windowStart, windowEnd)
  };
}

export function parseTokenFields(
  text: string,
  fm: Record<string, string>
): {
  totalTokens: number;
  cacheHitPct: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} {
  const totalTokens = fm["total_tokens"]
    ? Number(fm["total_tokens"])
    : bodyNum(text, /^- Total Tokens:\s*([\d,]+)/m);
  const cacheHitPct = fm["cache_hit_pct"]
    ? Number(fm["cache_hit_pct"])
    : Number(text.match(/^- Cache Hit %:\s*([\d.]+)/m)?.[1] || 0);
  const inputTokens = bodyNum(text, /^- input:\s*([\d,]+)/m);
  const outputTokens = bodyNum(text, /^- output:\s*([\d,]+)/m);
  const cacheReadTokens = bodyNum(text, /^- cache_read:\s*([\d,]+)/m);
  const cacheCreate1h = bodyNum(text, /^- cache_create_1h:\s*([\d,]+)/m);
  const cacheCreate5m = bodyNum(text, /^- cache_create_5m:\s*([\d,]+)/m);
  return {
    totalTokens,
    cacheHitPct,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens: cacheCreate5m + cacheCreate1h
  };
}

/**
 * Parse the subagent_dispatches_by_role block from cost-report text.
 * Handles two layouts:
 *  (a) inside ## Conversation Shape — rendered by renderCostReportConversation
 *  (b) inside ## Subagent Role Breakdown — used by test helpers and legacy variants
 *
 * Both emit lines of the form:
 *   - subagent_dispatches_by_role:
 *     - <role>: <count>
 */
export function parseRoleDispatches(text: string): Record<string, number> {
  // Find the start of the subagent_dispatches_by_role key anywhere in the text.
  const keyIdx = text.indexOf("- subagent_dispatches_by_role:");
  if (keyIdx === -1) return {};

  const out: Record<string, number> = {};
  // Walk lines after the key, collecting indented "  - role: count" entries.
  // Role names may contain colons (e.g. "crew:builder"), so match the LAST
  // ": <digits>" segment to split role from count.
  const afterKey = text.slice(keyIdx + 1);
  for (const line of afterKey.split(/\r?\n/)) {
    const m = line.match(/^\s{2,}-\s+(.+):\s*(\d+)\s*$/);
    if (m) {
      out[m[1]!.trim()] = Number(m[2]);
    } else if (line.match(/^-\s+\S/) || line.match(/^##/)) {
      // Hit a sibling bullet or a new section — stop collecting.
      break;
    }
  }
  return out;
}

export function parseDiagnosticFields(text: string): {
  compactionCount: number;
  subagentDispatches: number;
  skillInvocations: number;
  turnsBeforeFirstTool: number;
  userMsgAvgLen: number;
  fileReReadCount: number;
  sessionsScanned: number;
  toolResultP90: number;
  messages: number;
  roleDispatches: Record<string, number>;
} {
  return {
    compactionCount: bodyNum(text, /^- compaction_count:\s*(\d+)/m),
    subagentDispatches: bodyNum(text, /^- subagent_dispatches:\s*(\d+)/m),
    skillInvocations: bodyNum(text, /^- skill_invocations:\s*(\d+)/m),
    turnsBeforeFirstTool: bodyNum(text, /^- turns_before_first_tool:\s*(\d+)/m),
    userMsgAvgLen: bodyNum(text, /^- user_msg_avg_len:\s*(\d+)/m),
    fileReReadCount: bodyNum(text, /^- redundant_read_count:\s*(\d+)/m),
    sessionsScanned: bodyNum(text, /^- Sessions Scanned:\s*(\d+)/m),
    toolResultP90: bodyNum(text, /##\s+Tool Result Sizes[\s\S]*?-\s+p90:\s*([\d,]+)/),
    messages: Number(text.match(/^- Assistant Messages Counted:\s*(\d+)/m)?.[1] || 0),
    roleDispatches: parseRoleDispatches(text)
  };
}

export function parseOutcomeFields(fm: Record<string, string>): {
  gradeAvg: number | null;
  reviewDecision: string | null;
  validationDecision: string | null;
  sourceProject: string | null;
  autoDetected: boolean;
  aggregateAll: boolean;
  sourceCount: number;
} {
  return {
    gradeAvg: fm["grade_avg"] != null ? Number(fm["grade_avg"]) : null,
    reviewDecision: fm["review_decision"] ?? null,
    validationDecision: fm["validation_decision"] ?? null,
    sourceProject: fm["source_project"] ?? null,
    autoDetected: String(fm["auto_detected"] ?? "").toLowerCase() === "true",
    aggregateAll: String(fm["aggregate_all"] ?? "").toLowerCase() === "true",
    sourceCount: fm["source_count"] ? Number(fm["source_count"]) : 0
  };
}

export function parseCostReportText(filePath: string, text: string) {
  const fm = parseFrontmatterBlock(text);
  const header = parseHeaderFields(text, fm);
  const tokens = parseTokenFields(text, fm);
  const diag = parseDiagnosticFields(text);
  const outcome = parseOutcomeFields(fm);
  const modelMix = parseModelMix(text);
  const dominantModel = computeDominantModel(modelMix);
  const { toolCalls, toolFailures } = parseToolUsage(text);
  const toolFailureRate = toolCalls > 0 ? Number(((toolFailures / toolCalls) * 100).toFixed(1)) : 0;

  const toM = (n: number) => Number((n / 1_000_000).toFixed(3));
  const inputM = toM(tokens.inputTokens);
  const outputM = toM(tokens.outputTokens);
  const cacheReadM = toM(tokens.cacheReadTokens);
  const cacheWriteM = toM(tokens.cacheWriteTokens);

  const { runTitle, usd, windowStart, windowEnd, durationMs } = header;
  const {
    compactionCount,
    subagentDispatches,
    skillInvocations,
    turnsBeforeFirstTool,
    userMsgAvgLen,
    fileReReadCount,
    sessionsScanned,
    toolResultP90,
    messages,
    roleDispatches
  } = diag;
  const {
    gradeAvg,
    reviewDecision,
    validationDecision,
    sourceProject,
    autoDetected,
    aggregateAll,
    sourceCount
  } = outcome;
  const { totalTokens, cacheHitPct, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } =
    tokens;

  const flags = deriveFlags({
    compactionCount,
    subagentDispatches,
    fileReReadCount,
    toolFailures,
    toolResultP90,
    turnsBeforeFirstTool,
    gradeAvg,
    reviewDecision,
    validationDecision,
    autoDetected,
    sourceProject,
    aggregateAll,
    sourceCount
  });

  return {
    path: filePath,
    runTitle,
    usd,
    windowStart,
    windowEnd,
    durationMs,
    durationMin: durationMs ? Number((durationMs / 60000).toFixed(1)) : 0,
    messages,
    totalTokens,
    totalMillions: toM(totalTokens),
    cacheHitPct,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    inputMillions: inputM,
    outputMillions: outputM,
    cacheReadMillions: cacheReadM,
    cacheWriteMillions: cacheWriteM,
    ioMillionsStr: `${inputM} / ${outputM}`,
    cacheRWMillionsStr: `${cacheReadM} / ${cacheWriteM}`,
    dominantModel,
    dominantModelStr: dominantModel ? `${dominantModel.model} ${dominantModel.pct}%` : "-",
    modelMix,
    compactionCount,
    subagentDispatches,
    skillInvocations,
    turnsBeforeFirstTool,
    userMsgAvgLen,
    sourceProject,
    autoDetected,
    aggregateAll,
    sourceCount,
    fileReReadCount,
    sessionsScanned,
    toolCalls,
    toolFailures,
    toolFailureRate,
    toolResultP90,
    gradeAvg,
    reviewDecision,
    validationDecision,
    roleDispatches,
    flags,
    flagsStr: flags.join(" / "),
    hasFlags: flags.length > 0
  };
}

export type CostReport = ReturnType<typeof parseCostReportText>;

/**
 * Deduplicate a list of parsed cost reports so that the rollup summary
 * (sumUsdRecent, avgUsdRecent, modelBurn) does not double-count overlapping
 * windows.
 *
 * Reports array should be newest-first.
 */
export function dedupeForRollup(reports: CostReport[]): CostReport[] {
  // Step 1 — bucket by exact (windowStart, windowEnd).
  const bucketWinner = new Map<string, CostReport>();

  for (const r of reports) {
    const key = `${r.windowStart ?? ""}|${r.windowEnd ?? ""}`;
    const existing = bucketWinner.get(key);
    if (!existing) {
      bucketWinner.set(key, r);
    } else {
      // Upgrade to aggregate if the current winner is not one yet.
      if (!existing.aggregateAll && r.aggregateAll) {
        bucketWinner.set(key, r);
      }
      // Among two aggregates or two slices, keep the already-stored one
      // (reports array is newest-first, so first encountered = newest).
    }
  }

  const winners = Array.from(bucketWinner.values());

  // Step 2 — collect aggregate windows so we can omit fully-contained slices.
  const aggregateWindows = winners
    .filter((r) => r.aggregateAll && r.windowStart && r.windowEnd)
    .map((r) => ({ start: Date.parse(r.windowStart!), end: Date.parse(r.windowEnd!) }));

  function isContainedInAggregate(r: CostReport): boolean {
    if (r.aggregateAll) return false; // aggregates are never dropped for containment
    if (!r.windowStart || !r.windowEnd) return false;
    const rStart = Date.parse(r.windowStart);
    const rEnd = Date.parse(r.windowEnd);
    return aggregateWindows.some((aw) => rStart >= aw.start && rEnd <= aw.end);
  }

  return winners.filter((r) => !isContainedInAggregate(r));
}

/**
 * Aggregate subagent role dispatch counts across a set of cost reports.
 */
export function aggregateRoleDispatches(reports: CostReport[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reports) {
    if (!r.roleDispatches) continue;
    for (const [role, count] of Object.entries(r.roleDispatches)) {
      out[role] = (out[role] ?? 0) + count;
    }
  }
  return out;
}
