import fs from "node:fs/promises";
import path from "node:path";

// Public API: bootstrapRepo, initRepo, installGlobal, auditRepo (and the
// re-exported templates that callers and tests reach into). Internal helpers
// live in ./installer/* — see util.mjs and templates.mjs.
import {
  pathExists,
  ensureDir,
  writeFileIfChanged,
  writeSeedIfMissing
} from "./installer/util.mjs";
import { updateSettings } from "./installer/settings.mjs";
import { migrateLegacyHarness } from "./installer/legacy-migration.mjs";
import {
  GLOBAL_MEMORY_VERSION,
  GLOBAL_METADATA_TEMPLATE,
  CLAUDE_IMPORT_BLOCK,
  LEGACY_CLAUDE_MARKER_START,
  LEGACY_CLAUDE_MARKER_END,
  GITIGNORE_MARKER_START,
  GITIGNORE_MARKER_END,
  GITIGNORE_BLOCK,
  CONSTITUTION_TEMPLATE,
  WORKFLOW_TEMPLATE,
  PROTOCOL_TEMPLATE,
  ARTIFACT_README_TEMPLATE,
  STATE_README_TEMPLATE,
  CLAIMS_TEMPLATE,
  SPRINT_TEMPLATE,
  HOOK_SCRIPT_TEMPLATE,
  GIT_GATE_REMINDER_TEMPLATE
} from "./installer/templates.mjs";

function replaceLegacyMarkerBlock(existing) {
  // Replace the entire legacy `<!-- engineering-os:start -->...<!-- engineering-os:end -->`
  // block with the new crew marker block. Preserves CLAUDE.md content outside the block.
  const startIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_START);
  const endIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  const before = existing.slice(0, startIndex).trimEnd();
  const after = existing.slice(endIndex + LEGACY_CLAUDE_MARKER_END.length).trimStart();
  const middle = `${CLAUDE_IMPORT_BLOCK}`;
  const parts = [before, middle];
  if (after) {
    parts.push(after);
  }
  return `${parts.join("\n\n")}\n`;
}

async function updateClaudeMd(repoPath, writes) {
  const claudePath = path.join(repoPath, "CLAUDE.md");
  const existing = await fs.readFile(claudePath, "utf8").catch(() => null);

  if (existing === null) {
    const contents = [
      "# Repo Instructions",
      "",
      "This repository uses the Crew harness.",
      "",
      CLAUDE_IMPORT_BLOCK,
      ""
    ].join("\n");
    await writeFileIfChanged(claudePath, contents);
    writes.push(path.relative(repoPath, claudePath));
    return;
  }

  // Already on the new marker — leave alone (idempotency).
  if (existing.includes("<!-- crew:start -->")) {
    return;
  }

  // Legacy marker present — upgrade the block in place.
  if (existing.includes(LEGACY_CLAUDE_MARKER_START)) {
    const upgraded = replaceLegacyMarkerBlock(existing);
    if (upgraded !== null) {
      await writeFileIfChanged(claudePath, upgraded);
      writes.push(path.relative(repoPath, claudePath));
      return;
    }
  }

  // No marker block yet — append.
  const next = `${existing.trimEnd()}\n\n${CLAUDE_IMPORT_BLOCK}\n`;
  await writeFileIfChanged(claudePath, next);
  writes.push(path.relative(repoPath, claudePath));
}

async function updateGitignore(repoPath, writes) {
  const ignorePath = path.join(repoPath, ".gitignore");
  const existing = await fs.readFile(ignorePath, "utf8").catch(() => null);

  if (existing === null) {
    const contents = `${GITIGNORE_BLOCK}\n`;
    await writeFileIfChanged(ignorePath, contents);
    writes.push(path.relative(repoPath, ignorePath));
    return;
  }

  // Replace the marker block in place when present; else append.
  const startIdx = existing.indexOf(GITIGNORE_MARKER_START);
  const endIdx = existing.indexOf(GITIGNORE_MARKER_END);
  let next;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + GITIGNORE_MARKER_END.length);
    next = `${before}${GITIGNORE_BLOCK}${after}`;
  } else {
    next = `${existing.trimEnd()}\n\n${GITIGNORE_BLOCK}\n`;
  }

  const changed = await writeFileIfChanged(ignorePath, next);
  if (changed) {
    writes.push(path.relative(repoPath, ignorePath));
  }
}

