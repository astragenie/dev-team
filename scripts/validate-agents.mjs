#!/usr/bin/env node

// Agent prompt quality-bar validator. See docs/governance.md
// "Agent prompt size bar" + FEAT-035 for the rule rationale.
//
// Errors (fail CI):
//   - missing required frontmatter: name, description, model
//   - <role>.md exceeds 300 lines
//   - missing required body section: identity intro + "## Report contract"
//   - duplicate agent name across the directory
//   - file name does not match frontmatter `name`
//
// The 300-line cap is generous compared to the previous ≤200 soft rule:
// it admits modest cross-cutting sections (context efficiency, shell
// pre-check, depth control) without forcing premature skill extraction.
// Lines beyond 300 should push to a skill the agent invokes on demand.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");
const MAX_LINES = 300;

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

/** @param {string} root */
async function findAgentFiles(root) {
  /** @type {string[]} */
  const out = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.join(root, entry.name));
      }
    }
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") throw err;
  }
  return out;
}

/** @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkRequiredFields(fm, label, errors) {
  for (const field of ["name", "description", "model"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

/** @param {string} filePath @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkFileName(filePath, fm, label, errors) {
  if (!fm.name) return;
  const baseName = path.basename(filePath, ".md");
  if (baseName !== fm.name) {
    errors.push(
      `${label}: file name "${baseName}.md" does not match frontmatter name "${fm.name}"`
    );
  }
}

/** @param {string} text @param {string} label @param {string[]} errors */
function checkLineCount(text, label, errors) {
  const lines = text.split("\n").length;
  if (lines > MAX_LINES) {
    errors.push(`${label}: ${lines} lines exceeds the ${MAX_LINES}-line agent prompt cap`);
  }
}

/** @param {string} text @param {Record<string, string>} fm @param {string} label @param {string[]} errors */
function checkRequiredSections(text, fm, label, errors) {
  // The lead is a user-facing coordinator; it writes final-synthesis,
  // not handoffs to itself. The Report contract requirement applies to
  // teammate roles that hand off back to the lead.
  const isLead = fm.name === "lead";
  if (!isLead && !/^##\s+Report contract\b/im.test(text)) {
    errors.push(`${label}: missing required section "## Report contract"`);
  }
  // Identity intro = a non-frontmatter "You are the <role>" or "You are a <role>"
  // statement somewhere in the body. Loose check; relies on convention.
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  if (!/\byou are (?:the|a|an) [\w-]+/i.test(body)) {
    errors.push(`${label}: missing identity intro ("You are the/a <role>" statement)`);
  }
}

/**
 * @param {Array<{label: string, fm: Record<string, string> | null}>} agents
 * @param {string[]} errors
 */
function checkDuplicateNames(agents, errors) {
  const byName = new Map();
  for (const a of agents) {
    if (!a.fm?.name) continue;
    if (byName.has(a.fm.name)) {
      errors.push(`duplicate agent name "${a.fm.name}" at ${a.label} and ${byName.get(a.fm.name)}`);
    } else {
      byName.set(a.fm.name, a.label);
    }
  }
}

export async function validateAgents(agentsRoot = AGENTS_ROOT) {
  const files = await findAgentFiles(agentsRoot);
  /** @type {string[]} */
  const errors = [];
  const agents = [];

  for (const filePath of files) {
    const label = path.relative(path.dirname(agentsRoot), filePath).replace(/\\/g, "/");
    const text = await fs.readFile(filePath, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm) {
      errors.push(`${label}: missing or malformed frontmatter block`);
      continue;
    }
    agents.push({ label, filePath, fm, text });
    checkRequiredFields(fm, label, errors);
    checkFileName(filePath, fm, label, errors);
    checkLineCount(text, label, errors);
    checkRequiredSections(text, fm, label, errors);
  }
  checkDuplicateNames(agents, errors);
  return { ok: errors.length === 0, errors, agentCount: agents.length };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateAgents();
  if (!result.ok) {
    console.error(`Agent validation failed: ${result.errors.length} error(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`Agents OK: ${result.agentCount} agent(s) checked.`);
  }
}
