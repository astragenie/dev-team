#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CURRENT_BUILDER_NAMES,
  LEGACY_BUILDER_NAMES,
  SCHEMA_VERSION
} from "./lib/build-bundle/types.ts";

const BUNDLES_REL = path.join(".claude", "artifacts", "crew", "bundles");
const REQUIRED_FIELDS = [
  "slice",
  "builder",
  "run_id",
  "files_touched",
  "files_read",
  "diff_stat",
  "truncated",
  "schema_version"
] as const;

const ALLOWED_BUILDERS = new Set<string>([...CURRENT_BUILDER_NAMES, ...LEGACY_BUILDER_NAMES]);

function repoRoot(): string {
  if (process.env.CREW_VALIDATE_BUNDLES_REPO) {
    return path.resolve(process.env.CREW_VALIDATE_BUNDLES_REPO);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function walk(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile() && e.name.endsWith("-build-bundle.md")) {
      out.push(full);
    }
  }
  return out;
}

interface Finding {
  file: string;
  reason: string;
}

function validateOne(filePath: string, text: string): Finding | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { file: filePath, reason: "missing frontmatter delimiters" };
  }
  const body = match[1] ?? "";
  const have = new Set<string>();
  let schemaVersion: number | null = null;
  let builderValue: string | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    // Field names may include hyphens (e.g. `files_read_skipped`, `builder`).
    const m = line.match(/^([a-z][a-z0-9_-]*):/);
    if (m && m[1]) have.add(m[1]);
    const sv = line.match(/^schema_version:\s*(\d+)\s*$/);
    if (sv && sv[1]) schemaVersion = Number(sv[1]);
    const bv = line.match(/^builder:\s*([\w-]+)\s*$/);
    if (bv && bv[1]) builderValue = bv[1];
  }
  for (const f of REQUIRED_FIELDS) {
    if (!have.has(f)) {
      return { file: filePath, reason: `missing required field: ${f}` };
    }
  }
  if (builderValue === null) {
    return { file: filePath, reason: "builder value unparseable" };
  }
  if (!ALLOWED_BUILDERS.has(builderValue)) {
    return {
      file: filePath,
      reason: `builder "${builderValue}" not in allowed set [${[...ALLOWED_BUILDERS].sort().join(", ")}]`
    };
  }
  if (schemaVersion === null) {
    return { file: filePath, reason: "schema_version unparseable" };
  }
  if (schemaVersion > SCHEMA_VERSION) {
    return {
      file: filePath,
      reason: `schema_version ${schemaVersion} > supported ${SCHEMA_VERSION}`
    };
  }
  return null;
}

async function main(): Promise<void> {
  const root = repoRoot();
  const bundles = await walk(path.join(root, BUNDLES_REL));
  const findings: Finding[] = [];
  for (const file of bundles) {
    const text = await fs.readFile(file, "utf8");
    const finding = validateOne(file, text);
    if (finding) findings.push(finding);
  }
  if (findings.length === 0) {
    process.stdout.write(`validate-bundles: ${bundles.length} bundle(s) OK\n`);
    return;
  }
  for (const f of findings) {
    process.stderr.write(`${f.file}: ${f.reason}\n`);
  }
  process.stderr.write(`validate-bundles: ${findings.length} failure(s)\n`);
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`validate-bundles: ${String(err)}\n`);
  process.exit(1);
});
