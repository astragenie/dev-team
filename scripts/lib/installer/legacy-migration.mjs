// One-shot migrator for the P3.1 engineering-os -> crew namespace rename.
//
// Moves files from .claude/engineering-os/, .claude/state/engineering-os/, and
// .claude/artifacts/engineering-os/ into the corresponding .claude/.../crew/
// trees. When both old and new paths exist, the newer mtime wins (ties favor
// the new path). Empties are pruned. Legacy roots are removed when empty.
//
// Safe to run repeatedly: a repo without the legacy tree is a no-op.

import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, pathExists } from "./util.ts";

/**
 * @param {string} repoPath
 * @param {string[]} writes
 */
export async function migrateLegacyHarness(repoPath, writes) {
  const moves = [
    [path.join(repoPath, ".claude", "engineering-os"), path.join(repoPath, ".claude", "crew")],
    [
      path.join(repoPath, ".claude", "state", "engineering-os"),
      path.join(repoPath, ".claude", "state", "crew")
    ],
    [
      path.join(repoPath, ".claude", "artifacts", "engineering-os"),
      path.join(repoPath, ".claude", "artifacts", "crew")
    ]
  ];

  for (const [legacyRoot, targetRoot] of moves) {
    if (!(await pathExists(legacyRoot))) {
      continue;
    }
    await migrateDirectoryTree(legacyRoot, targetRoot, repoPath, writes);
    await removeEmptyTree(legacyRoot);
  }
}

/**
 * @param {string} legacyDir
 * @param {string} targetDir
 * @param {string} repoPath
 * @param {string[]} writes
 */
async function migrateDirectoryTree(legacyDir, targetDir, repoPath, writes) {
  const entries = await fs.readdir(legacyDir, { withFileTypes: true });
  for (const entry of entries) {
    const legacyPath = path.join(legacyDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await ensureDir(targetPath);
      await migrateDirectoryTree(legacyPath, targetPath, repoPath, writes);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    await migrateOneFile(legacyPath, targetPath, repoPath, writes);
  }
}

/**
 * @param {string} legacyPath
 * @param {string} targetPath
 * @param {string} repoPath
 * @param {string[]} writes
 */
async function migrateOneFile(legacyPath, targetPath, repoPath, writes) {
  const targetExists = await pathExists(targetPath);
  if (!targetExists) {
    await ensureDir(path.dirname(targetPath));
    const data = await fs.readFile(legacyPath);
    await fs.writeFile(targetPath, data);
    writes.push(path.relative(repoPath, targetPath));
    await fs.unlink(legacyPath);
    return;
  }

  // Both exist — newer mtime wins. Tie goes to the new (crew/) path.
  const [legacyStat, targetStat] = await Promise.all([fs.stat(legacyPath), fs.stat(targetPath)]);
  if (legacyStat.mtimeMs > targetStat.mtimeMs) {
    const data = await fs.readFile(legacyPath);
    await fs.writeFile(targetPath, data);
    writes.push(path.relative(repoPath, targetPath));
  }
  await fs.unlink(legacyPath);
}

/** @param {string} dirPath */
async function removeEmptyTree(dirPath) {
  if (!(await pathExists(dirPath))) {
    return;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyTree(path.join(dirPath, entry.name));
    }
  }
  const remaining = await fs.readdir(dirPath);
  if (remaining.length === 0) {
    await fs.rmdir(dirPath);
  }
}
