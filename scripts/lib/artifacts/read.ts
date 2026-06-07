// read.ts — ArtifactReader: pure read / resolve operations.
// Part of the ISP split from scripts/lib/artifacts.mjs (AC-1).

import fs from "node:fs/promises";
import path from "node:path";
import type { ArtifactFields } from "./types.ts";

export type { ArtifactFields } from "./types.ts";
export type { CostBreakdown, CostOutcome } from "./types.ts";

// ---------------------------------------------------------------------------
// Interfaces (AC-6)
// ---------------------------------------------------------------------------

export interface ArtifactConfig {
  directory: string;
  prefix: string;
  render: (f: ArtifactFields) => string;
}

/** Reads repo layout information. */
export interface ArtifactReader {
  buildRepoLayoutBlock(repoPath: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// buildRepoLayoutBlock
// ---------------------------------------------------------------------------

async function safeReaddirStrings(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)) as string[];
  } catch {
    return [];
  }
}

async function readSkillDirs(repoPath: string): Promise<string> {
  try {
    const entries = (await fs.readdir(path.join(repoPath, "skills"), {
      withFileTypes: true
    })) as import("node:fs").Dirent[];
    const joined = entries
      .filter((e) => e.isDirectory())
      .map((e) => `${e.name}/`)
      .join(", ");
    return joined || "(not found)";
  } catch {
    return "(not found)";
  }
}

async function readNpmScripts(repoPath: string): Promise<string> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repoPath, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return Object.keys(pkg.scripts ?? {}).join(", ") || "(not found)";
  } catch {
    return "(not found)";
  }
}

export async function buildRepoLayoutBlock(repoPath: string): Promise<string> {
  const scripts =
    (await safeReaddirStrings(path.join(repoPath, "scripts")))
      .filter((e) => e.endsWith(".mjs"))
      .join(", ") || "(not found)";
  const agents =
    (await safeReaddirStrings(path.join(repoPath, "agents")))
      .filter((e) => e.endsWith(".md"))
      .join(", ") || "(not found)";
  const skillDirs = await readSkillDirs(repoPath);
  const tests =
    (await safeReaddirStrings(path.join(repoPath, "tests")))
      .filter((e) => e.endsWith(".mjs"))
      .join(", ") || "(not found)";
  const npmScripts = await readNpmScripts(repoPath);
  return [
    "",
    "## Repo Layout (auto-discovered at handoff write time)",
    `scripts/: ${scripts}`,
    `agents/: ${agents}`,
    `skills/: ${skillDirs}`,
    `tests/: ${tests}`,
    `npm scripts: ${npmScripts}`,
    ""
  ].join("\n");
}
