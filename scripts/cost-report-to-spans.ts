#!/usr/bin/env node
/**
 * CLI: cost-report → OTel span JSONL backfill (FEAT-165 SLICE-A).
 *
 * Reads cost reports from --cost-dir, converts each to a span JSONL file
 * under --out-dir/<run_id>.jsonl. Idempotent — re-running produces the
 * same output bytes because trace/span ids are deterministic from run_id.
 *
 * Usage:
 *   node ./scripts/cost-report-to-spans.ts [--cost-dir <path>] [--out-dir <path>]
 *                                           [--only <glob>] [--emit-observability]
 *
 * Exit codes:
 *   0 = success or zero files matched
 *   1 = at least one file failed to parse or validate
 *   2 = I/O failure (unreadable cost-dir, unwritable out-dir)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { loadCostReportSafe } from "./lib/telemetry/cost-report-loader.ts";
import { costReportToSpans } from "./lib/telemetry/cost-report-to-spans.ts";
import { writeSpansToFile } from "./lib/telemetry/serialize-jsonl.ts";

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

const FLAG_SPEC: Record<string, string> = {
  "--cost-dir": "costDir",
  "--out-dir": "outDir",
  "--only": "only",
  "--emit-observability": "emitObservability",
  "--help": "help"
};

function parseArgs(argv: string[]): {
  costDir: string;
  outDir: string;
  only: string | null;
  emitObservability: boolean;
  help: boolean;
} {
  const args = argv.slice(2);
  const result = {
    costDir: ".claude/artifacts/crew/cost",
    outDir: ".claude/artifacts/crew/spans",
    only: null as string | null,
    emitObservability: false,
    help: false
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    const key = FLAG_SPEC[flag];
    if (!key) continue;
    if (flag === "--emit-observability") {
      result.emitObservability = true;
    } else if (flag === "--help") {
      result.help = true;
    } else {
      const val = args[++i] ?? null;
      if (key === "only") {
        result.only = val;
      } else if (key === "costDir" && val !== null) {
        result.costDir = val;
      } else if (key === "outDir" && val !== null) {
        result.outDir = val;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Glob-style filter (supports * wildcard, case-sensitive)
// ---------------------------------------------------------------------------

function matchesOnly(filename: string, pattern: string): boolean {
  // Convert fnmatch-style pattern to regex: * -> [^/]*
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
  );
  return re.test(filename);
}

// ---------------------------------------------------------------------------
// Per-file processing (extracted to keep main() within complexity budget)
// ---------------------------------------------------------------------------

interface ProcessResult {
  spansWritten: number;
  failed: boolean;
  skipped: boolean;
}

async function processFile(
  filename: string,
  costDir: string,
  outDir: string
): Promise<ProcessResult> {
  const absPath = path.resolve(costDir, filename);
  let report;
  try {
    report = await loadCostReportSafe(absPath);
  } catch (err) {
    process.stderr.write(`cost-report-to-spans: failed to parse '${filename}': ${err}\n`);
    return { spansWritten: 0, failed: true, skipped: false };
  }

  // null = aggregate (skipped)
  if (report === null) return { spansWritten: 0, failed: false, skipped: true };

  const spans = costReportToSpans(report);
  const outPath = path.resolve(outDir, `${report.runId}.jsonl`);
  try {
    await writeSpansToFile(spans, outPath);
  } catch (err) {
    process.stderr.write(`cost-report-to-spans: failed to write '${outPath}': ${err}\n`);
    return { spansWritten: 0, failed: true, skipped: false };
  }

  return { spansWritten: spans.length, failed: false, skipped: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(
      [
        "Usage: node ./scripts/cost-report-to-spans.ts [options]",
        "",
        "Options:",
        "  --cost-dir <path>       Cost reports dir (default: .claude/artifacts/crew/cost)",
        "  --out-dir <path>        Output dir for JSONL files (default: .claude/artifacts/crew/spans)",
        "  --only <glob>           Filter cost-report filenames (e.g. '*feat113*')",
        "  --emit-observability    Emit one grep-able stderr line at end of run",
        "  --help                  Show this help"
      ].join("\n")
    );
    return;
  }

  // Scan cost-dir
  let entries: string[];
  try {
    entries = await fs.readdir(args.costDir);
  } catch (err) {
    process.stderr.write(`cost-report-to-spans: cannot read cost-dir '${args.costDir}': ${err}\n`);
    process.exitCode = 2;
    return;
  }

  const mdFiles = entries
    .filter((f) => f.endsWith(".md"))
    .filter((f) => (args.only ? matchesOnly(f, args.only) : true))
    .sort();

  let totalSpans = 0;
  let failCount = 0;
  let runCount = 0;

  for (const filename of mdFiles) {
    const r = await processFile(filename, args.costDir, args.outDir);
    if (r.failed) {
      failCount++;
      continue;
    }
    if (r.skipped) continue;
    totalSpans += r.spansWritten;
    runCount++;
  }

  if (failCount > 0) process.exitCode = 1;

  if (args.emitObservability) {
    process.stderr.write(`OTEL-BACKFILL wrote ${totalSpans} spans across ${runCount} runs\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`cost-report-to-spans: unexpected error: ${err}\n`);
  process.exitCode = 1;
});
