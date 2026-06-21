import fs from "node:fs/promises";
import path from "node:path";
import { FEATURES, type FeatureName } from "./features-service.ts";

interface ParsedOverride {
  feature: string;
  enabled: boolean;
}

/**
 * Parse `--features cost-hygiene=on,shell-preflight=off` into structured overrides.
 * Unknown feature names are rejected loudly so a typo never silently noops.
 */
export function parseFeatureOverrides(raw: string | null | undefined): ParsedOverride[] {
  if (!raw) return [];
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const result: ParsedOverride[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      throw new Error(`Invalid feature override "${part}". Expected NAME=on|off.`);
    }
    const feature = part.slice(0, eq).trim();
    const valueRaw = part
      .slice(eq + 1)
      .trim()
      .toLowerCase();
    if (!(feature in FEATURES)) {
      throw new Error(`Unknown feature "${feature}". Known: ${Object.keys(FEATURES).join(", ")}`);
    }
    let enabled: boolean;
    if (valueRaw === "on" || valueRaw === "true" || valueRaw === "1") enabled = true;
    else if (valueRaw === "off" || valueRaw === "false" || valueRaw === "0") enabled = false;
    else throw new Error(`Invalid value for "${feature}": "${valueRaw}". Use on|off.`);
    result.push({ feature, enabled });
  }
  return result;
}

interface CrewConfig {
  features?: Record<string, { enabled: boolean }>;
  [key: string]: unknown;
}

export async function readCrewConfigOrEmpty(repoPath: string): Promise<CrewConfig> {
  const configPath = path.join(repoPath, ".claude", "crew.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as CrewConfig;
    return {};
  } catch {
    return {};
  }
}

export interface CostSetupResult {
  configPath: string;
  written: boolean;
  features: Array<{ name: string; enabled: boolean; default: boolean }>;
}

/**
 * Idempotently seed crew.json with the FEATURES registry defaults.
 * Existing user-set values are preserved. Overrides take precedence over both.
 * Returns { written: false } when on-disk content already matches the target.
 */
export async function runCostSetup(
  repoPath: string,
  overrides: ParsedOverride[] = []
): Promise<CostSetupResult> {
  const configPath = path.join(repoPath, ".claude", "crew.json");
  const existing = await readCrewConfigOrEmpty(repoPath);
  const features: Record<string, { enabled: boolean }> = {
    ...(existing.features ?? {})
  };

  // Seed any missing feature with its registry default.
  for (const [name, meta] of Object.entries(FEATURES)) {
    if (!(name in features)) {
      features[name] = { enabled: meta.default };
    }
  }

  // Apply explicit overrides last.
  for (const ov of overrides) {
    features[ov.feature] = { enabled: ov.enabled };
  }

  const next: CrewConfig = { ...existing, features };
  const nextSerialized = JSON.stringify(next, null, 2) + "\n";

  let prevSerialized = "";
  try {
    prevSerialized = await fs.readFile(configPath, "utf8");
  } catch {
    prevSerialized = "";
  }

  let written = false;
  if (prevSerialized !== nextSerialized) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, nextSerialized, "utf8");
    written = true;
  }

  const summary = Object.entries(features).map(([name, value]) => ({
    name,
    enabled: value.enabled,
    default: FEATURES[name as FeatureName]?.default ?? true
  }));

  return { configPath, written, features: summary };
}