async function writeHarnessFiles(repoPath, writes) {
  // README and hook scripts are template files — always refresh to the latest.
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

  // State seeds — only write when missing, so a migrated legacy file keeps its data.
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

// Writes the repo-local framework memory files under .claude/crew/. These are
// repo-scoped copies of the framework constitution and workflow so the harness
// is self-contained in the repo (the global copies under ~/.claude/engineering-os/
// remain authoritative for users who set them up globally).
async function writeRepoLocalGuides(repoPath, writes) {
  const guides = [
    [path.join(repoPath, ".claude", "crew", "constitution.md"), `${CONSTITUTION_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "workflow.md"), `${WORKFLOW_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "protocol.md"), `${PROTOCOL_TEMPLATE}\n`]
  ];
  for (const [filePath, contents] of guides) {
    const changed = await writeFileIfChanged(filePath, contents);
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }
}

// Step 3: destructive migration. Moves every file under each .claude/.../engineering-os/
// legacy directory into the equivalent .claude/.../crew/ path. When both files exist,
// the newer mtime wins (crew/ is preferred on tie). Empty legacy directories are then
// removed so the repo ends in a clean single-namespace state.
export async function auditRepo(repoPath) {
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

function buildWelcome({ mode, repoScoped = false }) {
  const commands = repoScoped
    ? ["/crew:brief-me", "/crew:build", "/crew:fix", "/crew:ship"]
    : ["/crew:init", "/crew:adopt", "/crew:brief-me"];

  const headlineByMode = {
    init: "Crew is now wired into this repo. Excellent judgment.",
    bootstrap: "This repo is now on Crew. Tasteful choice.",
    "install-global": "Crew global memory is installed. Bold and correct."
  };

  const optional = repoScoped
    ? [
        "Optional: /crew:install-commit-bridge to mint Crew artifacts from matching commits (installs a PostToolUse hook; skip if you don't want that)."
      ]
    : [];

  return {
    headline: headlineByMode[mode] || "Crew is ready.",
    commands,
    guidance: repoScoped
      ? "Start with /crew:brief-me for a quick situational report, then /crew:build or /crew:fix for real work."
      : "Use /crew:init for a new repo, /crew:adopt for an existing repo, and /crew:brief-me once a repo is wired in.",
    optional
  };
}

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

const GLOBAL_IMPORT_LINES = [
  "@~/.claude/engineering-os/constitution.md",
  "@~/.claude/engineering-os/workflow.md"
];

function globalPaths(homeDir) {
  const globalDir = path.join(homeDir, ".claude", "engineering-os");
  return {
    globalDir,
    constitution: path.join(globalDir, "constitution.md"),
    workflow: path.join(globalDir, "workflow.md"),
    metadata: path.join(globalDir, "metadata.json"),
    claudeMd: path.join(homeDir, ".claude", "CLAUDE.md")
  };
}

async function inspectGlobalInstall() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  const metadata = await fs
    .readFile(paths.metadata, "utf8")
    .then((raw) => JSON.parse(raw))
    .catch(() => null);
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
    globalMemoryPath: path.join(homeDir, ".claude", "engineering-os")
  };
}

export async function installGlobal() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const paths = globalPaths(homeDir);
  const writes = [];

  const constitutionChanged = await writeFileIfChanged(
    paths.constitution,
    `${CONSTITUTION_TEMPLATE}\n`
  );
  if (constitutionChanged) {
    writes.push("~/.claude/engineering-os/constitution.md");
  }

  const workflowChanged = await writeFileIfChanged(paths.workflow, `${WORKFLOW_TEMPLATE}\n`);
  if (workflowChanged) {
    writes.push("~/.claude/engineering-os/workflow.md");
  }

  const metadataChanged = await writeFileIfChanged(
    paths.metadata,
    `${JSON.stringify(GLOBAL_METADATA_TEMPLATE, null, 2)}\n`
  );
  if (metadataChanged) {
    writes.push("~/.claude/engineering-os/metadata.json");
  }

  const existing = await fs.readFile(paths.claudeMd, "utf8").catch(() => "");
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
