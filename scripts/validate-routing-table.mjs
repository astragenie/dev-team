#!/usr/bin/env node
// Routing-table skill-ID CI linter. See FEAT-021 for rationale.
// Reads docs/routing-table.md, extracts skill IDs (plugin:skill), and
// validates each against local skills/ tree or installed plugin cache.
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

/**
 * @param {string} plugin
 * @param {string} skill
 */
function isCarvedOut(plugin, skill) {
  if (CARVEOUT_PLUGIN.test(plugin)) return true;
  if (CARVEOUT_EXT.test(skill)) return true;
  return false;
}

/**
 * @param {string} dir
 * @param {string} name
 */
async function fileExists(dir, name) {
  try {
    await fs.access(path.join(dir, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @param {string} invocableName
 */
async function findLocalInvocable(root, invocableName) {
  // skills/**/SKILL.md — check name: field
  /** @param {string} dir */
  async function walkSkills(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await walkSkills(full)) return true;
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        const text = await fs.readFile(full, "utf8");
        const m = text.match(/^---[\s\S]*?^---/m);
        const name = m?.[0]?.match(/^name:\s*(.+)$/m)?.[1]?.trim();
        if (name === invocableName) return true;
      }
    }
    return false;
  }
  if (await walkSkills(path.join(root, "skills"))) return true;
  // commands/<name>.md (slash commands)
  if (await fileExists(path.join(root, "commands"), `${invocableName}.md`)) return true;
  // agents/<name>.md (subagents)
  if (await fileExists(path.join(root, "agents"), `${invocableName}.md`)) return true;
  return false;
}

/**
 * @param {string} pluginsJson
 * @param {string} plugin
 * @param {string} invocable
 */
async function findExternalInvocable(pluginsJson, plugin, invocable) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(pluginsJson, "utf8"));
  } catch {
    return false;
  }
  const entries = Object.entries(data.plugins ?? {});
  for (const [key, installs] of entries) {
    const pluginName = key.split("@")[0];
    if (pluginName !== plugin) continue;
    /** @type {Array<{ installPath: string }>} */
    const installList = /** @type {Array<{ installPath: string }>} */ (installs);
    for (const inst of installList) {
      // Check skills/, commands/, agents/ in the plugin install
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

async function main() {
  const envFlag = process.env.CREW_VALIDATE_ROUTING_TABLE;
  if (!envFlag || envFlag === "0" || envFlag === "false") {
    console.log("validate-routing-table: skipped (set CREW_VALIDATE_ROUTING_TABLE=1 to enable)");
    process.exitCode = 0;
    return;
  }

  const content = await fs.readFile(ROUTING_TABLE, "utf8");
  const lines = content.split(/\r?\n/);
  const errors = [];
  let currentHeading = "(no heading)";

  for (const line of lines) {
    if (/^#+\s/.test(line)) {
      currentHeading = line.trim();
      continue;
    }
    if (line.includes("<!-- routing-lint:ignore -->")) continue;

    let match;
    SKILL_ID_RE.lastIndex = 0;
    while ((match = SKILL_ID_RE.exec(line)) !== null) {
      const [, plugin, skill] = match;
      if (isCarvedOut(plugin, skill)) continue;
      const found =
        plugin === "crew"
          ? await findLocalInvocable(REPO_ROOT, skill)
          : await findExternalInvocable(PLUGINS_JSON, plugin, skill);
      if (!found) {
        errors.push({ row: currentHeading, id: `${plugin}:${skill}`, reason: "not found" });
      }
    }
  }

  if (errors.length > 0) {
    console.error(`validate-routing-table: ${errors.length} unresolved skill ID(s):`);
    for (const e of errors) {
      console.error(`  - ${e.id} (row: ${e.row}) — ${e.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log("validate-routing-table: OK");
  }
}

await main();
