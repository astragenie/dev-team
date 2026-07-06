#!/usr/bin/env node
// Validates that no final-synthesis artifact contains stale placeholder text,
// and (FEAT-188 S1a AC-1) that no grade file is a placeholder-rotted
// template — 27% of grade files were found unfilled ("- bullet" template
// text, all-zero AC scores), letting slices close silently on a rotted
// grade. This is advisory in CI today (see .github/workflows/test.yml
// advisory-validators); runner:close (runner-plugin, out of S1a scope) is
// expected to surface the same check as `grade_incomplete` at close time.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const RUNS_DIR = [".claude", "artifacts", "crew", "runs"];
const GRADES_DIR = [".claude", "artifacts", "loop", "grades"];
const STALE_PATTERNS = [/Grade missing/, /<timestamp>/];

// Matches the grade-template.md placeholder lines verbatim: "- bullet",
// "- bullet 1", "- bullet 2" (Lessons/Surprises/Followups sections).
const GRADE_PLACEHOLDER_LINE = /^- bullet(?: \d+)?\s*$/m;

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? (match[1] ?? null) : null;
}

// "Unfilled AC" — the grade template's scores default to all-0; a grade
// file left at that default never had its acceptance-criteria dimensions
// actually scored.
function scoresAllZero(text: string): boolean {
  const fm = extractFrontmatter(text);
  if (!fm) return false;
  let parsed: unknown;
  try {
    parsed = parseYaml(fm);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const scores = (parsed as Record<string, unknown>).scores;
  if (!scores || typeof scores !== "object") return false;
  const values = Object.values(scores as Record<string, unknown>);
  if (values.length === 0) return false;
  return values.every((v) => typeof v === "number" && v === 0);
}

async function validateGradeFiles(repoPath: string): Promise<string[]> {
  const gradesDir = path.join(repoPath, ...GRADES_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(gradesDir);
  } catch {
    return [];
  }
  const gradeFiles = entries.filter((name) => name.endsWith("-grade.md"));
  const errors: string[] = [];
  for (const name of gradeFiles) {
    const text = await fs.readFile(path.join(gradesDir, name), "utf8");
    if (GRADE_PLACEHOLDER_LINE.test(text)) {
      errors.push(`${name}: grade_incomplete — unfilled placeholder text ("- bullet")`);
      continue;
    }
    if (scoresAllZero(text)) {
      errors.push(`${name}: grade_incomplete — all AC scores are unfilled (0)`);
    }
  }
  return errors;
}

export async function validateSyntheses(repoPath: string): Promise<{ errors: string[] }> {
  const runsDir = path.join(repoPath, ...RUNS_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    entries = [];
  }
  const synthFiles = entries.filter((name) => name.includes("final-synthesis"));
  const errors: string[] = [];
  for (const name of synthFiles) {
    const text = await fs.readFile(path.join(runsDir, name), "utf8");
    for (const pat of STALE_PATTERNS) {
      if (pat.test(text)) {
        errors.push(`${name}: contains stale placeholder matching ${pat}`);
        break;
      }
    }
  }
  errors.push(...(await validateGradeFiles(repoPath)));
  return { errors };
}

// Cross-platform CLI main-guard: `new URL(import.meta.url).pathname` yields a
// leading-slash forward-slash path on Windows that never equals argv[1]'s
// native path, silently skipping the CLI body (AC-1 "cannot close silently"
// was broken on win32). Mirror the canonical validate-agents/validate-skills guard.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoPath = process.argv[2] || process.cwd();
  const { errors } = await validateSyntheses(repoPath);
  if (errors.length > 0) {
    console.error("validate-syntheses: stale placeholders found:");
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  } else {
    console.log("validate-syntheses: all synthesis files clean");
  }
}
