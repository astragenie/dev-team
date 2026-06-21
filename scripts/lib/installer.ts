// Public installer surface. Orchestrates the per-concern submodules under
// ./installer/ and exposes `bootstrapRepo`, `initRepo`, `installGlobal`,
// `auditRepo` — the four functions the CLI dispatcher and tests import.

import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, pathExists } from "./installer/util.ts";
import { type Result, ok, err } from "./result.ts";
import { updateClaudeMd } from "./installer/claude-md.ts";
import { updateGitignore } from "./installer/gitignore.ts";
import { updateSettings } from "./installer/settings.ts";
import { writeHarnessFiles } from "./installer/harness-files.ts";
import { writeRepoLocalGuides } from "./installer/repo-guides.ts";
import { migrateLegacyHarness } from "./installer/legacy-migration.ts";
import { buildWelcome } from "./installer/welcome.ts";
import { auditRepo } from "./installer/audit.ts";
import { installGlobal } from "./installer/global.ts";
import { runCostSetup } from "./cost-setup.ts";

export { auditRepo, installGlobal };

export async function bootstrapRepo(repoPath: string): Promise<
  Result<
    {
      mode: string;
      repoPath: string;
      writes: string[];
      audit: Awaited<ReturnType<typeof auditRepo>>;
      welcome: ReturnType<typeof buildWelcome>;
    },
    "repo-not-found"
  >
> {
  if (!(await pathExists(repoPath))) return err("repo-not-found");

  const writes: string[] = [];
  // Migrate first so writeHarnessFiles uses missing-only semantics on top of
  // whatever the legacy tree provides (Step 3 of the P3.1 namespace rename).
  await migrateLegacyHarness(repoPath, writes);
  await updateClaudeMd(repoPath, writes);
  await updateGitignore(repoPath, writes);
  await writeHarnessFiles(repoPath, writes);
  await writeRepoLocalGuides(repoPath, writes);
  await updateSettings(repoPath, writes);
  const costSetup = await runCostSetup(repoPath);
  if (costSetup.written)
    writes.push(path.relative(repoPath, costSetup.configPath) || costSetup.configPath);

  return ok({
    mode: "bootstrap",
    repoPath,
    writes,
    audit: await auditRepo(repoPath),
    welcome: buildWelcome({ mode: "bootstrap", repoScoped: true })
  });
}

interface InitRepoOptions {
  allowExisting?: boolean;
}

export async function initRepo(
  repoPath: string,
  options: InitRepoOptions = {}
): Promise<{
  mode: string;
  repoPath: string;
  writes: string[];
  audit: Awaited<ReturnType<typeof auditRepo>>;
  welcome: ReturnType<typeof buildWelcome>;
}> {
  if (await pathExists(repoPath)) {
    const entries = await fs.readdir(repoPath).catch((): string[] => []);
    if (entries.length > 0 && !options.allowExisting) {
      throw new Error(
        `Target directory already exists and is not empty: ${repoPath}. Pass --allow-existing to reuse it.`
      );
    }
  } else {
    await ensureDir(repoPath);
  }

  const writes: string[] = [];
  const gitPath = path.join(repoPath, ".git");
  if (!(await pathExists(gitPath))) {
    await ensureDir(gitPath);
    writes.push(".git/");
  }

  const bootstrapResult = await bootstrapRepo(repoPath);
  if (!bootstrapResult.ok) throw new Error(`Repository path does not exist: ${repoPath}`);
  const result = bootstrapResult.value;
  return {
    mode: "init",
    repoPath,
    writes: [...writes, ...result.writes],
    audit: result.audit,
    welcome: buildWelcome({ mode: "init", repoScoped: true })
  };
}
