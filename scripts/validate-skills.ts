#!/usr/bin/env node

// Skill quality-bar validator. See docs/architecture/architecture.md
// "Skill Taxonomy" + FEAT-007 for the rule rationale.
//
// Errors (fail CI):
//   - missing required frontmatter: name, tier, description
//   - tier not in {universal, workflow, domain, meta}
//   - SKILL.md exceeds 200 lines
//   - duplicate skill name across the tree
//   - directory name does not match frontmatter `name`
//
// Warnings (do not fail CI; nag in output):
//   - missing recommended frontmatter: owner, last_reviewed, triggers
//   - last_reviewed older than 180 days
//   - no detectable "Trigger" / "When to Use" section heading
//   - no detectable "Done" / "Acceptance" / "Stop when" section heading

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "skills");
const VALID_TIERS = new Set(["universal", "workflow", "domain", "meta"]);
const MAX_LINES = 200;
const STALE_REVIEW_DAYS = 180;

function parseFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (kv) fm[kv[1] as string] = (kv[2] ?? "").trim();
  }
  return fm;
}

function daysSince(isoDate: string): number {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

async function findSkillFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name === "SKILL.md") out.push(full);
    }
  }
  try {
    await walk(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return out;
}

function checkRequiredFields(fm: Record<string, string>, label: string, errors: string[]) {
  for (const field of ["name", "tier", "description"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

// FEAT-167 SLICE-A: validate prompt_id (kebab-slug) and version (semver).
// Skills never require an `evals:` field in this slice.
function checkPromptIdAndVersion(fm: Record<string, string>, label: string, errors: string[]) {
  const promptId = fm["prompt_id"];
  if (!promptId) {
    errors.push(`${label}: missing required frontmatter "prompt_id"`);
  } else if (!/^[a-z][a-z0-9-]*$/.test(promptId) || /--/.test(promptId) || promptId.endsWith("-")) {
    errors.push(
      `${label}: prompt_id "${promptId}" must be kebab-slug ([a-z0-9-]+, no leading/trailing -)`
    );
  }
  const version = fm["version"];
  if (!version) {
    errors.push(`${label}: missing required frontmatter "version"`);
  } else if (!/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push(`${label}: version "${version}" must be semver MAJOR.MINOR.PATCH`);
  }
}

function checkTier(fm: Record<string, string>, label: string, errors: string[]) {
  if (fm["tier"] && !VALID_TIERS.has(fm["tier"])) {
    errors.push(`${label}: tier "${fm["tier"]}" not in {${[...VALID_TIERS].join(", ")}}`);
  }
}

function checkDirectoryName(
  filePath: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  if (!fm["name"]) return;
  const dirName = path.basename(path.dirname(filePath));
  if (dirName !== fm["name"]) {
    errors.push(
      `${label}: directory name "${dirName}" does not match frontmatter name "${fm["name"]}"`
    );
  }
}

function checkLineCount(text: string, label: string, errors: string[]) {
  const lines = text.split("\n").length;
  if (lines > MAX_LINES) {
    errors.push(`${label}: ${lines} lines exceeds the ${MAX_LINES}-line skill quality bar`);
  }
}

function checkRecommendedFields(fm: Record<string, string>, label: string, warnings: string[]) {
  for (const field of ["owner", "last_reviewed", "triggers"]) {
    if (!fm[field]) warnings.push(`${label}: missing recommended frontmatter "${field}"`);
  }
  if (fm["last_reviewed"]) {
    const days = daysSince(fm["last_reviewed"]);
    if (days > STALE_REVIEW_DAYS) {
      warnings.push(`${label}: last_reviewed ${days} days ago (>${STALE_REVIEW_DAYS}d stale)`);
    }
  }
}

function checkSectionHeadings(text: string, label: string, warnings: string[]) {
  const triggerHint = /^##\s+(Trigger|When to Use|Use this|Detection)/im.test(text);
  if (!triggerHint) warnings.push(`${label}: no detectable Trigger / When-to-Use section heading`);
  const doneHint = /^##\s+(Done|Acceptance|Stop when|Completion)/im.test(text);
  if (!doneHint)
    warnings.push(`${label}: no detectable Done / Acceptance / Stop-when section heading`);
}

function checkDuplicateNames(
  skills: Array<{ label: string; fm: Record<string, string> | null }>,
  errors: string[]
) {
  const byName = new Map<string, string>();
  for (const s of skills) {
    if (!s.fm?.["name"]) continue;
    const name = s.fm["name"];
    if (byName.has(name)) {
      errors.push(`duplicate skill name "${name}" at ${s.label} and ${byName.get(name)}`);
    } else {
      byName.set(name, s.label);
    }
  }
}

export async function validateSkills(skillsRoot = SKILLS_ROOT) {
  const files = await findSkillFiles(skillsRoot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const skills: Array<{
    label: string;
    filePath: string;
    fm: Record<string, string>;
    text: string;
  }> = [];

  for (const filePath of files) {
    const label = path.relative(path.dirname(skillsRoot), filePath).replace(/\\/g, "/");
    const text = await fs.readFile(filePath, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm) {
      errors.push(`${label}: missing or malformed frontmatter block`);
      continue;
    }
    skills.push({ label, filePath, fm, text });
    checkRequiredFields(fm, label, errors);
    checkPromptIdAndVersion(fm, label, errors);
    checkTier(fm, label, errors);
    checkDirectoryName(filePath, fm, label, errors);
    checkLineCount(text, label, errors);
    checkRecommendedFields(fm, label, warnings);
    checkSectionHeadings(text, label, warnings);
  }
  checkDuplicateNames(skills, errors);
  return { ok: errors.length === 0, errors, warnings, skillCount: skills.length };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateSkills();
  if (result.warnings.length > 0) {
    console.log(`Skill warnings (non-fatal): ${result.warnings.length}`);
    for (const w of result.warnings) console.log(`  ! ${w}`);
  }
  if (!result.ok) {
    console.error(`Skill validation failed: ${result.errors.length} error(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`Skills OK: ${result.skillCount} skill(s) checked.`);
  }
}
