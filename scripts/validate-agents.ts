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
const MAX_LINES = 500;

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

async function findAgentFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.join(root, entry.name));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return out;
}

function checkRequiredFields(fm: Record<string, string>, label: string, errors: string[]) {
  for (const field of ["name", "description", "model"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

function checkFileName(
  filePath: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  if (!fm["name"]) return;
  const baseName = path.basename(filePath, ".md");
  if (baseName !== fm["name"]) {
    errors.push(
      `${label}: file name "${baseName}.md" does not match frontmatter name "${fm["name"]}"`
    );
  }
}

function checkLineCount(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const lines = text.split("\n").length;
  const cap = fm["maxLines"] ? parseInt(fm["maxLines"], 10) : MAX_LINES;
  if (lines > cap) {
    errors.push(`${label}: ${lines} lines exceeds the ${cap}-line agent prompt cap`);
  }
}

function checkRequiredSections(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  // The lead is a user-facing coordinator; it writes final-synthesis,
  // not handoffs to itself. The Report contract requirement applies to
  // teammate roles that hand off back to the lead.
  const isLead = fm["name"] === "lead";
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

function checkDuplicateNames(
  agents: Array<{ label: string; fm: Record<string, string> | null }>,
  errors: string[]
) {
  const byName = new Map<string, string>();
  for (const a of agents) {
    if (!a.fm?.["name"]) continue;
    const name = a.fm["name"];
    if (byName.has(name)) {
      errors.push(`duplicate agent name "${name}" at ${a.label} and ${byName.get(name)}`);
    } else {
      byName.set(name, a.label);
    }
  }
}

export async function validateAgents(agentsRoot = AGENTS_ROOT) {
  const files = await findAgentFiles(agentsRoot);
  const errors: string[] = [];
  const agents: Array<{
    label: string;
    filePath: string;
    fm: Record<string, string>;
    text: string;
  }> = [];

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
    checkLineCount(text, fm, label, errors);
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
