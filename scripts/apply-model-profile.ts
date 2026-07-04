#!/usr/bin/env node
// scripts/apply-model-profile.ts — FEAT-crew-architecture-review Section 7, Decision 4
//
// Rewrites each agents/*.md frontmatter `model:` field from its current tier
// value (under the source profile, default "claude") to the target profile's
// value for that same tier. No runtime dependency: an agent file always
// carries a concrete `model:` value at rest — this script only changes *how*
// that value got written, never how it is read at dispatch time. Running
// this script is entirely optional; nothing else in the repo requires
// models.yaml to exist, and no behavior changes unless this CLI is invoked.
//
// CLI: node scripts/apply-model-profile.ts --profile <name> [--dry-run] [--source <name>]
//   --dry-run   print the planned changes without writing any file
//   --source    profile to read the CURRENT tier from (default: models.yaml's default_profile)
// Exit 1 on: missing --profile, unknown profile name, malformed models.yaml.
// An agent whose current `model:` value doesn't map to a known tier under
// the source profile is reported as skipped, not a hard failure — mixed-tier
// repos during a partial migration should not block the whole run.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  ModelsConfigSchema,
  MODEL_TIERS,
  type ModelsConfig,
  type ModelTier
} from "./lib/models/schema.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MODELS_YAML_PATH = path.join(REPO_ROOT, "models.yaml");
const DEFAULT_AGENTS_DIR = path.join(REPO_ROOT, "agents");

export async function loadModelsConfig(
  modelsYamlPath = DEFAULT_MODELS_YAML_PATH
): Promise<ModelsConfig> {
  const raw = await fs.readFile(modelsYamlPath, "utf8");
  return ModelsConfigSchema.parse(parseYaml(raw));
}

export function resolveProfile(
  config: ModelsConfig,
  profileName: string
): Record<ModelTier, string> {
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(
      `Unknown model profile "${profileName}". Known profiles: ${Object.keys(config.profiles).join(", ")}`
    );
  }
  return profile;
}

/** Reverse-maps a concrete model value to its tier name under `profile`. */
export function tierForModel(profile: Record<ModelTier, string>, model: string): ModelTier | null {
  for (const tier of MODEL_TIERS) {
    if (profile[tier] === model) return tier;
  }
  return null;
}

function readFrontmatterModel(text: string): string | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return null;
  const m = match[1].match(/^model:\s*(.+)$/m);
  return m?.[1]?.trim() ?? null;
}

function replaceFrontmatterModel(text: string, newModel: string): string {
  return text.replace(
    /^(---\r?\n[\s\S]*?\r?\n)model:\s*.+$/m,
    (_full, prefix: string) => `${prefix}model: ${newModel}`
  );
}

async function listAgentFiles(agentsDir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(agentsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(agentsDir, e.name));
}

export interface AgentModelChange {
  file: string;
  fromModel: string;
  toModel: string;
  tier: ModelTier;
}
export interface AgentModelSkip {
  file: string;
  reason: string;
}
export interface ApplyProfileResult {
  changes: AgentModelChange[];
  skipped: AgentModelSkip[];
}

export interface ApplyModelProfileOpts {
  profileName: string;
  sourceProfileName?: string;
  agentsDir?: string;
  modelsYamlPath?: string;
  dryRun?: boolean;
}

/** Applies `opts.profileName` to every agents/*.md file. Pure-ish: file writes are the only side effect, skipped entirely when dryRun. */
export async function applyModelProfile(opts: ApplyModelProfileOpts): Promise<ApplyProfileResult> {
  const modelsYamlPath = opts.modelsYamlPath ?? DEFAULT_MODELS_YAML_PATH;
  const agentsDir = opts.agentsDir ?? DEFAULT_AGENTS_DIR;
  const config = await loadModelsConfig(modelsYamlPath);
  const sourceProfileName = opts.sourceProfileName ?? config.default_profile;
  const targetProfile = resolveProfile(config, opts.profileName);
  const sourceProfile = resolveProfile(config, sourceProfileName);

  const changes: AgentModelChange[] = [];
  const skipped: AgentModelSkip[] = [];

  for (const filePath of await listAgentFiles(agentsDir)) {
    const text = await fs.readFile(filePath, "utf8");
    const currentModel = readFrontmatterModel(text);
    if (currentModel === null) {
      skipped.push({ file: filePath, reason: "no model: field in frontmatter" });
      continue;
    }
    const tier = tierForModel(sourceProfile, currentModel);
    if (tier === null) {
      skipped.push({
        file: filePath,
        reason: `model "${currentModel}" is not a recognized "${sourceProfileName}" tier value`
      });
      continue;
    }
    const toModel = targetProfile[tier];
    if (toModel === currentModel) continue; // already correct — no-op
    changes.push({ file: filePath, fromModel: currentModel, toModel, tier });
    if (!opts.dryRun) {
      await fs.writeFile(filePath, replaceFrontmatterModel(text, toModel), "utf8");
    }
  }

  return { changes, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const profileIdx = args.indexOf("--profile");
  const profileName = profileIdx > -1 ? args[profileIdx + 1] : undefined;
  const sourceIdx = args.indexOf("--source");
  const sourceProfileName = sourceIdx > -1 ? args[sourceIdx + 1] : undefined;
  const dryRun = args.includes("--dry-run");

  if (!profileName) {
    console.error("apply-model-profile: --profile <name> is required");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await applyModelProfile({
      profileName,
      ...(sourceProfileName !== undefined ? { sourceProfileName } : {}),
      dryRun
    });
    for (const c of result.changes) {
      console.log(
        `${dryRun ? "[dry-run] " : ""}${path.relative(REPO_ROOT, c.file)}: ${c.fromModel} -> ${c.toModel} (${c.tier})`
      );
    }
    for (const s of result.skipped) {
      console.log(`skipped ${path.relative(REPO_ROOT, s.file)}: ${s.reason}`);
    }
    console.log(
      `apply-model-profile: ${result.changes.length} change(s), ${result.skipped.length} skipped` +
        (dryRun ? " (dry-run, nothing written)" : "")
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`apply-model-profile: FAILED — ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
