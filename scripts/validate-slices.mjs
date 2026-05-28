#!/usr/bin/env node

// Slice AC-placeholder linter. Scans docs/ai-loop/slices/pending/**/*.md for
// Acceptance Criteria bullets that still contain template placeholders. Closes
// the customer-reported failure class (SLICE-92) where literal `AC-N: ...`
// shipped to implementation because slice-from-feature never required the
// placeholders to be filled.
//
// What it flags (each in pending/ only — completed/ is immutable history):
//   - "- [ ] AC-N: ..."        (literal three-dot placeholder)
//   - "- [ ] AC-N: <text>"     (angle-bracket template placeholder)
//   - "- [ ] AC-N:"            (empty after colon)
//
// Exit code:
//   0 — no placeholders found, or pending/ directory absent
//   1 — at least one placeholder found; stderr lists file:line per finding
//
// Repo root is detected by walking up from the script location, OR by reading
// the CREW_SLICE_LINT_REPO env var (used by tests + manual invocation against
// a fixture).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PENDING_SUBDIR = path.join("docs", "ai-loop", "slices", "pending");

// One line, one regex per failure mode. Each capture group is the text after
// the colon, used for diagnostic output.
const RE_AC_LINE = /^\s*-\s*\[\s*\]\s*AC-\d+:\s*(.*?)\s*$/i;
const RE_DOT_PLACEHOLDER = /^\.{2,}$/;
const RE_ANGLE_PLACEHOLDER = /^<[^>]+>$/;

function resolveRepoRoot() {
  if (process.env.CREW_SLICE_LINT_REPO) {
    return path.resolve(process.env.CREW_SLICE_LINT_REPO);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/** @param {string} pendingDir */
async function listSliceFiles(pendingDir) {
  try {
    const entries = await fs.readdir(pendingDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/** @param {string} text */
function findPlaceholders(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(RE_AC_LINE);
    if (!m) continue;
    const after = m[1];
    const acLabel = lines[i].match(/AC-\d+/i)?.[0] ?? "AC-?";
    if (after === "") {
      findings.push({ line: i + 1, label: acLabel, reason: "empty after colon" });
    } else if (RE_DOT_PLACEHOLDER.test(after)) {
      findings.push({ line: i + 1, label: acLabel, reason: "dot placeholder" });
    } else if (RE_ANGLE_PLACEHOLDER.test(after)) {
      findings.push({ line: i + 1, label: acLabel, reason: "angle-bracket placeholder" });
    }
  }
  return findings;
}

async function main() {
  const repoRoot = resolveRepoRoot();
  const pendingDir = path.join(repoRoot, PENDING_SUBDIR);
  const sliceFiles = await listSliceFiles(pendingDir);
  if (sliceFiles === null) {
    // pending/ absent — nothing to lint, exit clean
    process.exit(0);
  }
  let totalFindings = 0;
  for (const name of sliceFiles) {
    const full = path.join(pendingDir, name);
    const text = await fs.readFile(full, "utf8");
    const findings = findPlaceholders(text);
    if (findings.length === 0) continue;
    for (const f of findings) {
      process.stderr.write(
        `[validate-slices] ${name}:${f.line}: ${f.label} is a ${f.reason} — fill with concrete, verifiable language before opening the slice\n`
      );
      totalFindings += 1;
    }
  }
  if (totalFindings > 0) {
    process.stderr.write(
      `[validate-slices] ${totalFindings} placeholder AC bullet(s) found in ${PENDING_SUBDIR}. Slices with un-filled ACs ship without test checklists; resolve before opening.\n`
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[validate-slices] fatal: ${err.message}\n`);
  process.exit(2);
});
