// read.ts — discoverDeploymentClues + readDeploymentGuidanceSummary.
// Part of the split from deployment-guidance.mjs (AC-3).

import fs from "node:fs/promises";
import path from "node:path";
import { getCachedArtifact } from "../artifact-cache.mjs";

const DEPLOYMENT_GUIDANCE_PATH = [".claude", "crew", "deployment.md"] as const;
// Legacy path retained for read-side fallback so repos installed before the
// engineering-os -> crew rename still surface their deployment guidance.
const LEGACY_DEPLOYMENT_GUIDANCE_PATH = [
  ".claude",
  "engineering-os",
  "deployment.md"
] as const;
const MAX_CLUES = 30;
const MAX_DEPTH = 3;
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".idea",
  ".vscode"
]);
const ALWAYS_INCLUDE_FILES = [
  /^Dockerfile(?:\..+)?$/,
  /^docker-compose(?:\..+)?\.ya?ml$/,
  /^compose(?:\..+)?\.ya?ml$/,
  /^cloudbuild(?:\..+)?\.ya?ml$/,
  /^skaffold(?:\..+)?\.ya?ml$/,
  /^render\.ya?ml$/,
  /^fly\.toml$/,
  /^railway\.json$/,
  /^Procfile$/,
  /^vercel\.json$/,
  /^netlify\.toml$/,
  /^wrangler\.toml$/
] as const;
const DEPLOYMENT_DIR_HINTS = new Set([
  ".github",
  ".circleci",
  ".gitlab",
  "deploy",
  "deployment",
  "infra",
  "ops",
  "k8s",
  "helm",
  "charts",
  "terraform",
  "manifests"
]);
const DEPLOYMENT_EXTENSIONS = new Set([
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".tf",
  ".tfvars",
  ".sh"
]);

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function fileLooksLikeDeploymentClue(relativePath: string): boolean {
  const baseName = path.basename(relativePath);
  if (ALWAYS_INCLUDE_FILES.some((pattern) => pattern.test(baseName))) {
    return true;
  }

  if (relativePath.startsWith(".github/workflows/")) {
    return baseName.endsWith(".yml") || baseName.endsWith(".yaml");
  }

  if (relativePath.startsWith(".circleci/")) {
    return true;
  }

  // relativePath is normalized to forward slashes, so split on "/" rather than path.sep.
  const segments = relativePath.split("/");
  const underDeploymentDir = segments.some((segment) => DEPLOYMENT_DIR_HINTS.has(segment));
  if (!underDeploymentDir) {
    return false;
  }

  return DEPLOYMENT_EXTENSIONS.has(path.extname(baseName));
}

async function collectDeploymentClues(
  repoPath: string,
  relativeDir: string,
  depth: number,
  out: Set<string>
): Promise<void> {
  if (depth < 0 || out.size >= MAX_CLUES) {
    return;
  }

  const absoluteDir = path.join(repoPath, relativeDir);
  if (!(await pathExists(absoluteDir))) {
    return;
  }

  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    if (out.size >= MAX_CLUES) {
      return;
    }

    // Normalize to forward slashes so classification and output are
    // platform-agnostic. On Windows, path.join produces backslashes which
    // would break the startsWith(".github/workflows/") checks.
    const rawRelativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const relativePath = rawRelativePath.split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      await collectDeploymentClues(repoPath, relativePath, depth - 1, out);
      continue;
    }

    if (entry.isFile() && fileLooksLikeDeploymentClue(relativePath)) {
      out.add(relativePath);
    }
  }
}

export function guidancePath(repoPath: string): string {
  return path.join(repoPath, ...DEPLOYMENT_GUIDANCE_PATH);
}

async function readableGuidancePath(repoPath: string): Promise<string | null> {
  const primary = guidancePath(repoPath);
  if (await pathExists(primary)) {
    return primary;
  }
  const legacy = path.join(repoPath, ...LEGACY_DEPLOYMENT_GUIDANCE_PATH);
  if (await pathExists(legacy)) {
    return legacy;
  }
  return null;
}

function extractField(body: string, label: string): string {
  const match = body.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
  return match && match[1] !== undefined ? match[1].trim() : "";
}

export interface DeploymentClues {
  repoPath: string;
  clues: string[];
  guidancePath: string;
}

export async function discoverDeploymentClues(repoPath: string): Promise<DeploymentClues> {
  const clues = new Set<string>();
  await collectDeploymentClues(repoPath, "", MAX_DEPTH, clues);

  return {
    repoPath,
    clues: [...clues].sort(),
    guidancePath: guidancePath(repoPath)
  };
}

export interface DeploymentGuidanceSummary {
  path: string;
  title: string;
  summary: string;
  discoveryStatus: string;
  updatedAt: string;
}

export async function readDeploymentGuidanceSummary(
  repoPath: string
): Promise<DeploymentGuidanceSummary | null> {
  const filePath = await readableGuidancePath(repoPath);
  if (!filePath) {
    return null;
  }

  const { body, mtimeMs } = await getCachedArtifact(filePath);
  const [heading = ""] = body.split("\n");
  return {
    path: filePath,
    title: heading.replace(/^#\s+/, "").trim(),
    summary: extractField(body, "Summary"),
    discoveryStatus: extractField(body, "Discovery Status"),
    updatedAt: new Date(mtimeMs).toISOString()
  };
}
