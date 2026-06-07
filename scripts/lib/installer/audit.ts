// Inspect a repo (and the user's global memory) and report which harness
// pieces are present. Pure read-only.

import path from "node:path";

import { pathExists } from "./util.ts";
import { inspectGlobalInstall } from "./global.ts";

export interface AuditResult {
  repoPath: string;
  exists: boolean;
  hasClaudeMd: boolean;
  hasDotClaude: boolean;
  hasSettings: boolean;
  hasHarnessLayer: boolean;
  hasStateLayer: boolean;
  hasWorkflowState: boolean;
  global: Awaited<ReturnType<typeof inspectGlobalInstall>>;
}

export async function auditRepo(repoPath: string): Promise<AuditResult> {
  const global = await inspectGlobalInstall();
  return {
    repoPath,
    exists: await pathExists(repoPath),
    hasClaudeMd: await pathExists(path.join(repoPath, "CLAUDE.md")),
    hasDotClaude: await pathExists(path.join(repoPath, ".claude")),
    hasSettings: await pathExists(path.join(repoPath, ".claude", "settings.json")),
    hasHarnessLayer: await pathExists(path.join(repoPath, ".claude", "artifacts", "crew")),
    hasStateLayer: await pathExists(path.join(repoPath, ".claude", "state", "crew", "claims.json")),
    hasWorkflowState: await pathExists(
      path.join(repoPath, ".claude", "state", "crew", "workflow-state.json")
    ),
    global
  };
}
