// agent-stats-aggregator.ts — Per-agent rolling stats over Phase 1 telemetry (FEAT-159).
// Reuses JSONL reader pattern from dispatch-timing-reader.ts.
import fs from "node:fs/promises";
import path from "node:path";
import { type DispatchRow } from "./dispatch-timing-reader.ts";

export type WindowSpec = { kind: "last_n_slices"; n: number };

export type AgentStatsRow = {
  agent: string;
  window: string;
  sample_count: number;
  pass_rate: number;
  mean_wall_ms: number;
  mean_tokens: number;
  review_rework_rate: number;
  validation_fail_rate: number;
  median_dispatches_to_pass: number;
};

type GradeRecord = { slice: string; graded_at: string; scores?: Record<string, number> };
type ArtifactDecision = { slice: string | null; decision: string };
export type AggregateOpts = {
  repo: string;
  window: WindowSpec;
  agents?: string[];
  dispatchTimingPath?: string;
  grades?: GradeRecord[];
  reviewsDir?: string;
  validationsDir?: string;
};

// ── JSONL reader ──────────────────────────────────────────────────────────────

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  let raw = "";
  try { raw = await fs.readFile(filePath, "utf-8"); } catch { return []; }
  return raw.split("\n").filter(Boolean).flatMap((line) => {
    // Caller-owned format; Zod validation deferred to boundary consumer (see AggregateOpts.dispatchTimingPath).
    try { return [JSON.parse(line) as T]; } catch { return []; }
  });
}

// ── Frontmatter helpers ───────────────────────────────────────────────────────

function extractFm(md: string): string | null {
  return /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? null;
}

function parseKv(line: string): [string, string] | null {
  const m = /^(\w+):\s*(.+)$/.exec(line);
  const k = m?.[1]; const v = m?.[2];
  return k && v !== undefined ? [k, v.replace(/^["']|["']$/g, "")] : null;
}

function parseScore(line: string): [string, number] | null {
  const m = /^\s{2}(\w+):\s*([\d.]+)/.exec(line);
  const k = m?.[1]; const v = m?.[2];
  return k && v ? [k, parseFloat(v)] : null;
}

function processFmLine(
  line: string, result: Record<string, unknown>, scoreMap: Record<string, number>, inS: boolean
): boolean {
  if (line.startsWith("scores:")) return true;
  if (inS) {
    const s = parseScore(line);
    if (s) { scoreMap[s[0]] = s[1]; return true; }
    return false;
  }
  const kv = parseKv(line);
  if (kv) result[kv[0]] = kv[1];
  return false;
}

function parseFm(md: string): Record<string, unknown> | null {
  const body = extractFm(md);
  if (!body) return null;
  const result: Record<string, unknown> = {};
  const scoreMap: Record<string, number> = {};
  let inS = false;
  for (const line of body.split("\n")) inS = processFmLine(line, result, scoreMap, inS);
  if (Object.keys(scoreMap).length > 0) result["scores"] = scoreMap;
  return result;
}

// ── Grade loader ──────────────────────────────────────────────────────────────

async function loadGrades(repo: string): Promise<GradeRecord[]> {
  const dir = path.join(repo, ".claude", "artifacts", "loop", "grades");
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); } catch { return []; }
  const grades: GradeRecord[] = [];
  for (const e of entries) {
    if (!e.endsWith(".md")) continue;
    let c = "";
    try { c = await fs.readFile(path.join(dir, e), "utf-8"); } catch { continue; }
    const g = parseFm(c);
    if (
      g?.["slice"] &&
      g?.["graded_at"] &&
      (g["scores"] === undefined || (typeof g["scores"] === "object" && g["scores"] !== null))
    ) {
      grades.push(g as unknown as GradeRecord);
    }
  }
  return grades;
}

function avgScores(s?: Record<string, number>): number {
  if (!s) return 0;
  const v = Object.values(s);
  return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length;
}

// ── Artifact decision scanner ─────────────────────────────────────────────────

function fmDecision(body: string): string | null {
  for (const line of body.split("\n")) {
    const m = /^verdict:\s*(.+)$/i.exec(line);
    if (m?.[1]) return m[1].trim();
    const m2 = /^decision:\s*(.+)$/i.exec(line);
    if (m2?.[1]) return m2[1].trim();
  }
  return null;
}

function parseAD(content: string): ArtifactDecision {
  const body = extractFm(content);
  const dec = (body ? fmDecision(body) : null)
    ?? (/^-\s*Decision:\s*(.+)$/im.exec(content)?.[1]?.trim() ?? "");
  const sliceId = body
    ? (/^slice:\s*(.+)$/.exec(body.split("\n").find((l) => /^slice:/.test(l)) ?? "")?.[1]?.trim() ?? null)
    : null;
  return { slice: sliceId, decision: dec };
}

async function scanArtifacts(dir: string): Promise<ArtifactDecision[]> {
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); } catch { return []; }
  const out: ArtifactDecision[] = [];
  for (const e of entries) {
    if (!e.endsWith(".md")) continue;
    let c = "";
    try { c = await fs.readFile(path.join(dir, e), "utf-8"); } catch { continue; }
    out.push(parseAD(c));
  }
  return out;
}

