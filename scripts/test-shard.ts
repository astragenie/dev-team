#!/usr/bin/env node

// FEAT-200: deterministic file-glob partitioner for sharding `bun test` across
// N CI matrix jobs. Works around bun#5090 (bun test runs single-process --
// no --parallel, see CLAUDE.md) by splitting the *file list* across shards
// instead of relying on bun's own scheduler.
//
// CLI usage:
//   node --experimental-strip-types scripts/test-shard.ts --index 0 --total 3
//   SHARD_INDEX=0 SHARD_TOTAL=3 node --experimental-strip-types scripts/test-shard.ts
//
// Library usage (tests import these directly -- no CLI side effects on import,
// guarded by isMainEntry() below):
//   import { discoverTestFiles, partitionFiles } from "./test-shard.ts";

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(REPO_ROOT, "tests");

/**
 * Recursively collect every `*.test.ts` file under `dir`, returned as
 * forward-slash paths relative to `root`, in stable sorted order. Sorting
 * up front makes partitioning deterministic across OSes and across repeated
 * runs -- `fs.readdir` order is not guaranteed to be stable or portable.
 */
export async function discoverTestFiles(
  dir: string = TESTS_DIR,
  root: string = REPO_ROOT
): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  }

  await walk(dir);
  return out.sort();
}

/**
 * Partition a file list into `shardTotal` disjoint groups, round-robin by
 * sorted index, returning only the files assigned to `shardIndex`.
 *
 * Round-robin (not contiguous chunking) keeps shards balanced as files are
 * added/removed near the start of the sorted list -- an insertion only
 * reshuffles which shard neighboring files land in; it never cascades a
 * whole chunk boundary.
 *
 * Guarantees (see tests/test-shard.test.ts):
 *   - the union over shardIndex in [0, shardTotal) equals the full sorted
 *     input, with every file appearing in exactly one shard
 *   - deterministic: same input + same (shardIndex, shardTotal) always
 *     yields the same output
 */
export function partitionFiles(
  files: readonly string[],
  shardIndex: number,
  shardTotal: number
): string[] {
  if (!Number.isInteger(shardTotal) || shardTotal < 1) {
    throw new Error(`shardTotal must be a positive integer, got ${shardTotal}`);
  }
  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardTotal) {
    throw new Error(`shardIndex must be an integer in [0, ${shardTotal}), got ${shardIndex}`);
  }
  const sorted = [...files].sort();
  return sorted.filter((_file, i) => i % shardTotal === shardIndex);
}

interface ShardArgs {
  index: number;
  total: number;
}

/** Find `--<name> value` or `--<name>=value` in argv; returns the raw string value if present. */
function extractFlag(argv: readonly string[], name: string): string | undefined {
  const eqPrefix = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${name}` && argv[i + 1] !== undefined) return argv[i + 1];
    if (arg?.startsWith(eqPrefix)) return arg.slice(eqPrefix.length);
  }
  return undefined;
}

function parseShardArgs(argv: readonly string[], env: NodeJS.ProcessEnv): ShardArgs {
  const indexRaw = extractFlag(argv, "index") ?? env.SHARD_INDEX;
  const totalRaw = extractFlag(argv, "total") ?? env.SHARD_TOTAL;
  return {
    index: indexRaw !== undefined ? Number(indexRaw) : 0,
    total: totalRaw !== undefined ? Number(totalRaw) : 1
  };
}

function runBunTest(files: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    if (files.length === 0) {
      console.log("test-shard: no files assigned to this shard, nothing to run.");
      resolve(0);
      return;
    }
    const proc = spawn("bun", ["test", "--timeout", "60000", ...files], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    proc.on("close", (code) => resolve(code ?? 1));
    proc.on("error", (err: Error) => {
      console.error(`test-shard: failed to launch bun test: ${err.message}`);
      resolve(1);
    });
  });
}

function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const { index, total } = parseShardArgs(process.argv.slice(2), process.env);
  const allFiles = await discoverTestFiles();
  const shardFiles = partitionFiles(allFiles, index, total);
  console.log(
    `test-shard: shard ${index}/${total} — ${shardFiles.length} of ${allFiles.length} test file(s).`
  );
  const code = await runBunTest(shardFiles);
  process.exitCode = code;
}
