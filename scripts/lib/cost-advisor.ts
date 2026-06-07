import fs from "node:fs/promises";
import path from "node:path";
import { computeGrade, type GradeLetter } from "./cost-advisor-grades.ts";
import { applyRules, type SummaryRecord, type BaselineRecord, type Finding } from "./cost-advisor-rules.ts";

// Cost reports now land in cost/ (Item 1 split). Older reports may still
// live in the legacy runs/ dir, so loadReports scans both for backward compat.
const REPORTS_DIR_PARTS = [".claude", "artifacts", "crew", "cost"];
const LEGACY_REPORTS_DIR_PARTS = [".claude", "artifacts", "crew", "runs"];

// Re-export computeGrade so existing callers of cost-advisor.ts are unaffected.
export { computeGrade } from "./cost-advisor-grades.ts";

// ---- frontmatter + body parsers ----

function parseFrontmatter(text: string): {
  fm: Record<string, string | number> | null;
  body: string;
} {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { fm: null, body: text };
  const block = text.slice(3, end).trim();
  const body = text.slice(end + 4);
  const fm: Record<string, string | number> = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([\w_]+):\s*(.*)$/);
    if (!m) continue;
    let v: string | number = m[2]?.trim() ?? "";
    if (typeof v === "string" && v.startsWith('"') && v.endsWith('"')) {
      try {
        v = JSON.parse(v) as string;
      } catch {
        /* keep raw string on parse failure */
      }
    } else if (typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v)) {
      v = Number(v);
    }
    if (m[1] != null) fm[m[1]] = v;
  }
  return { fm, body };
}

