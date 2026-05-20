import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Single source of truth for the plugin and marketplace name. Everything
// downstream (cache lookup paths, generated bridge hooks, command docs)
// pulls from here so renaming the marketplace stays a one-line change in
// .claude-plugin/marketplace.json instead of a multi-place sweep.

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..", "..");

let cached = null;

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function getPluginIdentity() {
  if (cached) {
    return cached;
  }

  const marketplaceManifestPath = path.join(pluginRoot, ".claude-plugin", "marketplace.json");
  const pluginManifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");

  const [marketplace, plugin] = await Promise.all([
    readJson(marketplaceManifestPath),
    readJson(pluginManifestPath)
  ]);

  if (!marketplace?.name) {
    throw new Error(`Missing "name" field in ${marketplaceManifestPath}`);
  }
  if (!plugin?.name) {
    throw new Error(`Missing "name" field in ${pluginManifestPath}`);
  }

  cached = {
    marketplaceName: marketplace.name,
    pluginName: plugin.name,
    pluginVersion: plugin.version || null,
    pluginRoot
  };
  return cached;
}

// Returns the bash glob pattern used by generated hooks to locate the crew
// CLI inside the Claude Code plugin cache. Versioned with a glob so cache
// upgrades don't require regenerating every installed hook.
export async function getCliCacheGlob() {
  const { marketplaceName, pluginName } = await getPluginIdentity();
  return `$HOME/.claude/plugins/cache/${marketplaceName}/${pluginName}/*/scripts/crew.mjs`;
}

// Path components for embedding in JS that does fs lookups (e.g. inside the
// PostToolUse hook). Returned as the cache directory containing version
// subdirectories; the caller picks the newest version.
export async function getCliCacheDirComponents() {
  const { marketplaceName, pluginName } = await getPluginIdentity();
  return [".claude", "plugins", "cache", marketplaceName, pluginName];
}

// Used in tests only.
export function _resetCacheForTests() {
  cached = null;
}
