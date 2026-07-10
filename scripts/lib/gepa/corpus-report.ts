// corpus-report.ts — FEAT-193 S3 (report half): gepa-corpus-report.
//
// The analyze-before-adjust digest. Reads the dev-team hub trial corpus,
// clusters each agent's production-failure trials by failure mode (rationale),
// ranks clusters by frequency, and cites the matching FEAT-188 astramem
// lessons for the agent. A human reads this digest, THEN decides whether to
// run `gepa-optimize <agent>` — this module never invokes optimize or promotes
// anything (AC-9 human gate; the feed-to-optimize wiring is a separate,
// human-gated step held until the champion-provenance-writer blocker is fixed,
// AC-10).
//
// Marker discipline (same as corpus-sync): only trials with
// `input.capture_origin === "production_failure"` are counted — never `source`.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TrialSchema } from "@astragenie/gepa-core";
import type { Trial } from "@astragenie/gepa-core";

const TRIALS_SUBPATH = [".claude", "artifacts", "crew", "gepa", "trials"];
const PRODUCTION_FAILURE = "production_failure";
const DEFAULT_LESSON_K = 5;

export interface FailureCluster {
  /** Representative rationale (first-seen original casing). */
  rationale: string;
  /** How many failing trials share this normalized failure mode. */
  count: number;
}

export interface LessonCitation {
  id: string;
  summary: string;
}

export interface AgentReport {
  agent: string;
  totalFailures: number;
  /** Failure modes ranked by frequency (desc), then rationale (asc) for determinism. */
  clusters: FailureCluster[];
  /** FEAT-188 astramem lessons for this agent, cited by id (empty if provider absent). */
  lessons: LessonCitation[];
}

export interface CorpusReport {
  /** Every agent with >=1 production-failure trial (AC-7 completeness). */
  agents: AgentReport[];
}

/** Injectable lesson lookup so tests don't stand up a real astramem daemon. */
export type LessonRecall = (agent: string) => Promise<LessonCitation[]>;

export interface CorpusReportOptions {
  hubRepo: string;
  /** Scope to one agent; omit to report EVERY agent with failures (AC-7). */
  agent?: string;
  /** Override the astramem lesson lookup (AC-8). Defaults to the FEAT-188 provider. */
  recallLessons?: LessonRecall;
}

function trialsDir(repoRoot: string): string {
  return join(repoRoot, ...TRIALS_SUBPATH);
}

function isProductionFailure(trial: Trial): boolean {
  const input = trial.input as Record<string, unknown> | null | undefined;
  return !!input && input["capture_origin"] === PRODUCTION_FAILURE;
}

function rationaleOf(trial: Trial): string {
  const score = trial.score as { rationale?: unknown } | null | undefined;
  return typeof score?.rationale === "string" ? score.rationale : "";
}

/** Normalize a rationale into a clustering key (case/whitespace-insensitive). */
function clusterKey(rationale: string): string {
  return rationale.trim().toLowerCase().replace(/\s+/g, " ");
}

async function readTrials(file: string): Promise<Trial[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const out: Trial[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let json: unknown;
    try {
      json = JSON.parse(t);
    } catch {
      continue; // malformed JSON syntax — skip
    }
    const parsed = TrialSchema.safeParse(json); // skip schema-drifted rows
    if (parsed.success) out.push(parsed.data as Trial);
  }
  return out;
}

async function agentsInHub(hubRepo: string): Promise<string[]> {
  const dir = trialsDir(hubRepo);
  if (!existsSync(dir)) return [];
  try {
    return (await readdir(dir))
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.slice(0, -".jsonl".length));
  } catch {
    return [];
  }
}

/** Cluster an agent's production-failure trials by rationale, ranked by frequency. */
function clusterFailures(trials: Trial[]): { clusters: FailureCluster[]; total: number } {
  const buckets = new Map<string, { rationale: string; count: number }>();
  let total = 0;
  for (const trial of trials) {
    if (!isProductionFailure(trial)) continue;
    total += 1;
    const rationale = rationaleOf(trial);
    const key = clusterKey(rationale);
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { rationale, count: 1 });
  }
  const clusters = [...buckets.values()].sort(
    (a, b) => b.count - a.count || a.rationale.localeCompare(b.rationale)
  );
  return { clusters, total };
}

/** Default lesson recall — the FEAT-188 MemoryProvider, agent-scoped. Never throws. */
async function defaultRecallLessons(hubRepo: string, agent: string): Promise<LessonCitation[]> {
  try {
    const { resolveProvider } = await import("@astragenie/memory-provider");
    const { loadMemoryConfig } = await import("../memory/inject-recall.ts");
    const provider = resolveProvider(await loadMemoryConfig(hubRepo), hubRepo);
    const entries = await provider.recall({ agent, k: DEFAULT_LESSON_K });
    return entries.map((e) => ({ id: e.id, summary: e.summary }));
  } catch {
    return [];
  }
}

/**
 * Build the per-agent failure digest. Enumerates EVERY agent with >=1
 * production-failure trial when no `agent` is given (AC-7). Pure read + report:
 * never invokes gepa-optimize, never promotes (AC-9).
 */
export async function reportCorpus(options: CorpusReportOptions): Promise<CorpusReport> {
  const { hubRepo, agent } = options;
  const recall: LessonRecall = options.recallLessons ?? ((a) => defaultRecallLessons(hubRepo, a));

  const candidates = agent ? [agent] : await agentsInHub(hubRepo);
  const agents: AgentReport[] = [];

  for (const a of candidates) {
    const trials = await readTrials(join(trialsDir(hubRepo), `${a}.jsonl`));
    const { clusters, total } = clusterFailures(trials);
    if (total === 0) continue; // only agents WITH failures are enumerated (AC-7)
    agents.push({ agent: a, totalFailures: total, clusters, lessons: await recall(a) });
  }

  agents.sort((x, y) => y.totalFailures - x.totalFailures || x.agent.localeCompare(y.agent));
  return { agents };
}

export interface CorpusReportCmdResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** CLI entry (`crew gepa-corpus-report [<agent>] [--json]`). Never throws. */
export async function runCorpusReportCmd(
  repoPath: string,
  rawArgs: string[]
): Promise<CorpusReportCmdResult> {
  let asJson = false;
  let agent: string | undefined;
  for (const a of rawArgs) {
    if (a === "--json") asJson = true;
    else if (!a.startsWith("--")) agent = a;
  }

  let report: CorpusReport;
  try {
    report = await reportCorpus({ hubRepo: repoPath, ...(agent !== undefined ? { agent } : {}) });
  } catch (err) {
    return {
      stdout: "",
      stderr: `gepa-corpus-report failed: ${(err as Error).message}\n`,
      exitCode: 1
    };
  }

  if (asJson) return { stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: "", exitCode: 0 };

  if (report.agents.length === 0) {
    return {
      stdout: "gepa-corpus-report: no production-failure trials in the hub corpus.\n",
      stderr: "",
      exitCode: 0
    };
  }
  const lines: string[] = [`gepa-corpus-report: ${report.agents.length} agent(s) with failures\n`];
  for (const ar of report.agents) {
    lines.push(`## ${ar.agent} — ${ar.totalFailures} failure(s)`);
    for (const c of ar.clusters) lines.push(`  ${c.count}×  ${c.rationale}`);
    if (ar.lessons.length > 0) {
      lines.push(`  lessons (FEAT-188): ${ar.lessons.map((l) => l.id).join(", ")}`);
    }
    lines.push("");
  }
  lines.push("(read this, then decide: `crew gepa-optimize <agent>` — never auto-promoted)");
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}
