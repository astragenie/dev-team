#!/usr/bin/env node
/**
 * CLI: cost-report → OTel span JSONL backfill (FEAT-165 SLICE-A).
 *
 * Reads cost reports from --cost-dir, converts each to a span JSONL file
 * under --out-dir/<run_id>.jsonl. Idempotent — re-running produces the
 * same output bytes because trace/span ids are deterministic from run_id.
 *
 * Exit codes: 0 = success/zero files, 1 = parse/validate failure, 2 = I/O failure
 */
import fs from "node:fs/promises";
import path from "node:path";
import { loadCostReportSafe } from "./lib/telemetry/cost-report-loader.ts";
import { costReportToSpans } from "./lib/telemetry/cost-report-to-spans.ts";
import { writeSpansToFile } from "./lib/telemetry/serialize-jsonl.ts";

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

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
    if (flag === "--emit-observability") {
      result.emitObservability = true;
      continue;
    }
    if (flag === "--help") {
      result.help = true;
      continue;
    }
    const val = args[++i] ?? null;
    if (flag === "--cost-dir" && val !== null) result.costDir = val;
    else if (flag === "--out-dir" && val !== null) result.outDir = val;
    else if (flag === "--only") result.only = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(
      "Usage: node ./scripts/cost-report-to-spans.ts [options]\n\n" +
        "Options:\n" +
        "  --cost-dir <path>       Cost reports dir (default: .claude/artifacts/crew/cost)\n" +
        "  --out-dir <path>        Output dir for JSONL files (default: .claude/artifacts/crew/spans)\n" +
        "  --only <glob>           Filter cost-report filenames (e.g. '*feat113*')\n" +
        "  --emit-observability    Emit one grep-able stderr line at end of run\n" +
        "  --help                  Show this help"
    );
    return;
  }

  let entries: string[];
  try {
    entries = await fs.readdir(args.costDir);
  } catch (err) {
    process.stderr.write(`cost-report-to-spans: cannot read cost-dir '${args.costDir}': ${err}\n`);
    process.exitCode = 2;
    return;
  }

  // Convert fnmatch-style glob (only * supported) to regex for filtering.
  const onlyRe = args.only
    ? new RegExp("^" + args.only.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$")
    : null;

  const mdFiles = entries
    .filter((f) => f.endsWith(".md"))
    .filter((f) => (onlyRe ? onlyRe.test(f) : true))
    .sort();

  let totalSpans = 0;
  let failCount = 0;
  let runCount = 0;

  for (const filename of mdFiles) {
    const absPath = path.resolve(args.costDir, filename);
    let report;
    try {
      report = await loadCostReportSafe(absPath);
    } catch (err) {
      process.stderr.write(`cost-report-to-spans: failed to parse '${filename}': ${err}\n`);
      failCount++;
      continue;
    }
    if (report === null) continue; // aggregate — skip

    const spans = costReportToSpans(report);
    const outPath = path.resolve(args.outDir, `${report.runId}.jsonl`);
    try {
      await writeSpansToFile(spans, outPath);
    } catch (err) {
      process.stderr.write(`cost-report-to-spans: failed to write '${outPath}': ${err}\n`);
      failCount++;
      continue;
    }
    totalSpans += spans.length;
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
