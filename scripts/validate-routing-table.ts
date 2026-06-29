#!/usr/bin/env node
// Routing-table CI linter. See FEAT-021 for rationale.
// Pass 1: Reads docs/routing-table.md, extracts skill IDs (plugin:skill),
//   validates each against local skills/ tree or installed plugin cache.
// Pass 2: Cross-checks routing-table (agent, skill-path) pairs against
//   each crew agent's "### Skills you consult" H3 block.
// Set CREW_VALIDATE_ROUTING_TABLE=1 to enable; skips silently otherwise.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Allow env overrides for testing
const ROUTING_TABLE = process.env.CREW_VALIDATE_ROUTING_TABLE_FILE
  ? path.resolve(process.env.CREW_VALIDATE_ROUTING_TABLE_FILE)
  : path.join(repoRoot, "docs", "routing-table.md");
const REPO_ROOT = process.env.CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT
  ? path.resolve(process.env.CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT)
  : repoRoot;
const PLUGINS_JSON = process.env.CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON
  ? path.resolve(process.env.CREW_VALIDATE_ROUTING_TABLE_PLUGINS_JSON)
  : path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");

const SKILL_ID_RE = /\b([a-z0-9-]+):([a-z0-9-]+)\b/g;
const CARVEOUT_PLUGIN = /^context7/;
const CARVEOUT_EXT = /\.(tf|mjs|md|js|ts|json|yaml|yml|sh)$/;

// Cross-check constants (Pass 2)
const KNOWN_CREW_ROLES = new Set([
  "lead",
  "fullstack-dev",
  "inspector",
  "verifier",
  "release-engineer",
  "researcher",
  "architect",
  "uxdesigner",
  "copywriter"
]);
/** Matches any crew role token in the Route-to column. */
const CREW_ROLE_IN_CELL_RE =
  /\b(lead|fullstack-dev|backend-dev|frontend-dev|inspector|verifier|release-engineer|researcher|architect|uxdesigner|copywriter)\b/gi;
/** Matches skills/<tier>/<name> paths in the Notes column. */
const SKILL_PATH_IN_NOTES_RE = /skills\/(universal|workflow|domain|meta)\/([a-z0-9-]+)\/?/g;

function isCarvedOut(plugin: string, skill: string): boolean {
  return CARVEOUT_PLUGIN.test(plugin) || CARVEOUT_EXT.test(skill);
}

async function fileExists(dir: string, name: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, name));
    return true;
  } catch {
    return false;
  }
}

async function skillFileMatches(skillMdPath: string, invocableName: string): Promise<boolean> {
  const text = await fs.readFile(skillMdPath, "utf8");
  const m = text.match(/^---[\s\S]*?^---/m);
  const name = m?.[0]?.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  return name === invocableName;
}

async function walkSkillsForInvocable(dir: string, invocableName: string): Promise<boolean> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await walkSkillsForInvocable(full, invocableName)) return true;
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      if (await skillFileMatches(full, invocableName)) return true;
    }
  }
  return false;
}

async function findLocalInvocable(root: string, invocableName: string): Promise<boolean> {
  if (await walkSkillsForInvocable(path.join(root, "skills"), invocableName)) return true;
  // commands/<name>.md (slash commands)
  if (await fileExists(path.join(root, "commands"), `${invocableName}.md`)) return true;
  // agents/<name>.md (subagents)
  if (await fileExists(path.join(root, "agents"), `${invocableName}.md`)) return true;
  return false;
}

async function findExternalInvocable(
  pluginsJson: string,
  plugin: string,
  invocable: string
): Promise<boolean> {
  let data: unknown;
  try {
    data = JSON.parse(await fs.readFile(pluginsJson, "utf8"));
  } catch {
    return false;
  }
  const pluginsMap = (data as Record<string, unknown>)["plugins"] ?? {};
  const entries = Object.entries(pluginsMap as Record<string, unknown>);
  for (const [key, installs] of entries) {
    const pluginName = key.split("@")[0];
    if (pluginName !== plugin) continue;
    const installList = installs as Array<{ installPath: string }>;
    for (const inst of installList) {
      const skillFile = path.join(inst.installPath, "skills", invocable, "SKILL.md");
      const commandFile = path.join(inst.installPath, "commands", `${invocable}.md`);
      const agentFile = path.join(inst.installPath, "agents", `${invocable}.md`);
      for (const candidate of [skillFile, commandFile, agentFile]) {
        try {
          await fs.access(candidate);
          return true;
        } catch {
          // try next
        }
      }
    }
  }
  return false;
}

/**
 * Parse the "### Skills you consult" H3 block from an agent file.
 * Returns a Set of normalized skill paths (trailing slash stripped).
 */
async function parseAgentSkillBlock(filePath: string): Promise<Set<string>> {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return new Set();
  }
  const lines = text.split(/\r?\n/);
  const skills = new Set<string>();
  let inBlock = false;
  for (const line of lines) {
    if (/^###\s+Skills you consult/i.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^#{1,6}\s/.test(line)) break;
      let m;
      const re = /skills\/(universal|workflow|domain|meta)\/([a-z0-9-]+)\/?/g;
      while ((m = re.exec(line)) !== null) skills.add(`skills/${m[1]}/${m[2]}`);
    }
  }
  return skills;
}

/**
 * Extract (role, skillPath) pairs from routing-table lines.
 * Skips lines with routing-lint:ignore. Skips header separator rows.
 */