function extractBodyMetric(body: string, label: string): string | null {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*(.+)$`, "m"));
  return m ? (m[1]?.trim() ?? null) : null;
}

function extractCounter(body: string, label: string): number {
  const m = body.match(new RegExp(`^-\\s+${label}:\\s*([\\d.,]+)`, "m"));
  return m ? Number(m[1]?.replace(/,/g, "")) : 0;
}

// ---- section parsers ----

interface ToolEntry {
  name: string;
  count: number;
  failures: number;
}

function extractToolUsage(body: string): ToolEntry[] {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Tool Usage"));
  if (!section) return [];
  const out: ToolEntry[] = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^-\s+([\w-]+):\s*([\d,]+)(?:\s*\((\d+)\s+failed\))?/);
    if (m && m[1] != null)
      out.push({
        name: m[1],
        count: Number(m[2]?.replace(/,/g, "")),
        failures: m[3] ? Number(m[3]) : 0
      });
  }
  return out;
}

interface ModelEntry {
  model: string;
  pricedAs: string;
  messages: number;
  msgPct: number;
  usd: number;
  usdPct: number;
}

function extractModelMix(body: string): ModelEntry[] {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Model Mix"));
  if (!section) return [];
  const out: ModelEntry[] = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+(\S+)\s+\(priced as\s+(\S+)\):\s*(\d+)\s+msgs\s+\(([\d.]+)%\),\s+\$([\d.]+)\s+\(([\d.]+)%\)/
    );
    if (m && m[1] != null && m[2] != null)
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

// ---- stat helpers ----

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0);
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

// ---- report loader ----

interface RawReport {
  path: string;
  fm: Record<string, string | number>;
  body: string;
}

async function collectReportFiles(
  dirs: string[],
  nameFilter: ((name: string) => boolean) | null
): Promise<Array<{ dir: string; name: string }>> {
  const files: Array<{ dir: string; name: string }> = [];
  for (const dir of dirs) {
    let entries: string[];
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
  return files;
}

async function parseReportFiles(
  top: Array<{ dir: string; name: string }>
): Promise<RawReport[]> {
  const reports: RawReport[] = [];
  for (const { dir, name } of top) {
    const f = path.join(dir, name);
    try {
      const text = await fs.readFile(f, "utf8");
      const { fm, body } = parseFrontmatter(text);
      reports.push({ path: f, fm: fm ?? {}, body });
    } catch {
      /* skip unreadable / malformed report files silently */
    }
  }
  return reports;
}

async function loadReports(
  repoPath: string,
  limit = 20,
  nameFilter: ((name: string) => boolean) | null = null
): Promise<RawReport[]> {
  const dirs = [
    path.join(repoPath, ...REPORTS_DIR_PARTS),
    path.join(repoPath, ...LEGACY_REPORTS_DIR_PARTS)
  ];
  const files = await collectReportFiles(dirs, nameFilter);
  files.sort((a, b) => b.name.localeCompare(a.name));
  return parseReportFiles(files.slice(0, limit));
}

// ---- cache-priming + sources parsers ----

interface CachePrimingEntry {
  name: string;
  calls: number;
  resultBytes: number;
  cacheCreateTokens: number;
  ratio: number | null;
}

function extractCachePriming(body: string): CachePrimingEntry[] {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Cache Priming"));
  if (!section) return [];
  const out: CachePrimingEntry[] = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(
      /^-\s+([\w-]+):\s+(\d+)\s+calls,\s+([\d,]+)B\s+results,\s+~([\d,]+)\s+cache_create\s+tok\s+\(([\d.]+|—)/
    );
    if (m && m[1] != null) {
      const ratio = m[5] === "—" ? null : Number(m[5]);
      out.push({
        name: m[1],
        calls: Number(m[2]),
        resultBytes: Number(m[3]?.replace(/,/g, "")),
        cacheCreateTokens: Number(m[4]?.replace(/,/g, "")),
        ratio
      });
    }
  }
  return out;
}

interface SourceEntry {
  slug: string;
  messages: number;
  usd: number;
}

function extractSources(body: string): SourceEntry[] {
  const section = body.split(/^##\s+/m).find((s) => s.startsWith("Sources"));
  if (!section) return [];
  const out: SourceEntry[] = [];
  for (const line of section.split(/\r?\n/)) {
    const m = line.match(/^-\s+(\S+):\s*(\d+)\s+msgs,\s+\$([\d.]+)/);
    if (m && m[1] != null) out.push({ slug: m[1], messages: Number(m[2]), usd: Number(m[3]) });
  }
  return out;
}

function repoOwnSlug(repoPath: string | null | undefined): string | null {
  if (!repoPath) return null;
  return repoPath.replace(/[^A-Za-z0-9]/g, "-");
}

// ---- tool-stat helpers ----

function toolCount(tools: ToolEntry[], name: string): number {
  return tools.find((t) => t.name === name)?.count ?? 0;
}

function computeExplorationRatio(tools: ToolEntry[]): number {
  const exploration =
    toolCount(tools, "Read") + toolCount(tools, "Grep") + toolCount(tools, "Bash");
  const execution = toolCount(tools, "Write") + toolCount(tools, "Edit");
  if (execution > 0) return exploration / execution;
  return exploration > 0 ? Infinity : 0;
}

function summarizeToolStats(body: string): {
  totalToolCalls: number;
  totalToolFailures: number;
  toolFailureRate: number;
  readCount: number;
  bashCount: number;
  grepCount: number;
  writeCount: number;
  editCount: number;
  explorationRatio: number;
} {
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

// ---- report summarizer ----

function extractFmFields(
  r: RawReport
): Pick<
  SummaryRecord,
  | "path" | "sliceId" | "usd" | "durationMs" | "totalTokens" | "cacheHitPct"
  | "gradeAvg" | "reviewDecision" | "validationDecision" | "sourceProject"
  | "autoDetected" | "aggregateAll" | "sourceCount"
> {
  return {
    path: r.path,
    sliceId: r.fm["slice"] ?? null,
    usd: Number(r.fm["usd"]) || 0,
    durationMs: Number(r.fm["duration_ms"]) || 0,
    totalTokens: Number(r.fm["total_tokens"]) || 0,
    cacheHitPct: Number(r.fm["cache_hit_pct"]) || 0,
    gradeAvg: r.fm["grade_avg"] != null ? Number(r.fm["grade_avg"]) : null,
    reviewDecision: r.fm["review_decision"] ?? null,
    validationDecision: r.fm["validation_decision"] ?? null,
    sourceProject: r.fm["source_project"] ?? null,
    autoDetected: String(r.fm["auto_detected"] ?? "").toLowerCase() === "true",
    aggregateAll: String(r.fm["aggregate_all"] ?? "").toLowerCase() === "true",
    sourceCount: r.fm["source_count"] ? Number(r.fm["source_count"]) : 0
  };
}

function summarizeReport(r: RawReport): SummaryRecord {
  const body = r.body;
  const opusShare = extractModelMix(body)
    .filter((m) => /opus/i.test(m.model))
    .reduce((a, b) => a + b.usdPct, 0);
  const tool = summarizeToolStats(body);
  return {
    ...extractFmFields(r),
    runTitle: r.fm["run_title"] ?? extractBodyMetric(body, "Run Title"),
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
    sources: extractSources(body),
    cachePriming: extractCachePriming(body)
  };
}

// ---- trend detection ----

function checkCompactionDrift(r0: SummaryRecord, r1: SummaryRecord, r2: SummaryRecord): Finding | null {
  if (!(r0.compactionCount > r1.compactionCount && r1.compactionCount > r2.compactionCount)) return null;
  return {
    id: "compaction-drift",
    severity: "medium",
    message: `Compaction count has increased across the last 3 slices: ${r2.compactionCount} → ${r1.compactionCount} → ${r0.compactionCount}. Context window pressure is growing.`,
    suggestion:
      "Split work into smaller slices and write checkpoint handoffs earlier. If compaction hit once, treat it as a budget warning and wrap up that slice."
  };
}

function checkSubagentCreep(r0: SummaryRecord, r1: SummaryRecord, r2: SummaryRecord): Finding | null {
  if (!(r0.subagentDispatches > r1.subagentDispatches && r1.subagentDispatches > r2.subagentDispatches)) return null;
  return {
    id: "subagent-creep",
    severity: "medium",
    message: `Subagent dispatch count has grown across the last 3 slices: ${r2.subagentDispatches} → ${r1.subagentDispatches} → ${r0.subagentDispatches}. Each cold-start re-derives session context.`,
    suggestion:
      "Bundle review + validation into a single subagent when scope is small. Reserve parallel dispatches for genuinely independent parallel work."
  };
}

function checkCostRegression(r0: SummaryRecord, r1: SummaryRecord, r2: SummaryRecord): Finding | null {
  const med = median([r0.usd, r1.usd, r2.usd]);
  if (!(med > 0 && r0.usd > med * 1.2)) return null;
  const pctAbove = (((r0.usd - med) / med) * 100).toFixed(0);
  return {
    id: "cost-regression",
    severity: "high",
    message: `Current slice cost $${r0.usd.toFixed(4)} is ${pctAbove}% above the last-3 median of $${med.toFixed(4)}.`,
    suggestion:
      "Audit what drove the spike: Opus usage, subagent cold-starts, cache busts, or long exploration loops. Mandate Sonnet-default and a written plan before the next similar slice."
  };
}

/**
 * Detect regression trends by comparing the last 3 summarized reports.
 * Reports are expected newest-first (same order as loadReports / summaries).
 */
export function detectTrends(reports: SummaryRecord[]): Finding[] {
  if (!reports || reports.length < 3) return [];
  const r0 = reports[0];
  const r1 = reports[1];
  const r2 = reports[2];
  if (r0 == null || r1 == null || r2 == null) return [];
  const findings: Finding[] = [];
  const compaction = checkCompactionDrift(r0, r1, r2);
  if (compaction) findings.push(compaction);
  const subagent = checkSubagentCreep(r0, r1, r2);
  if (subagent) findings.push(subagent);
  const costReg = checkCostRegression(r0, r1, r2);
  if (costReg) findings.push(costReg);
  return findings;
}

// ---- public API ----

export interface CostAdvisorResult {
  reports: SummaryRecord[];
  target: SummaryRecord | null;
  baseline: BaselineRecord | null;
  recommendations: Finding[];
  aggregateFlags?: Finding[];
  grade?: GradeLetter;
}

function buildBaseline(history: SummaryRecord[]): BaselineRecord {
  const usds = history.map((s) => s.usd).filter((v) => v > 0);
  const cacheHits = history.map((s) => s.cacheHitPct).filter((v) => v > 0);
  const opusShares = history.map((s) => s.opusUsdPct);
  return {
    n: history.length,
    usdMedian: median(usds),
    usdP75: percentile(usds, 75),
    cacheHitMedian: median(cacheHits),
    opusShareMedian: median(opusShares)
  };
}

function buildAggregateFlags(summaries: SummaryRecord[], baseline: BaselineRecord): Finding[] {
  const flags: Finding[] = [...detectTrends(summaries)];
  if (baseline.n >= 3 && baseline.cacheHitMedian > 0 && baseline.cacheHitMedian < 90) {
    flags.push({
      id: "trend-cache",
      severity: "medium",
      message: `Median cache hit across recent slices is ${baseline.cacheHitMedian.toFixed(1)}%.`,
      suggestion:
        "Recurring cache-bust pattern. Audit the workflow for steps that always inject fresh large content (e.g. broad Bash output before each Edit)."
    });
  }
  if (baseline.n >= 3 && baseline.opusShareMedian > 40) {
    flags.push({
      id: "trend-opus",
      severity: "medium",
      message: `Median Opus $ share is ${baseline.opusShareMedian.toFixed(1)}% across recent slices.`,
      suggestion:
        "Default to Sonnet; promote to Opus only on slice-start when the problem is design-shaped."
    });
  }
  return flags;
}

export async function buildCostAdvisor(
  repoPath: string,
  { limit = 10, nameFilter = null }: { limit?: number; nameFilter?: ((name: string) => boolean) | null } = {}
): Promise<CostAdvisorResult> {
  const reports = await loadReports(repoPath, limit, nameFilter);
  if (reports.length === 0) {
    return { reports: [], target: null, baseline: null, recommendations: [] };
  }
  const summaries = reports.map(summarizeReport);
  const target = summaries[0] as SummaryRecord;
  const baseline = buildBaseline(summaries.slice(1));
  const slug = repoOwnSlug(repoPath);
  const recommendations = applyRules(target, baseline, ...(slug != null ? [{ repoOwnSlug: slug }] : [{}]));
  const grade = computeGrade(target);
  const aggregateFlags = buildAggregateFlags(summaries, baseline);
  return { reports: summaries, target, baseline, recommendations, aggregateFlags, grade };
}

function renderFindingsSection(title: string, findings: Finding[]): string[] {
  const lines: string[] = [title];
  if (findings.length === 0) {
    lines.push("- No rules fired. This slice is within healthy bounds.");
    return lines;
  }
  for (const r of findings) {
    lines.push(`### [${r.severity.toUpperCase()}] ${r.id}`);
    lines.push(`- ${r.message}`);
    lines.push(`- **Suggested action:** ${r.suggestion}`);
    lines.push("");
  }
  return lines;
}

function renderTargetHeader(advisor: CostAdvisorResult): string[] {
  const lines: string[] = [];
  const t = advisor.target!;
  if (advisor.grade) lines.push(`## Performance Grade: ${advisor.grade}`, "");
  lines.push(`Target slice: **${t.sliceId ?? t.runTitle ?? "?"}**`);
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
  return lines;
}

export function renderCostAdvisorMarkdown(advisor: CostAdvisorResult): string {
  const lines: string[] = ["# Cost Advisor", ""];
  if (!advisor.target) {
    lines.push("- No cost reports found. Run cost-slice first.");
    return lines.join("\n");
  }
  lines.push(...renderTargetHeader(advisor));
  lines.push(...renderFindingsSection("## Per-slice findings", advisor.recommendations));
  if (advisor.aggregateFlags?.length) {
    lines.push(...renderFindingsSection("## Cross-slice trends", advisor.aggregateFlags));
  }
  return lines.join("\n");
}
