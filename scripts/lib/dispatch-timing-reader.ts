// dispatch-timing-reader.ts — Aggregators for per-dispatch and bash-gate telemetry (FEAT-151).
// Reads from dispatch-timing.jsonl (FEAT-149) and bash-gates.jsonl (FEAT-150).
// Phase 1 final FEAT of slice perf 2-3x spec.
import fs from "node:fs/promises";

// ── Dispatch-timing types ─────────────────────────────────────────────────

export type DispatchRow = {
  runId: string;
  sliceId?: string;
  agent: string;
  model?: string;
  wallMs: number;
  tokenIn: number;
  tokenOut: number;
  toolCalls: Record<string, number>;
  bashDurationMs: number;
  skillLoadCount: number;
};

export type DispatchRowWithTokens = DispatchRow & { totalTokens: number };

export type DispatchAggregate = {
  rowCount: number;
  totalWallMs: number;
  topSlow: DispatchRow[];
  topTokens: DispatchRowWithTokens[];
};

// ── Bash-gate types ───────────────────────────────────────────────────────

export type BashGateRow = {
  gate: string;
  durationMs: number;
  exitCode: number;
};

export type BashGateAggregate = {
  rowCount: number;
  totalMs: number;
  timeoutCount: number;
  byGate: Record<string, number>;
};

// ── aggregateDispatchTiming ───────────────────────────────────────────────

/**
 * Read dispatch-timing.jsonl and aggregate rows matching runId.
 * Returns the top-3 slowest (by wallMs) and top-3 token-heaviest
 * (by tokenIn + tokenOut) dispatches.
 *
 * Returns an empty aggregate on any read/parse error so the cost-report
 * render path degrades gracefully.
 */
export async function aggregateDispatchTiming(
  logPath: string,
  runId: string
): Promise<DispatchAggregate> {
  const empty: DispatchAggregate = { rowCount: 0, totalWallMs: 0, topSlow: [], topTokens: [] };
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf-8");
  } catch {
    return empty;
  }
  const rows: DispatchRow[] = raw
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as DispatchRow;
        return parsed.runId === runId ? [parsed] : [];
      } catch {
        return [];
      }
    });

  const totalWallMs = rows.reduce((s, r) => s + (r.wallMs ?? 0), 0);
  const topSlow = [...rows].sort((a, b) => (b.wallMs ?? 0) - (a.wallMs ?? 0)).slice(0, 3);
  const topTokens = rows
    .map((r) => ({ ...r, totalTokens: (r.tokenIn ?? 0) + (r.tokenOut ?? 0) }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 3);

  return { rowCount: rows.length, totalWallMs, topSlow, topTokens };
}

// ── aggregateBashGates ────────────────────────────────────────────────────

/**
 * Read bash-gates.jsonl and aggregate all rows.
 *
 * NOTE: bash-gate rows do not carry a runId field (per FEAT-150 schema).
 * Aggregation is therefore cumulative over the lifetime of the log file.
 * Callers are scoped to per-worktree log paths, which limits the window
 * to the active worktree's lifetime. To reset, delete or rotate the log.
 */
export async function aggregateBashGates(logPath: string): Promise<BashGateAggregate> {
  const empty: BashGateAggregate = { rowCount: 0, totalMs: 0, timeoutCount: 0, byGate: {} };
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf-8");
  } catch {
    return empty;
  }
  const rows: BashGateRow[] = raw
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as BashGateRow];
      } catch {
        return [];
      }
    });

  const byGate: Record<string, number> = {};
  let totalMs = 0;
  let timeoutCount = 0;
  for (const r of rows) {
    totalMs += r.durationMs ?? 0;
    byGate[r.gate] = (byGate[r.gate] ?? 0) + (r.durationMs ?? 0);
    if (r.exitCode === 124) timeoutCount += 1; // GNU timeout exit code
  }
  return { rowCount: rows.length, totalMs, timeoutCount, byGate };
}

// ── readRecentDispatchRows ─────────────────────────────────────────────────

/**
 * Read dispatch-timing.jsonl and return the most recent `limit` rows across
 * ALL runIds (the log is append-only, so the tail of the file is the most
 * recent activity). Used by the cost-watch CLI (FEAT-194 S4) to render a
 * rolling burn window that isn't scoped to a single run. Returns [] on any
 * read/parse error so the caller degrades gracefully.
 */
