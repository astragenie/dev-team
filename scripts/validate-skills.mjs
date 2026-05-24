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

/** @param {string} text */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  /** @type {Record<string, string>} */
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

/** @param {string} isoDate */
function daysSince(isoDate) {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

/** @param {string} root */
async function findSkillFiles(root) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  async function walk(dir) {
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
    if (err.code !== "ENOENT") throw err;
  }
  return out;
}

/** @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkRequiredFields(fm, label, errors) {
  for (const field of ["name", "tier", "description"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

/** @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkTier(fm, label, errors) {
  if (fm.tier && !VALID_TIERS.has(fm.tier)) {
    errors.push(`${label}: tier "${fm.tier}" not in {${[...VALID_TIERS].join(", ")}}`);
  }
}

/** @param {string} filePath @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkDirectoryName(filePath, fm, label, errors) {
  if (!fm.name) return;
  const dirName = path.basename(path.dirname(filePath));
  if (dirName !== fm.name) {
    errors.push(
      `${label}: directory name "${dirName}" does not match frontmatter name "${fm.name}"`
    );
  }
}

/** @param {string} text @param {string} label @param {string[]} errors */
function checkLineCount(text, label, errors) {
  const lines = text.split("\n").length;
  if (lines > MAX_LINES) {
    errors.push(`${label}: ${lines} lines exceeds the ${MAX_LINES}-line skill quality bar`);
  }
}

/** @param {Record<string, string>} fm @param {string} label @param {string[]} warnings */
function checkRecommendedFields(fm, label, warnings) {
  for (const field of ["owner", "last_reviewed", "triggers"]) {
    if (!fm[field]) warnings.push(`${label}: missing recommended frontmatter "${field}"`);
  }
  if (fm.last_reviewed) {
    const days = daysSince(fm.last_reviewed);
    if (days > STALE_REVIEW_DAYS) {
      warnings.push(`${label}: last_reviewed ${days} days ago (>${STALE_REVIEW_DAYS}d stale)`);
    }
  }
}

function checkSectionHeadings(text, label, warnings) {
  const triggerHint = /^##\s+(Trigger|When to Use|Use this|Detection)/im.test(text);
  if (!triggerHint) warnings.push(`${label}: no detectable Trigger / When-to-Use section heading`);
  const doneHint = /^##\s+(Done|Acceptance|Stop when|Completion)/im.test(text);
  if (!doneHint)
    warnings.push(`${label}: no detectable Done / Acceptance / Stop-when section heading`);
}

function checkDuplicateNames(skills, errors) {
  const byName = new Map();
  for (const s of skills) {
    if (!s.fm?.name) continue;
    if (byName.has(s.fm.name)) {
      errors.push(`duplicate skill name "${s.fm.name}" at ${s.label} and ${byName.get(s.fm.name)}`);
    } else {
      byName.set(s.fm.name, s.label);
    }
  }
}

export async function validateSkills(skillsRoot = SKILLS_ROOT) {
  const files = await findSkillFiles(skillsRoot);
  const errors = [];
  const warnings = [];
  const skills = [];

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
