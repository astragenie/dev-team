#!/usr/bin/env node

// Slice AC-placeholder linter + workflow-field validator. FEAT-166 SLICE-82.
//
// Scans pending slice files from two canonical locations (whichever exists):
//   1. .claude/artifacts/loop/slices/pending/   — loop runtime path
//   2. docs/ai-loop/slices/pending/             — legacy fallback
//
// Checks (each in pending/ only — completed/ is immutable history):
//   A. AC-placeholder detection:
//      - "- [ ] AC-N: ..."        (literal three-dot placeholder)
//      - "- [ ] AC-N: <text>"     (angle-bracket template placeholder)
//      - "- [ ] AC-N:"            (empty after colon)
//   B. workflow: frontmatter field (SLICE-82):
//      When present, the value must reference an existing key in
//      .claude/workflows.yaml. Missing → VALIDATE-SLICES error on stderr.
//      When absent, no error (slice uses default_workflow).
//
// Exit code:
//   0 — no errors found, or pending/ directory absent
//   1 — at least one error found; stderr lists file:line per finding
//
// Repo root is detected by walking up from the script location, OR by reading
// the CREW_SLICE_LINT_REPO env var (used by tests + manual invocation against
// a fixture).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkflowConfig } from "./lib/workflow-config.ts";

// Canonical slice locations — first that exists wins
const PENDING_SUBDIRS = [
  path.join(".claude", "artifacts", "loop", "slices", "pending"),
  path.join("docs", "ai-loop", "slices", "pending")
];

// One line, one regex per failure mode. Each capture group is the text after
// the colon, used for diagnostic output.
const RE_AC_LINE = /^\s*-\s*\[\s*\]\s*AC-\d+:\s*(.*?)\s*$/i;
const RE_DOT_PLACEHOLDER = /^\.{2,}$/;
const RE_ANGLE_PLACEHOLDER = /^<[^>]+>$/;

// YAML frontmatter: lines between leading "---" and closing "---"
const RE_FRONTMATTER_WORKFLOW = /^workflow:\s*(\S+)\s*$/m;

function resolveRepoRoot() {
  if (process.env.CREW_SLICE_LINT_REPO) {
    return path.resolve(process.env.CREW_SLICE_LINT_REPO);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function findPendingDir(repoRoot: string): Promise<string | null> {
  for (const sub of PENDING_SUBDIRS) {
    const dir = path.join(repoRoot, sub);
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // try next
    }
  }
  return null;
}

async function listSliceFiles(pendingDir: string): Promise<string[] | null> {
  try {
    const entries = await fs.readdir(pendingDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function findPlaceholders(text: string) {
  const findings: Array<{ line: number; label: string; reason: string }> = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i]?.match(RE_AC_LINE);
    if (!m) continue;
    const after = m[1] ?? "";
    const acLabel = lines[i]?.match(/AC-\d+/i)?.[0] ?? "AC-?";
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

/** Extract the value of the `workflow:` frontmatter field, if present. */
function extractWorkflowField(text: string): string | undefined {
  // Only look inside the YAML frontmatter block (between leading --- and closing ---)
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (fmMatch === null) return undefined;
  const frontmatter = fmMatch[1] ?? "";
  const m = RE_FRONTMATTER_WORKFLOW.exec(frontmatter);
  return m?.[1];
}

/**
 * Checks the `workflow:` frontmatter field against the set of known workflows.
 * Returns an error string when the value is unknown, or null when valid/absent.
 */
function checkSliceWorkflow(
  name: string,
  text: string,
  availableWorkflows: Set<string> | null
): string | null {
  const workflowValue = extractWorkflowField(text);
  if (workflowValue === undefined || availableWorkflows === null) return null;
  if (availableWorkflows.has(workflowValue)) return null;
  const available = [...availableWorkflows].join(", ");
  return `VALIDATE-SLICES error: ${name} workflow "${workflowValue}" not declared in .claude/workflows.yaml (available: ${available})`;
}

async function loadAvailableWorkflows(repoRoot: string): Promise<Set<string> | null> {
  try {
    const workflowConfig = await loadWorkflowConfig(repoRoot);
    return new Set(Object.keys(workflowConfig.workflows));
  } catch {
    // Workflow config unavailable — skip workflow field check
    return null;
  }
}

async function main() {
  const repoRoot = resolveRepoRoot();
  const pendingDir = await findPendingDir(repoRoot);
  if (pendingDir === null) {
    process.exit(0);
  }
  const sliceFiles = await listSliceFiles(pendingDir);
  if (sliceFiles === null) {
    process.exit(0);
  }

  const availableWorkflows = await loadAvailableWorkflows(repoRoot);

  let totalFindings = 0;
  for (const name of sliceFiles) {
    const full = path.join(pendingDir, name);
    const text = await fs.readFile(full, "utf8");

    // A. AC-placeholder checks
    for (const f of findPlaceholders(text)) {
      process.stderr.write(
        `[validate-slices] ${name}:${f.line}: ${f.label} is a ${f.reason} — fill with concrete, verifiable language before opening the slice\n`
      );
      totalFindings += 1;
    }

    // B. workflow: frontmatter field check (SLICE-82)
    const workflowErr = checkSliceWorkflow(name, text, availableWorkflows);
    if (workflowErr !== null) {
      process.stderr.write(workflowErr + "\n");
      totalFindings += 1;
    }
  }

  if (totalFindings > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[validate-slices] fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