export async function readRecentDispatchRows(
  logPath: string,
  limit: number
): Promise<DispatchRow[]> {
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf-8");
  } catch {
    return [];
  }
  const rows: DispatchRow[] = raw
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as DispatchRow];
      } catch {
        return [];
      }
    });
  return limit > 0 ? rows.slice(-limit) : rows;
}

// ── getLatestRunId ────────────────────────────────────────────────────────

/**
 * Scan the dispatch-timing log and return the runId of the most recently
 * written row. Used as fallback when the workflow state lacks an explicit runId.
 * Returns undefined if the log is absent or empty.
 */
export async function getLatestRunId(logPath: string): Promise<string | undefined> {
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf-8");
  } catch {
    return undefined;
  }
  const lines = raw.split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as { runId?: string };
      if (parsed.runId) return parsed.runId;
    } catch {
      // skip malformed
    }
  }
  return undefined;
}

// ── renderDispatchBreakdownSection ────────────────────────────────────────

function fmtTool(toolCalls: Record<string, number> | undefined, name: string): number {
  return toolCalls?.[name] ?? 0;
}

function renderDispatchTable(rows: DispatchRow[]): string[] {
  if (rows.length === 0) return ["_(no data)_", ""];
  const lines = [
    "| Agent | Model | wallMs | Read | Edit | Bash | Skills |",
    "|-------|-------|--------|------|------|------|--------|"
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.agent} | ${r.model ?? "-"} | ${r.wallMs} | ${fmtTool(r.toolCalls, "Read")} | ${fmtTool(r.toolCalls, "Edit")} | ${fmtTool(r.toolCalls, "Bash")} | ${r.skillLoadCount ?? 0} |`
    );
  }
  lines.push("");
  return lines;
}

function renderTokenTable(rows: DispatchRowWithTokens[]): string[] {
  if (rows.length === 0) return ["_(no data)_", ""];
  const lines = [
    "| Agent | tokenIn | tokenOut | total |",
    "|-------|---------|----------|-------|"
  ];
  for (const r of rows) {
    lines.push(`| ${r.agent} | ${r.tokenIn} | ${r.tokenOut} | ${r.totalTokens} |`);
  }
  lines.push("");
  return lines;
}

function renderGateTable(byGate: Record<string, number>): string[] {
  const entries = Object.entries(byGate).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return ["_(no data)_", ""];
  const lines = ["| Gate | Total ms |", "|------|----------|"];
  for (const [gate, ms] of entries) {
    lines.push(`| ${gate} | ${ms} |`);
  }
  lines.push("");
  return lines;
}

/**
 * Render the ## Per-dispatch breakdown Markdown section.
 *
 * Returns an empty string when both aggregates are empty (no rows),
 * so the section is omitted from cost-reports without active telemetry.
 */
export function renderDispatchBreakdownSection(
  dispatch: DispatchAggregate,
  gates: BashGateAggregate
): string {
  const hasDispatch = dispatch.rowCount > 0;
  const hasGates = gates.rowCount > 0;

  // Return empty when both sources have no data
  if (!hasDispatch && !hasGates) return "";

  const lines: string[] = ["", "## Per-dispatch breakdown", ""];

  if (hasDispatch) {
    lines.push(
      `- Total wall-clock: ${dispatch.totalWallMs}ms (${dispatch.rowCount} dispatches)`,
      ""
    );
  } else {
    lines.push("- Total wall-clock: 0ms (0 dispatches)", "");
  }

  lines.push("### Top-3 slowest dispatches", "");
  lines.push(...renderDispatchTable(dispatch.topSlow));

  lines.push("### Top-3 token-heaviest dispatches", "");
  lines.push(...renderTokenTable(dispatch.topTokens));

  lines.push("### Bash gate breakdown", "");
  if (hasGates) {
    lines.push(
      `- Total: ${gates.totalMs}ms (${gates.rowCount} gate invocations, ${gates.timeoutCount} timeouts)`,
      ""
    );
  } else {
    lines.push("- Total: 0ms (0 gate invocations, 0 timeouts)", "");
  }
  lines.push(...renderGateTable(gates.byGate));

  return lines.join("\n");
}
