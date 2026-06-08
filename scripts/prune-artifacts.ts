#!/usr/bin/env node

// Artifact pruning CLI for crew. Scans .claude/artifacts/crew/ subdirectories
// and deletes (or lists in dry-run mode) files older than a configurable age.
//
// Flags:
//   --older-than <days>   Age threshold in days (default: 90). Must be a
//                         positive integer. Rejects NaN, zero, and negative.
//   --dry-run             Print matching files without deleting. Always safe.
//   --repo <path>         Repository root (default: process.cwd()).
//
// Exit codes:
//   0 — completed (dry-run list or destructive prune, including 0 files found)
//   1 — invalid flag value
//   2 — unexpected I/O error

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ARTIFACTS_SUBDIR = path.join(".claude", "artifacts", "crew");
const DEFAULT_DAYS = 90;

// Pure age-filter exported for unit tests — no I/O.
export function isOlderThan(mtimeMs: number, nowMs: number, days: number): boolean {
  return mtimeMs < nowMs - days * 86_400_000;
}

function parseArgs(argv: string[]): {
  repo: string;
  olderThan: number;
  dryRun: boolean;
} {
  let repo = process.cwd();
  let olderThan = DEFAULT_DAYS;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--repo" && argv[i + 1] !== undefined) {
      repo = argv[i + 1] as string;
      i += 1;
    } else if (arg === "--older-than" && argv[i + 1] !== undefined) {
      olderThan = Number(argv[i + 1]);
      i += 1;
    }
  }

  return { repo, olderThan, dryRun };
}

export function validateDays(days: number): string | null {
  if (!Number.isFinite(days) || Number.isNaN(days)) {
    return `--older-than must be a finite number; got ${days}`;
  }
  if (!Number.isInteger(days) || days <= 0) {
    return `--older-than must be a positive integer; got ${days}`;
  }
  return null;
}

async function collectFiles(artifactsDir: string): Promise<string[]> {
  const results: string[] = [];

  let subdirs: string[];
  try {
    const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
    subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return results;
    }
    throw err;
  }

  for (const sub of subdirs) {
    const subPath = path.join(artifactsDir, sub);
    const entries = await fs.readdir(subPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        results.push(path.join(subPath, entry.name));
      }
    }
  }

  return results;
}

async function pruneFiles(
  files: string[],
  nowMs: number,
  days: number,
  dryRun: boolean
): Promise<number> {
  let count = 0;
  for (const filePath of files) {
    const stat = await fs.stat(filePath);
    if (!isOlderThan(stat.mtimeMs, nowMs, days)) continue;
    if (dryRun) {
      process.stdout.write(`[dry-run] would delete: ${filePath}\n`);
    } else {
      await fs.unlink(filePath);
      process.stdout.write(`deleted: ${filePath}\n`);
    }
    count += 1;
  }
  return count;
}

async function main(argv: string[]): Promise<void> {
  const { repo, olderThan, dryRun } = parseArgs(argv);

  const validationError = validateDays(olderThan);
  if (validationError !== null) {
    process.stderr.write(`[prune-artifacts] ${validationError}\n`);
    process.exit(1);
  }

  const artifactsDir = path.resolve(repo, ARTIFACTS_SUBDIR);
  const nowMs = Date.now();

  let files: string[];
  try {
    files = await collectFiles(artifactsDir);
  } catch (err) {
    process.stderr.write(`[prune-artifacts] I/O error: ${(err as Error).message}\n`);
    process.exit(2);
  }

  let count: number;
  try {
    count = await pruneFiles(files, nowMs, olderThan, dryRun);
  } catch (err) {
    process.stderr.write(`[prune-artifacts] I/O error: ${(err as Error).message}\n`);
    process.exit(2);
  }

  const mode = dryRun ? "dry-run" : "deleted";
  process.stdout.write(
    `[prune-artifacts] ${mode}: ${count} file(s) older than ${olderThan} day(s)\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    process.stderr.write(`[prune-artifacts] fatal: ${(err as Error).message}\n`);
    process.exit(2);
  });
}
