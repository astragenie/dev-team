import fs from "node:fs/promises";
import path from "node:path";

const DEPLOYMENT_GUIDANCE_PATH = [".claude", "crew", "deployment.md"];
// Legacy path retained for read-side fallback so repos installed before the
// engineering-os -> crew rename still surface their deployment guidance.
// Writes always go to the new path; installer migration cleans the legacy
// file up.
const LEGACY_DEPLOYMENT_GUIDANCE_PATH = [".claude", "engineering-os", "deployment.md"];
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
];
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
const DEPLOYMENT_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".toml", ".tf", ".tfvars", ".sh"]);

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {string | null | undefined} value
 * @returns {string[]}
 */
function toList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((/** @type {string} */ item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {(string | null | undefined)[]} values
 * @returns {string[]}
 */
function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} label
 * @param {string | null | undefined} value
 * @returns {string}
 */
function renderField(label, value) {
  return `- ${label}: ${value || "-"}`;
}

/**
 * @param {string} label
 * @param {string | string[] | null | undefined} value
 * @returns {string}
 */
function renderListField(label, value) {
  const items = Array.isArray(value) ? value : toList(/** @type {string | null | undefined} */ (value));
  if (items.length === 0) {
    return `- ${label}: -`;
  }
  return [`- ${label}:`, ...items.map((/** @type {string} */ item) => `  - ${item}`)].join("\n");
}

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
function fileLooksLikeDeploymentClue(relativePath) {
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

  // relativePath is normalized to forward slashes in collectDeploymentClues,
  // so split on "/" rather than path.sep.
  const segments = relativePath.split("/");
  const underDeploymentDir = segments.some((/** @type {string} */ segment) => DEPLOYMENT_DIR_HINTS.has(segment));
  if (!underDeploymentDir) {
    return false;
  }

  return DEPLOYMENT_EXTENSIONS.has(path.extname(baseName));
}

/**
 * @param {string} repoPath
 * @param {string} relativeDir
 * @param {number} depth
 * @param {Set<string>} out
 * @returns {Promise<void>}
 */
async function collectDeploymentClues(repoPath, relativeDir, depth, out) {
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
    // would break the startsWith(".github/workflows/") and startsWith(".circleci/")
    // checks in fileLooksLikeDeploymentClue, and would return non-POSIX
    // clue strings that downstream consumers (tests, guidance docs) don't
    // expect. Matches the convention used by claims.mjs:toRepoRelative.
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

/**
 * @param {string} repoPath
 * @returns {string}
 */
function guidancePath(repoPath) {
  return path.join(repoPath, ...DEPLOYMENT_GUIDANCE_PATH);
}

/**
 * @param {string} repoPath
 * @returns {Promise<string | null>}
 */
async function readableGuidancePath(repoPath) {
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

/**
 * @param {string} body
 * @param {string} label
 * @returns {string}
 */
function extractField(body, label) {
  const match = body.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

/**
 * @param {string} repoPath
 */
export async function discoverDeploymentClues(repoPath) {
  const clues = new Set();
  await collectDeploymentClues(repoPath, "", MAX_DEPTH, clues);

  return {
    repoPath,
    clues: [...clues].sort(),
    guidancePath: guidancePath(repoPath)
  };
}

/**
 * @param {string} repoPath
 */
export async function readDeploymentGuidanceSummary(repoPath) {
  const filePath = await readableGuidancePath(repoPath);
  if (!filePath) {
    return null;
  }

  const stat = await fs.stat(filePath);
  const body = await fs.readFile(filePath, "utf8");
  const [heading = ""] = body.split("\n");
  return {
    path: filePath,
    title: heading.replace(/^#\s+/, "").trim(),
    summary: extractField(body, "Summary"),
    discoveryStatus: extractField(body, "Discovery Status"),
    updatedAt: stat.mtime.toISOString()
  };
}

/**
 * @param {string} repoPath
 * @param {{ title?: string, owner?: string, discoveryStatus?: string, verifiedFrom?: string,
 *           summary?: string, build?: string, deploy?: string, environments?: string,
 *           logs?: string, metrics?: string, alerts?: string, telemetry?: string,
 *           clues?: string, missing?: string, refreshWhen?: string, next?: string }} [fields]
 */
export async function writeDeploymentGuidance(repoPath, fields = {}) {
  const filePath = guidancePath(repoPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const discovered = await discoverDeploymentClues(repoPath);
  const mergedClues = uniq([...discovered.clues, ...toList(fields.clues)]);
  const contents = [
    `# Deployment Guidance: ${fields.title || "Repo Deployment Model"}`,
    "",
    renderField("Updated", nowIso()),
    renderField("Owner", fields.owner || "lead-session"),
    renderField("Discovery Status", fields.discoveryStatus || "repo-derived"),
    renderListField("Verified From", fields.verifiedFrom),
    renderField("Summary", fields.summary),
    renderField("Build Path", fields.build),
    renderField("Deploy Path", fields.deploy),
    renderListField("Environments", fields.environments),
    renderField("Logs", fields.logs),
    renderField("Metrics", fields.metrics),
    renderField("Alerts / Incidents", fields.alerts),
    renderField("Telemetry / Events", fields.telemetry),
    renderListField("Source Clues", mergedClues),
    renderListField("Still Missing", fields.missing),
    renderField("Refresh When", fields.refreshWhen || fields.next),
    ""
  ].join("\n");

  await fs.writeFile(filePath, `${contents}\n`);

  return {
    kind: "deployment-guidance",
    path: filePath,
    title: fields.title || "Repo Deployment Model",
    clues: mergedClues
  };
}
