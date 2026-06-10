import fs from "node:fs/promises";
import path from "node:path";

/**
 * Check if a feature is enabled.
 *
 * Reads config.features?.[feature]?.enabled.
 * Returns true if:
 *   - config is null/undefined
 *   - config.features is missing
 *   - config.features[feature] is missing
 *   - config.features[feature].enabled is not a boolean (malformed)
 *
 * Returns false if:
 *   - config.features[feature].enabled is explicitly false
 *
 * This default-ON policy ensures backward compatibility — features must be
 * explicitly disabled in config to be gated off.
 *
 * Every gate evaluation emits a diagnostic line on stderr (feature name +
 * resolved state) so stdout stays a clean machine-readable channel.
 */
export function isEnabled(feature: string, config: unknown): boolean {
  const enabled =
    config &&
    typeof config === "object" &&
    "features" in config &&
    config.features &&
    typeof config.features === "object" &&
    feature in config.features &&
    config.features[feature as never] &&
    typeof config.features[feature as never] === "object" &&
    "enabled" in config.features[feature as never] &&
    typeof (config.features[feature as never] as Record<string, unknown>).enabled === "boolean"
      ? (config.features[feature as never] as Record<string, unknown>).enabled === true
      : true;

  // Emit a diagnostic line on stderr (NOT stdout) so machine-readable CLI
  // JSON output stays clean. Mirrors dispatch-trace.mts's stderr convention.
  process.stderr.write(`[features] ${feature}: ${enabled ? "enabled" : "disabled"}\n`);
  return enabled;
}

/**
 * Read the crew config from <cwd>/.claude/crew.json.
 *
 * Returns the parsed object on success. On missing file or malformed JSON,
 * returns an empty object {} — NEVER throws, to ensure hooks remain robust.
 */
export async function readCrewConfig(cwd: string): Promise<unknown> {
  const configPath = path.join(cwd, ".claude", "crew.json");

  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    // Missing file, read error, or JSON parse error → return empty config
    // Hooks must not crash due to config issues
    return {};
  }
}
