#!/usr/bin/env node
// scripts/report-to-pr.ts — dev-team#227 report-to-PR contract CLI.
//
// Thin wrapper around scripts/lib/report-to-pr.ts. Builder agents call this
// IMMEDIATELY after committing their work — BEFORE any remaining risky step
// (push, open PR, cleanup). A report posted late is a report lost: this is
// the ordering half of the fix, not just the channel half.
//
// Usage:
//   node ./scripts/report-to-pr.ts --status DONE --headline "<one sentence>" \
//     --files a.ts,b.ts --risks "none" [--next "<hint>"] [--agent aiplugin-dev] \
//     [--pr 123] [--issue 227] [--repo <path>]
//
// Best-effort by design: gh being absent, unauthenticated, rate-limited,
// offline, or there being no PR yet all degrade to a disk fallback under
// .claude/artifacts/crew/handoffs/ and are reported on stdout — never a
// build-blocker. Only a bad --status value or a genuine local I/O failure
// exits non-zero.
//
// Idempotent: re-running with the same --pr updates the existing marker
// comment instead of spamming a new one per retry.

import process from "node:process";
import { pathToFileURL } from "node:url";
import { postReportToPr, type ReportStatus } from "./lib/report-to-pr.ts";

const VALID_STATUSES: readonly ReportStatus[] = ["DONE", "BLOCKED", "HELP", "IN-PROGRESS"];

function parseArgs(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = "true";
    }
  }
  return flags;
}

function parseFiles(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

function buildPostOpts(flags: Record<string, string>, status: ReportStatus) {
  return {
    repoPath: flags.repo ?? process.cwd(),
    fields: {
      status,
      headline: flags.headline ?? "",
      files: parseFiles(flags.files),
      risks: flags.risks ?? "none",
      ...(flags.next ? { next: flags.next } : {}),
      ...(flags.agent ? { agent: flags.agent } : {})
    },
    ...(flags.pr ? { prNumber: Number(flags.pr) } : {}),
    ...(flags.issue ? { issueNumber: Number(flags.issue) } : {})
  };
}

function printResult(result: ReturnType<typeof postReportToPr>): void {
  if (result.mode === "disk") {
    process.stdout.write(`[report-to-pr] fell back to disk (${result.reason}): ${result.path}\n`);
    return;
  }
  const commentSuffix = result.commentId ? ` (comment ${result.commentId})` : "";
  process.stdout.write(
    `[report-to-pr] ${result.updated ? "updated" : "posted"} ${result.mode} on #${result.target}${commentSuffix}\n`
  );
}

export async function main(argv: string[]): Promise<number> {
  const flags = parseArgs(argv);
  const status = (flags.status ?? "").toUpperCase() as ReportStatus;
  if (!VALID_STATUSES.includes(status)) {
    process.stderr.write(
      `[report-to-pr] --status must be one of ${VALID_STATUSES.join("|")}; got "${flags.status ?? ""}"\n`
    );
    return 1;
  }

  const result = postReportToPr(buildPostOpts(flags, status));
  printResult(result);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`[report-to-pr] fatal: ${(err as Error).message}\n`);
      process.exit(1);
    });
}
