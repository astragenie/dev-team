// Public installer surface. Orchestrates the per-concern submodules under
// ./installer/ and exposes `bootstrapRepo`, `initRepo`, `installGlobal`,
// `auditRepo` — the four functions the CLI dispatcher and tests import.

import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, pathExists } from "./installer/util.mjs";
import { updateClaudeMd } from "./installer/claude-md.mjs";
import { updateGitignore } from "./installer/gitignore.mjs";
import { updateSettings } from "./installer/settings.mjs";
import { writeHarnessFiles } from "./installer/harness-files.mjs";
import { writeRepoLocalGuides } from "./installer/repo-guides.mjs";
import { migrateLegacyHarness } from "./installer/legacy-migration.mjs";
import { buildWelcome } from "./installer/welcome.mjs";
import { auditRepo } from "./installer/audit.mjs";
import { installGlobal } from "./installer/global.mjs";

export { auditRepo, installGlobal };

export async function bootstrapRepo(repoPath) {
  if (!(await pathExists(repoPath))) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const writes = [];
  // Migrate first so writeHarnessFiles uses missing-only semantics on top of
  // whatever the legacy tree provides (Step 3 of the P3.1 namespace rename).
  await migrateLegacyHarness(repoPath, writes);
  await updateClaudeMd(repoPath, writes);
  await updateGitignore(repoPath, writes);
  await writeHarnessFiles(repoPath, writes);
  await writeRepoLocalGuides(repoPath, writes);
  await updateSettings(repoPath, writes);

  return {
    mode: "bootstrap",
    repoPath,
    writes,
    audit: await auditRepo(repoPath),
    welcome: buildWelcome({ mode: "bootstrap", repoScoped: true })
  };
}

export async function initRepo(repoPath, options = {}) {
  if (await pathExists(repoPath)) {
    const entries = await fs.readdir(repoPath).catch(() => []);
    if (entries.length > 0 && !options.allowExisting) {
      throw new Error(
        `Target directory already exists and is not empty: ${repoPath}. Pass --allow-existing to reuse it.`
      );
    }
  } else {
    await ensureDir(repoPath);
  }

  const writes = [];
  const gitPath = path.join(repoPath, ".git");
  if (!(await pathExists(gitPath))) {
    await ensureDir(gitPath);
    writes.push(".git/");
  }

  const result = await bootstrapRepo(repoPath);
  return {
    mode: "init",
    repoPath,
    writes: [...writes, ...result.writes],
    audit: result.audit,
    welcome: buildWelcome({ mode: "init", repoScoped: true })
  };
}
