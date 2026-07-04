#!/usr/bin/env node
// validate-backlog-drift.ts — arch-review 2026-07-04 Finding 2.10
//
// Flags backlog files sitting in .claude/artifacts/loop/backlog/triaged/
// whose slice ID already has a matching "close SLICE-NN" commit in git
// history — the slice-close ceremony ran (git recorded it) but the file was
// never moved to done/. Advisory only: this validator flags drift for a
// human/loop to run the retroactive close ceremony on; it does not move
// files itself (the retroactive moves for this repo's existing drift are a
// separate pre-flight step — see SLICE-197 Notes).
//
// Modes:
//   --advisory (default): print findings, exit 0
//   --strict             : exit 2 if any drift found
//   --repo <path>        : repo root (default: process.cwd())
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SLICE_ID_RE = /\bSLICE-(\d+)\b/gi;

/** Extracts unique `SLICE-<id>` tokens (canonicalized uppercase) from a string. */
function extractSliceIds(text: string): Set<string> {
  const ids = new Set<string>();
  SLICE_ID_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SLICE_ID_RE.exec(text)) !== null) {
    if (m[1]) ids.add(`SLICE-${m[1]}`);
  }
  return ids;
}

/**
 * Pure drift check: a triaged filename's slice ID is "drifted" when the same
 * ID also appears in a "close SLICE-NN" git log line — the close ceremony
 * already ran but the file never moved out of triaged/.
 */
export function findDrift(triagedFilenames: string[], closeLogLines: string[]): string[] {
  const triagedIds = new Set<string>();
  for (const name of triagedFilenames) {
    for (const id of extractSliceIds(name)) triagedIds.add(id);
  }
  const closedIds = new Set<string>();
  for (const line of closeLogLines) {
    for (const id of extractSliceIds(line)) closedIds.add(id);
  }
  return [...triagedIds].filter((id) => closedIds.has(id)).sort();
}

async function listTriagedFiles(triagedDir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(triagedDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
}

/** Non-fatal — a shallow clone or a repo with no matching commits yields no lines, not an error. */
function gitCloseLogLines(repo: string): string[] {
  try {
    const out = execFileSync("git", ["log", "--all", "--grep=close SLICE", "-i", "--format=%s"], {
      cwd: repo,
      encoding: "utf8"
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function parseArgs(argv: string[]): { repo: string; strict: boolean } {
  let repo = process.cwd();
  let strict = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") {
      repo = argv[++i] ?? repo;
    } else if (a === "--strict") {
      strict = true;
    } else if (a === "--advisory") {
      strict = false;
    }
  }
  return { repo, strict };
}

export async function run(argv: string[]): Promise<{ drift: string[]; exitCode: number }> {
  const { repo, strict } = parseArgs(argv);
  const triagedDir = path.join(repo, ".claude", "artifacts", "loop", "backlog", "triaged");
  const triagedFiles = await listTriagedFiles(triagedDir);
  const closeLogLines = gitCloseLogLines(repo);
  const drift = findDrift(triagedFiles, closeLogLines);
  return { drift, exitCode: strict && drift.length > 0 ? 2 : 0 };
}

// Run when invoked directly (not when imported by tests).
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("validate-backlog-drift.ts");
if (isMain) {
  const { drift, exitCode } = await run(process.argv.slice(2));
  if (drift.length === 0) {
    process.stdout.write("validate-backlog-drift: no drift found\n");
  } else {
    process.stdout.write(
      `validate-backlog-drift: ${drift.length} triaged item(s) already closed in git history but not moved to done/:\n`
    );
    for (const id of drift) {
      process.stdout.write(
        `  - ${id} — run the retroactive close ceremony (move the file to done/)\n`
      );
    }
  }
  process.exit(exitCode);
}
