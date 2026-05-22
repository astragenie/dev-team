// Writes the per-repo harness scaffolding: artifact + state README files,
// hook shell scripts, state seed files (claims, history, approvals,
// workflow-state, sprint), and the artifact / log directory tree.
//
// Refresh files are rewritten on every run so template upgrades land.
// Seed files use `writeSeedIfMissing` so a migrated legacy file is not
// clobbered by the default template.

import path from "node:path";

import { ensureDir, writeFileIfChanged, writeSeedIfMissing } from "./util.mjs";
import {
  ARTIFACT_README_TEMPLATE,
  CLAIMS_TEMPLATE,
  GIT_GATE_REMINDER_TEMPLATE,
  HOOK_SCRIPT_TEMPLATE,
  SPRINT_TEMPLATE,
  STATE_README_TEMPLATE
} from "./templates.mjs";

export async function writeHarnessFiles(repoPath, writes) {
  const refreshFiles = [
    [
      path.join(repoPath, ".claude", "artifacts", "crew", "README.md"),
      `${ARTIFACT_README_TEMPLATE}\n`
    ],
    [path.join(repoPath, ".claude", "state", "crew", "README.md"), `${STATE_README_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "hooks", "log_event.sh"), HOOK_SCRIPT_TEMPLATE],
    [path.join(repoPath, ".claude", "hooks", "check_git_gate.sh"), GIT_GATE_REMINDER_TEMPLATE]
  ];

  for (const [filePath, contents] of refreshFiles) {
    const isHookScript =
      filePath.endsWith("log_event.sh") || filePath.endsWith("check_git_gate.sh");
    const changed = await writeFileIfChanged(
      filePath,
      contents,
      isHookScript ? { mode: 0o755 } : {}
    );
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }

  const seedFiles = [
    [
      path.join(repoPath, ".claude", "state", "crew", "claims.json"),
      `${JSON.stringify(CLAIMS_TEMPLATE, null, 2)}\n`
    ],
    [path.join(repoPath, ".claude", "state", "crew", "history.jsonl"), ""],
    [path.join(repoPath, ".claude", "state", "crew", "approvals.jsonl"), ""],
    [
      path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
      `${JSON.stringify(
        {
          version: "1.0",
          updatedAt: "2026-01-01T00:00:00.000Z",
          currentRun: null,
          recentRuns: []
        },
        null,
        2
      )}\n`
    ],
    [
      path.join(repoPath, ".claude", "state", "crew", "sprint.json"),
      `${JSON.stringify(SPRINT_TEMPLATE, null, 2)}\n`
    ]
  ];

  for (const [filePath, contents] of seedFiles) {
    const changed = await writeSeedIfMissing(filePath, contents);
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }

  const directories = [
    path.join(repoPath, ".claude", "artifacts", "crew", "runs"),
    path.join(repoPath, ".claude", "artifacts", "crew", "handoffs"),
    path.join(repoPath, ".claude", "artifacts", "crew", "reviews"),
    path.join(repoPath, ".claude", "artifacts", "crew", "validations"),
    path.join(repoPath, ".claude", "artifacts", "crew", "deployments"),
    path.join(repoPath, ".claude", "logs"),
    path.join(repoPath, ".claude", "state", "crew")
  ];
  for (const directory of directories) {
    await ensureDir(directory);
  }
}
