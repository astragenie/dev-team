// One-off: stamp github_issue/github_url into local FEAT frontmatter for FEATs
// that already have a tracker issue but no linkage recorded.
//
// Why not `loop github publish`: it keys on the ABSENCE of github_issue and
// creates a new issue (github-sync.mjs:71-84). For the 15 FEATs reconcile just
// published, that would mint a SECOND issue each. This script only ever matches
// existing issues by title and writes local frontmatter. It creates nothing.
//
// Read-only against GitHub. Writes only local FEAT files, and only ones that
// currently have no github_issue. --apply to write; dry-run otherwise.

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const REPO = process.env.BACKFILL_REPO ?? "astragenie/runner-plugin";
const ROOT = process.env.BACKFILL_ROOT ?? process.cwd();
const APPLY = process.argv.includes("--apply");
const BACKLOG = path.join(ROOT, ".claude", "artifacts", "loop", "backlog");

const gh = (args) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// --- 1. Every issue in the repo, keyed by the FEAT id in its title. ----------
// `--paginate` streams one JSON array per page, so --slurp + flat() is required
// (a plain parse silently keeps only the first page).
const raw = gh([
  "api",
  "--paginate",
  "--slurp",
  `repos/${REPO}/issues?state=all&per_page=100`
]);
const issues = JSON.parse(raw)
  .flat()
  .filter((i) => !i.pull_request); // issues endpoint includes PRs

const byFeat = new Map();
for (const issue of issues) {
  const m = /^(FEAT-\d+)\b/.exec(issue.title ?? "");
  if (!m) continue;
  const list = byFeat.get(m[1]) ?? [];
  list.push(issue);
  byFeat.set(m[1], list);
}

// --- 2. Local FEAT files with no github_issue. -------------------------------
const featFiles = [];
for (const state of ["pending", "triaged", "in-progress", "done"]) {
  const dir = path.join(BACKLOG, state);
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    continue;
  }
  for (const f of entries) {
    if (f.endsWith(".md")) featFiles.push({ state, filePath: path.join(dir, f) });
  }
}

const plan = { stamp: [], ambiguous: [], noIssue: [], alreadyLinked: [] };

for (const { state, filePath } of featFiles) {
  const text = await fs.readFile(filePath, "utf8");
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) continue;
  const body = fm[1];
  const idMatch = /^id:\s*(FEAT-\d+)\s*$/m.exec(body);
  if (!idMatch) continue;
  const id = idMatch[1];

  if (/^github_issue:\s*\d+\s*$/m.test(body)) {
    plan.alreadyLinked.push(id);
    continue;
  }

  const matches = byFeat.get(id) ?? [];
  if (matches.length === 0) {
    plan.noIssue.push(id);
  } else if (matches.length > 1) {
    // Never guess. Two issues for one FEAT is a real problem to look at.
    plan.ambiguous.push({ id, numbers: matches.map((i) => i.number) });
  } else {
    plan.stamp.push({ id, state, filePath, issue: matches[0], text });
  }
}

// --- 3. Report, then (only with --apply) write. ------------------------------
console.log(`repo: ${REPO}`);
console.log(`issues with a FEAT-id title: ${byFeat.size}`);
console.log(`local FEAT files: ${featFiles.length}`);
console.log("");
console.log(`  stamp         ${plan.stamp.length}  (issue exists, no linkage recorded)`);
console.log(`  already linked${String(plan.alreadyLinked.length).padStart(6)}  (untouched)`);
console.log(`  no issue      ${plan.noIssue.length}  (never published — untouched, NOT created)`);
console.log(`  ambiguous     ${plan.ambiguous.length}  (multiple issues — REFUSED, needs a human)`);
console.log("");

for (const a of plan.ambiguous) {
  console.log(`  AMBIGUOUS  ${a.id} -> issues ${a.numbers.join(", ")} — refusing to guess`);
}
for (const s of plan.stamp) {
  console.log(
    `  stamp  ${s.id.padEnd(9)} -> #${String(s.issue.number).padEnd(4)} [${s.issue.state}] ${(s.state + "]").padEnd(13)} ${s.issue.title.slice(0, 46)}`
  );
}

if (!APPLY) {
  console.log("\nDRY RUN — no files written. Re-run with --apply.");
  process.exit(0);
}

let written = 0;
for (const s of plan.stamp) {
  const url = `https://github.com/${REPO}/issues/${s.issue.number}`;
  // Insert the two keys just before the closing --- of the frontmatter block,
  // preserving everything else byte-for-byte.
  const updated = s.text.replace(
    /^(---\r?\n[\s\S]*?)(\r?\n---)/,
    (_m, head, tail) => `${head}\ngithub_issue: ${s.issue.number}\ngithub_url: ${url}${tail}`
  );
  if (updated === s.text) {
    console.error(`  FAILED to stamp ${s.id} — frontmatter unchanged`);
    continue;
  }
  await fs.writeFile(s.filePath, updated);
  written++;
}
console.log(`\nAPPLIED — stamped ${written} FEAT file(s).`);
