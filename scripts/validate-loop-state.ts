#!/usr/bin/env node

// Hard CI gate: exactly one populated backlog tree, unique FEAT ids.
// Thin local sibling of `loop doctor --check` (CI has no plugin cache).
//
// checkLoopState() is exported so the same checks can run from a test
// without spawning a subprocess. The entry point at the bottom prints +
// sets process.exitCode on failure; it does NOT call process.exit, so
// callers that `await import` this module are not killed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists } from "./lib/fs-utils.ts";

const STATES = ["pending", "triaged", "in-progress", "done"];
const AUTHORITATIVE = ".claude/artifacts/loop/backlog";
const LEGACY = ["docs/backlog"];

async function listFeats(root: string): Promise<string[]> {
  const ids: string[] = [];
  for (const state of STATES) {
    const dir = path.join(root, state);
    if (!(await pathExists(dir))) continue;
    for (const f of await fs.readdir(dir)) {
      if (/^FEAT-\d{3,}[a-z]?\.md$/.test(f)) ids.push(f.replace(".md", ""));
    }
  }
  return ids;
}

export async function checkLoopState(repoPath: string): Promise<string[]> {
  const errors: string[] = [];
  for (const legacy of LEGACY) {
    const ids = await listFeats(path.join(repoPath, legacy));
    if (ids.length > 0) {
      errors.push(
        `${legacy}: populated backlog tree outside ${AUTHORITATIVE} (${ids.length} FEATs)`
      );
    }
  }
  const authIds = await listFeats(path.join(repoPath, AUTHORITATIVE));
  const seen = new Set<string>();
  for (const id of authIds) {
    if (seen.has(id)) errors.push(`${id}: duplicate id in ${AUTHORITATIVE}`);
    seen.add(id);
  }
  return errors;
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  const entryPath = path.resolve(process.argv[1]);
  const thisPath = fileURLToPath(import.meta.url);
  return entryPath === thisPath;
}

if (isMainEntry()) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const errors = await checkLoopState(repoRoot);
  if (errors.length > 0) {
    console.error("validate-loop-state FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log("Loop state OK: single tree, unique ids.");
  }
}