// ── Window / math ─────────────────────────────────────────────────────────────

export function windowSlug(w: WindowSpec): string { return `${w.kind}_${w.n}`; }

function selectWindow(grades: GradeRecord[], w: WindowSpec): Set<string> {
  return new Set(
    [...grades].sort((a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime())
      .slice(0, w.n).map((g) => g.slice)
  );
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

// ── Row computation ───────────────────────────────────────────────────────────

function computeRow(
  agent: string, rows: DispatchRow[], w: WindowSpec,
  grades: Map<string, number>, rework: Set<string>, fail: Set<string>
): AgentStatsRow {
  const slices = new Set(rows.map((r) => r.sliceId).filter((s): s is string => s != null));
  const n = rows.length; const sn = slices.size;
  const passCount = [...slices].filter((s) => (grades.get(s) ?? 0) >= 0.7).length;
  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    agent,
    window: windowSlug(w),
    sample_count: n,
    pass_rate: round3(sn > 0 ? passCount / sn : 0),
    mean_wall_ms: Math.round(n > 0 ? rows.reduce((a, r) => a + (r.wallMs ?? 0), 0) / n : 0),
    mean_tokens: Math.round(n > 0 ? rows.reduce((a, r) => a + (r.tokenIn ?? 0) + (r.tokenOut ?? 0), 0) / n : 0),
    review_rework_rate: round3(sn > 0 ? [...slices].filter((s) => rework.has(s)).length / sn : 0),
    validation_fail_rate: round3(sn > 0 ? [...slices].filter((s) => fail.has(s)).length / sn : 0),
    median_dispatches_to_pass: median([...slices].map((s) => rows.filter((r) => r.sliceId === s).length))
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

function hasSlice(a: ArtifactDecision): a is ArtifactDecision & { slice: string } {
  return a.slice !== null;
}
function decisionSet(ads: ArtifactDecision[], ws: Set<string>, re: RegExp): Set<string> {
  return new Set(ads.filter(hasSlice).filter((a) => ws.has(a.slice) && re.test(a.decision)).map((a) => a.slice));
}

function groupRows(rows: DispatchRow[]): Map<string, DispatchRow[]> {
  const m = new Map<string, DispatchRow[]>();
  for (const r of rows) { const ex = m.get(r.agent); if (ex) ex.push(r); else m.set(r.agent, [r]); }
  return m;
}

export async function aggregateAgentStats(opts: AggregateOpts): Promise<AgentStatsRow[]> {
  const { window: w, agents } = opts;
  const grades = opts.grades ?? (await loadGrades(opts.repo));
  const ws = selectWindow(grades, w);
  if (!ws.size) return [];

  const gradeMap = new Map(grades.filter((g) => ws.has(g.slice)).map((g) => [g.slice, avgScores(g.scores)]));
  const [allRows, revs, vals] = await Promise.all([
    readJsonlFile<DispatchRow>(opts.dispatchTimingPath ?? path.join(opts.repo, ".claude", "logs", "dispatch-timing.jsonl")),
    scanArtifacts(opts.reviewsDir ?? path.join(opts.repo, ".claude", "artifacts", "crew", "reviews")),
    scanArtifacts(opts.validationsDir ?? path.join(opts.repo, ".claude", "artifacts", "crew", "validations"))
  ]);

  const byAgent = groupRows(allRows.filter((r) => r.sliceId != null && ws.has(r.sliceId)));
  const rework = decisionSet(revs, ws, /needs.?fix/i);
  const fail = decisionSet(vals, ws, /fail/i);
  const af = agents?.length ? new Set(agents) : null;
  const out: AgentStatsRow[] = [];
  for (const [a, ar] of byAgent) {
    if (!af || af.has(a)) out.push(computeRow(a, ar, w, gradeMap, rework, fail));
  }
  return out.sort((a, b) => a.agent.localeCompare(b.agent));
}

export async function writeAgentStatsArtifact(
  repo: string, rows: AgentStatsRow[], window: WindowSpec
): Promise<string> {
  const dir = path.join(repo, ".claude", "artifacts", "crew", "agent-stats");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const fp = path.join(dir, `${stamp}-agent-stats-${windowSlug(window)}.json`);
  await fs.writeFile(fp, JSON.stringify({ generated_at: new Date().toISOString(), window: { kind: window.kind, n: window.n }, rows }, null, 2) + "\n");
  return fp;
}
