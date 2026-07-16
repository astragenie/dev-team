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
//
// OPTIONAL --memories-used <csv> (dispatch-memory-credit-loop, runner-plugin
// upstream request 2026-07-16): atom ids this agent self-reports it relied
// on. Included in the posted report body for audit, AND credited via the
// resolved provider's feedback() — bounded (fireGuarded's ~1.5s ceiling) and
// fail-silent, so a slow/unreachable daemon can never add unbounded latency
// to this CLI or change its exit code. Absent/empty -> no-op, same as every
// other memory touchpoint in this repo.

import process from "node:process";
import { pathToFileURL } from "node:url";
import { postReportToPr, type ReportStatus } from "./lib/report-to-pr.ts";
import { fireGuarded } from "./lib/gepa/guarded-fire.ts";

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

function parseMemoriesUsed(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function buildPostOpts(flags: Record<string, string>, status: ReportStatus) {
  const memoriesUsed = parseMemoriesUsed(flags["memories-used"]);
  return {
    repoPath: flags.repo ?? process.cwd(),
    fields: {
      status,
      headline: flags.headline ?? "",
      files: parseFiles(flags.files),
      risks: flags.risks ?? "none",
      ...(flags.next ? { next: flags.next } : {}),
      ...(flags.agent ? { agent: flags.agent } : {}),
      ...(memoriesUsed.length > 0 ? { memoriesUsed } : {})
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

/**
 * Credit the reported `memories_used` ids, bounded + fail-silent. Never
 * throws, never changes this CLI's exit code, adds at most fireGuarded's
 * ceiling (~1.5s) to a short-lived process that has no long-running loop to
 * detach into (unlike writeArtifact's fire-and-forget siblings).
 */
async function creditReportedMemories(repoPath: string, memoriesUsed: string[]): Promise<void> {
  if (memoriesUsed.length === 0) return;
  await fireGuarded(async () => {
    const { creditMemoriesUsed } = await import("./lib/memory/handoff-credit.ts");
    await creditMemoriesUsed({ repoPath, ids: memoriesUsed });
  });
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

  const postOpts = buildPostOpts(flags, status);
  const result = postReportToPr(postOpts);
  printResult(result);
  await creditReportedMemories(postOpts.repoPath, postOpts.fields.memoriesUsed ?? []);
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