function isRoutingTableDataRow(line: string): boolean {
  if (!line.startsWith("|")) return false;
  if (/^[|\s:-]+$/.test(line)) return false; // separator row
  if (line.includes("<!-- routing-lint:ignore -->")) return false;
  return true;
}

function extractRolesFromCell(routeToCell: string): string[] {
  const roles: string[] = [];
  CREW_ROLE_IN_CELL_RE.lastIndex = 0;
  let rm;
  while ((rm = CREW_ROLE_IN_CELL_RE.exec(routeToCell)) !== null) {
    const role = (rm[1] ?? "").toLowerCase();
    if (KNOWN_CREW_ROLES.has(role) && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

function extractSkillPathsFromCell(notesCell: string): string[] {
  const skills: string[] = [];
  SKILL_PATH_IN_NOTES_RE.lastIndex = 0;
  let sm;
  while ((sm = SKILL_PATH_IN_NOTES_RE.exec(notesCell)) !== null) {
    skills.push(`skills/${sm[1]}/${sm[2]}`);
  }
  return skills;
}

function parseRoutingTablePairs(
  lines: string[]
): Array<{ role: string; skillPath: string; row: string }> {
  const pairs: Array<{ role: string; skillPath: string; row: string }> = [];
  for (const line of lines) {
    if (!isRoutingTableDataRow(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue; // [0]=empty,[1]=Signal,[2]=Route-to,[3]=Notes
    const roles = extractRolesFromCell(cells[2] ?? "");
    if (roles.length === 0) continue;
    const skillPaths = extractSkillPathsFromCell(cells[3] ?? "");
    for (const skillPath of skillPaths) {
      for (const role of roles) {
        pairs.push({ role, skillPath, row: line.trim() });
      }
    }
  }
  return pairs;
}

/**
 * Run Pass 1: skill-ID resolution.
 */
async function resolveSkillId(plugin: string, skill: string): Promise<boolean> {
  if (plugin === "crew") return findLocalInvocable(REPO_ROOT, skill);
  return findExternalInvocable(PLUGINS_JSON, plugin, skill);
}

async function checkIdsInLine(
  line: string,
  currentHeading: string,
  errors: Array<{ row: string; id: string; reason: string }>
): Promise<void> {
  if (line.includes("<!-- routing-lint:ignore -->")) return;
  SKILL_ID_RE.lastIndex = 0;
  let match;
  while ((match = SKILL_ID_RE.exec(line)) !== null) {
    const plugin = match[1] ?? "";
    const skill = match[2] ?? "";
    if (isCarvedOut(plugin, skill)) continue;
    const found = await resolveSkillId(plugin, skill);
    if (!found) {
      errors.push({ row: currentHeading, id: `${plugin}:${skill}`, reason: "not found" });
    }
  }
}

async function runIdResolutionPass(
  content: string
): Promise<Array<{ row: string; id: string; reason: string }>> {
  const lines = content.split(/\r?\n/);
  const errors: Array<{ row: string; id: string; reason: string }> = [];
  let currentHeading = "(no heading)";
  for (const line of lines) {
    if (/^#+\s/.test(line)) {
      currentHeading = line.trim();
      continue;
    }
    await checkIdsInLine(line, currentHeading, errors);
  }
  return errors;
}

/**
 * Run Pass 2: agent-block cross-check.
 */
async function runConsistencyCheck(routingTable: string, repoRootPath: string): Promise<string[]> {
  const content = await fs.readFile(routingTable, "utf8");
  const pairs = parseRoutingTablePairs(content.split(/\r?\n/));

  // Build agent → Set<skillPath> map (lazy load)
  const agentSkills = new Map<string, Set<string>>();
  for (const { role } of pairs) {
    if (!agentSkills.has(role)) {
      const agentFile = path.join(repoRootPath, "agents", `${role}.md`);
      agentSkills.set(role, await parseAgentSkillBlock(agentFile));
    }
  }

  const errors: string[] = [];
  for (const { role, skillPath, row } of pairs) {
    const skillSet = agentSkills.get(role) ?? new Set();
    if (!skillSet.has(skillPath)) {
      errors.push(
        `  - agents/${role}.md missing \`${skillPath}/\`\n` +
          `    row: ${row}\n` +
          `    action: add "... → \`${skillPath}/\`" to the "### Skills you consult" block in agents/${role}.md`
      );
    }
  }
  return errors;
}

async function main() {
  const envFlag = process.env.CREW_VALIDATE_ROUTING_TABLE;
  if (!envFlag || envFlag === "0" || envFlag === "false") {
    console.log("validate-routing-table: skipped (set CREW_VALIDATE_ROUTING_TABLE=1 to enable)");
    process.exitCode = 0;
    return;
  }

  const content = await fs.readFile(ROUTING_TABLE, "utf8");
  const errors = await runIdResolutionPass(content);

  // Pass 2: agent-block cross-check
  const consistencyErrors = await runConsistencyCheck(ROUTING_TABLE, REPO_ROOT);

  const totalErrors = errors.length + consistencyErrors.length;
  if (totalErrors > 0) {
    if (errors.length > 0) {
      console.error(`validate-routing-table: ${errors.length} unresolved skill ID(s):`);
      for (const e of errors) {
        console.error(`  - ${e.id} (row: ${e.row}) — ${e.reason}`);
      }
    }
    if (consistencyErrors.length > 0) {
      console.error(
        `validate-routing-table: ${consistencyErrors.length} agent-block consistency error(s):`
      );
      for (const msg of consistencyErrors) {
        console.error(msg);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("validate-routing-table: OK");
  }
}

await main();
