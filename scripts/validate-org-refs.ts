#!/usr/bin/env node

// validate-org-refs.ts — stale-org-name sweep.
//
// The plugin repos were transferred from the pre-transfer `sergeymilashico`
// GitHub owner to `astragenie` (hero-crew -> astragenie/dev-team,
// loop -> astragenie/runner-plugin, astra-marketplace -> astragenie/
// astra-marketplace). GitHub redirects the old owner path, so a stale
// `sergeymilashico/...` reference keeps WORKING — which is exactly why it
// rots undetected: nothing breaks, so nobody notices the install command /
// doc points users at the pre-transfer owner.
//
// This gate fails when the banned owner token appears in AUTHORED surfaces —
// the files a human or a consumer's installed methodology actually reads. It
// deliberately does NOT scan frozen historical records (CHANGELOG past
// entries, `.claude/artifacts/**`, `.claude/logs/**`): those were accurate
// for their era and still resolve via the redirect; rewriting history is
// worse than leaving it. Mirrors astragenie/runner-plugin's validate-org-refs.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BANNED_OWNER = "sergeymilashico";
// Whole GitHub owner token (`sergeymilashico/` or bare, at a word boundary)
// so an unrelated substring can't false-positive.
const BANNED_RE = /sergeymilashico(?=[/\s"'`)\]]|$)/;

// scripts/ is one level under the repo root.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Authored surfaces to scan, relative to repo root (file or dir). Runtime /
// generated state, deps, and git internals are out; `.claude/crew` (authored
// methodology docs like deployment.md / plugin-marketplace.md) is IN.
const SCAN_TARGETS = [
  "README.md",
  "ADOPTION.md",
  "agents",
  "commands",
  "skills",
  "docs",
  "scripts",
  ".claude-plugin",
  ".claude/crew"
];

const SKIP_DIR_NAMES = new Set(["node_modules", "3rdparty", ".git"]);
const SCAN_EXTENSIONS = new Set([".md", ".ts", ".mts", ".mjs", ".js", ".json", ".yml", ".yaml"]);

// Files that MUST name the banned token to do their job — this guard's own
// source (the literal it bans) and its test. Named allowlist with rationale.
const ALLOWLIST = new Set([
  path.join("scripts", "validate-org-refs.ts"),
  path.join("tests", "validate-org-refs.test.ts")
]);

export interface OrgRefFinding {
  file: string;
  line: number;
  text: string;
}

async function collectFiles(absPath: string): Promise<string[]> {
  let stats: import("node:fs").Stats;
  try {
    stats = await fs.stat(absPath);
  } catch {
    return []; // a target that doesn't exist (e.g. ADOPTION.md absent) is fine
  }
  if (stats.isFile()) return [absPath];
  const out: string[] = [];
  const entries = await fs.readdir(absPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(absPath, entry.name);
    if (entry.isDirectory()) out.push(...(await collectFiles(full)));
    else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

export async function validateOrgRefs(
  repoRoot: string = REPO_ROOT
): Promise<{ ok: boolean; findings: OrgRefFinding[] }> {
  const findings: OrgRefFinding[] = [];
  for (const target of SCAN_TARGETS) {
    const files = await collectFiles(path.join(repoRoot, target));
    for (const file of files) {
      if (ALLOWLIST.has(path.relative(repoRoot, file))) continue;
      const content = await fs.readFile(file, "utf8");
      if (!content.includes(BANNED_OWNER)) continue;
      content.split("\n").forEach((line, idx) => {
        if (BANNED_RE.test(line)) {
          findings.push({
            file: path.relative(repoRoot, file),
            line: idx + 1,
            text: line.trim().slice(0, 120)
          });
        }
      });
    }
  }
  return { ok: findings.length === 0, findings };
}

function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateOrgRefs();
  if (!result.ok) {
    console.error(
      `Org-ref validation failed: ${result.findings.length} stale "${BANNED_OWNER}" reference(s) in authored files. ` +
        `The owner is now "astragenie" (github redirects the old path, so these still work but point users at the pre-transfer owner).`
    );
    for (const finding of result.findings) {
      console.error(`  - ${finding.file}:${finding.line}: ${finding.text}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Org-ref validation OK: no stale "${BANNED_OWNER}" references in authored files.`);
  }
}
