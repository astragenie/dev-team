// Global (user-scoped) framework memory: ~/.claude/crew/* and the
// @-import lines in ~/.claude/CLAUDE.md. Repos pick this up automatically;
// `installGlobal()` is the user-run setup.

import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, writeFileIfChanged } from "./util.mjs";
import {
  CONSTITUTION_TEMPLATE,
  GLOBAL_MEMORY_VERSION,
  GLOBAL_METADATA_TEMPLATE,
  WORKFLOW_TEMPLATE
} from "./templates.mjs";
import { buildWelcome } from "./welcome.mjs";

const GLOBAL_IMPORT_LINES = ["@~/.claude/crew/constitution.md", "@~/.claude/crew/workflow.md"];

const LEGACY_GLOBAL_IMPORT_LINES = [
  "@~/.claude/engineering-os/constitution.md",
  "@~/.claude/engineering-os/workflow.md"
];

/** @param {string} homeDir */
function globalPaths(homeDir) {
  const globalDir = path.join(homeDir, ".claude", "crew");
  return {
    globalDir,
    legacyGlobalDir: path.join(homeDir, ".claude", "engineering-os"),
    constitution: path.join(globalDir, "constitution.md"),
    workflow: path.join(globalDir, "workflow.md"),
    metadata: path.join(globalDir, "metadata.json"),
    claudeMd: path.join(homeDir, ".claude", "CLAUDE.md")
  };
}

/** @param {string} targetPath */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function inspectGlobalInstall() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  const metadata = await fs
    .readFile(paths.metadata, "utf8")
    .then(/** @returns {Record<string, unknown>} */ (raw) => JSON.parse(raw))
    .catch(/** @returns {null} */ () => null);
  const hasImports = await fs
    .readFile(paths.claudeMd, "utf8")
    .then((raw) => GLOBAL_IMPORT_LINES.every((line) => raw.includes(line)))
    .catch(() => false);

  const hasConstitution = await pathExists(paths.constitution);
  const hasWorkflow = await pathExists(paths.workflow);
  const hasGlobalMemory = hasConstitution && hasWorkflow && hasImports;

  return {
    hasGlobalMemory,
    globalMemoryVersion: metadata?.version || null,
    expectedGlobalMemoryVersion: GLOBAL_MEMORY_VERSION,
    globalMemoryStale: hasGlobalMemory && metadata?.version !== GLOBAL_MEMORY_VERSION,
    hasGlobalImports: hasImports,
    globalMemoryPath: path.join(homeDir, ".claude", "crew")
  };
}

export async function installGlobal() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  /** @type {string[]} */
  const writes = [];

  await migrateGlobalLegacy(paths, writes);

  const constitutionChanged = await writeFileIfChanged(
    paths.constitution,
    `${CONSTITUTION_TEMPLATE}\n`
  );
  if (constitutionChanged) {
    writes.push("~/.claude/crew/constitution.md");
  }

  const workflowChanged = await writeFileIfChanged(paths.workflow, `${WORKFLOW_TEMPLATE}\n`);
  if (workflowChanged) {
    writes.push("~/.claude/crew/workflow.md");
  }

  const metadataChanged = await writeFileIfChanged(
    paths.metadata,
    `${JSON.stringify(GLOBAL_METADATA_TEMPLATE, null, 2)}\n`
  );
  if (metadataChanged) {
    writes.push("~/.claude/crew/metadata.json");
  }

  let existing = await fs.readFile(paths.claudeMd, "utf8").catch(() => "");
  let claudeMdChanged = false;
  for (const legacyLine of LEGACY_GLOBAL_IMPORT_LINES) {
    if (existing.includes(legacyLine)) {
      const newLine = legacyLine.replace("engineering-os", "crew");
      existing = existing.replace(legacyLine, newLine);
      claudeMdChanged = true;
    }
  }
  if (claudeMdChanged) {
    await ensureDir(path.dirname(paths.claudeMd));
    await fs.writeFile(paths.claudeMd, existing);
    writes.push("~/.claude/CLAUDE.md (imports migrated)");
  }

  const missingLines = GLOBAL_IMPORT_LINES.filter((line) => !existing.includes(line));
  if (missingLines.length > 0) {
    const prefix = missingLines.join("\n");
    const next = existing ? `${prefix}\n\n${existing}` : `${prefix}\n`;
    await ensureDir(path.dirname(paths.claudeMd));
    await fs.writeFile(paths.claudeMd, next);
    writes.push("~/.claude/CLAUDE.md");
  }

  return {
    mode: "install-global",
    writes,
    global: await inspectGlobalInstall(),
    welcome: buildWelcome({ mode: "install-global", repoScoped: false })
  };
}

/**
 * @param {ReturnType<typeof globalPaths>} paths
 * @param {string[]} writes
 */
async function migrateGlobalLegacy(paths, writes) {
  if (!(await pathExists(paths.legacyGlobalDir))) {
    return;
  }
  await ensureDir(paths.globalDir);
  const entries = await fs.readdir(paths.legacyGlobalDir);
  for (const entry of entries) {
    const legacyPath = path.join(paths.legacyGlobalDir, entry);
    const targetPath = path.join(paths.globalDir, entry);
    const stat = await fs.stat(legacyPath);
    if (!stat.isFile()) {
      continue;
    }
    const targetExists = await pathExists(targetPath);
    if (!targetExists) {
      await fs.copyFile(legacyPath, targetPath);
    }
    await fs.unlink(legacyPath);
  }
  const remaining = await fs.readdir(paths.legacyGlobalDir);
  if (remaining.length === 0) {
    await fs.rmdir(paths.legacyGlobalDir);
    writes.push("~/.claude/engineering-os/ (migrated to ~/.claude/crew/)");
  }
}
