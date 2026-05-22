import fs from "node:fs/promises";
import path from "node:path";

import { getPluginIdentity } from "./plugin-identity.mjs";

// Generic commit-and-edit-signal bridge between an existing methodology
// (Wiggin Loop, Conventional Commits, custom slice schemes, etc.) and Crew's
// artifact pipeline. Installed per-repo via /crew:install-commit-bridge.
//
// The bridge has two hooks:
//   1. .git/hooks/post-commit: when a commit subject matches `commitPattern`,
//      write a Crew review-result artifact with `reviewerLabel` as reviewer.
//   2. .claude/hooks/commit_bridge.sh (PostToolUse): when Claude edits a file
//      whose name matches `triggerFilename`, write a Crew final-synthesis
//      artifact.
//
// Both hooks are best-effort and silently no-op on failure so they never
// block a commit or a tool call. The bridge is purely additive observability.

const BRIDGE_DESCRIPTION = "crew:commit-bridge";
const BRIDGE_HOOK_FILE = "commit_bridge.sh";

// Built-in presets. Choose at install time with --preset or override fields
// individually with --commit-pattern / --trigger-filename / --reviewer-label.
const PRESETS = {
  "wiggin-loop": {
    description: "LoopBrain / Wiggin Loop slice methodology",
    commitPattern: "(SLICE_[0-9]+|slice-[0-9]+|all [0-9]+ slices)",
    triggerFilename: "completed-slices.md",
    reviewerLabel: "wiggin-loop"
  },
  "conventional-commits": {
    description: "Conventional Commits — feat/fix/refactor commits become review artifacts",
    commitPattern: "^(feat|fix|refactor|perf)(\\([^)]+\\))?!?:",
    triggerFilename: "CHANGELOG.md",
    reviewerLabel: "conventional-commits"
  }
};

const DEFAULT_PRESET = "wiggin-loop";

function escapeForSingleQuoteShell(value) {
  // The pattern lands inside single quotes in the generated bash hook.
  // Escape any single quotes by closing, escaping, and reopening.
  return String(value).replace(/'/g, `'\\''`);
}

function escapeForJsLiteral(value) {
  // The filename lands inside a JS string literal in the embedded Node block.
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderPostCommitTemplate({
  commitPattern,
  reviewerLabel,
  presetName,
  marketplaceName,
  pluginName
}) {
  const safePattern = escapeForSingleQuoteShell(commitPattern);
  const safeReviewer = escapeForSingleQuoteShell(reviewerLabel);
  const cliGlob = `"$HOME"/.claude/plugins/cache/${marketplaceName}/${pluginName}/*/scripts/crew.mjs`;
  return `#!/usr/bin/env bash
# Crew commit bridge (preset: ${presetName}) — matching commits write a review-result artifact.
#
# Why this exists: repos that record evidence inline in commit messages
# instead of via Crew's write-* commands end up with an empty
# .claude/artifacts/crew/. This hook closes the gap by turning each
# commit whose subject matches the configured pattern into a Crew
# review-result artifact so brief-me, wake-up, and memory buckets
# surface the commit trail.
#
# Pattern: ${commitPattern}
# Reviewer label: ${reviewerLabel}
#
# Silent no-op for any commit that does not match. Best-effort; never
# blocks a commit on failure.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || exit 0

subject="$(git log -1 --pretty=%s)"
sha="$(git log -1 --pretty=%h)"
body="$(git log -1 --pretty=%b)"

if ! printf '%s' "$subject" | grep -qiE '${safePattern}'; then
  exit 0
fi

crew_cli="$(ls -dt ${cliGlob} 2>/dev/null | head -1 || true)"
if [ -z "$crew_cli" ] || [ ! -f "$crew_cli" ]; then
  echo "crew bridge: crew CLI not found under ~/.claude/plugins/cache/${marketplaceName}/${pluginName}/*/scripts/crew.mjs; skipping artifact write" >&2
  exit 0
fi

summary="git commit $sha: $subject"
if [ -n "$body" ]; then
  body_line="$(printf '%s' "$body" | tr '\\n' ' ' | sed 's/  */ /g' | head -c 800)"
  summary="$summary | $body_line"
fi

node "$crew_cli" write-review-result \\
  --repo "$repo_root" \\
  --title "$subject" \\
  --reviewer '${safeReviewer}' \\
  --decision passed \\
  --summary "$summary" >/dev/null || {
  echo "crew bridge: write-review-result failed for commit $sha; continuing" >&2
  exit 0
}
`;
}

function renderPostToolUseTemplate({ triggerFilename, presetName, marketplaceName, pluginName }) {
  const safeFilename = escapeForJsLiteral(triggerFilename.toLowerCase());
  const safeMarketplace = escapeForJsLiteral(marketplaceName);
  const safePlugin = escapeForJsLiteral(pluginName);
  return `#!/usr/bin/env bash
# Crew commit bridge (preset: ${presetName}) — edits to ${triggerFilename} write a final-synthesis artifact.
#
# Triggered as a PostToolUse hook from .claude/settings.json. Only fires
# when Claude Code itself edited the configured trigger file via the
# Edit, Write, or MultiEdit tool. External edits (e.g. someone editing
# the file in VS Code outside a Claude session) won't fire this; the
# git post-commit hook is the safety net for commit-based signals.
#
# Trigger filename: ${triggerFilename}

set -euo pipefail

payload="$(cat || true)"
[ -n "$payload" ] || exit 0

HOOK_PAYLOAD="$payload" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const os = require("node:os");

const TRIGGER_FILENAME = "${safeFilename}";

const input = JSON.parse(process.env.HOOK_PAYLOAD || "{}");
if (input.hook_event_name !== "PostToolUse") process.exit(0);

const tool = input.tool_name || "";
if (!["Edit", "Write", "MultiEdit"].includes(tool)) process.exit(0);

const filePath = input.tool_input?.file_path || input.tool_input?.filePath || "";
if (!filePath.toLowerCase().endsWith(TRIGGER_FILENAME)) process.exit(0);

const cwd = input.cwd || process.cwd();

const cacheGlob = path.join(os.homedir(), ".claude", "plugins", "cache", "${safeMarketplace}", "${safePlugin}");
let crewCli = null;
try {
  const versions = fs.readdirSync(cacheGlob).sort().reverse();
  for (const v of versions) {
    const candidate = path.join(cacheGlob, v, "scripts", "crew.mjs");
    if (fs.existsSync(candidate)) { crewCli = candidate; break; }
  }
} catch {
  // cache dir missing — silent no-op
}
if (!crewCli) process.exit(0);

let title = \`Commit-bridge sync from \${TRIGGER_FILENAME}\`;
try {
  const body = fs.readFileSync(filePath, "utf8");
  const match = body.match(/^##\\s+(.+?)$/m);
  if (match) title = \`Synthesized: \${match[1].trim()}\`;
} catch {
  // fall back to generic title
}

try {
  execFileSync("node", [
    crewCli,
    "write-final-synthesis",
    "--repo", cwd,
    "--title", title,
    "--summary", \`\${TRIGGER_FILENAME} updated; synthesized via Crew commit bridge\`
  ], { stdio: "ignore" });
} catch {
  // best-effort; never block tool output on bridge failure
}
NODE
`;
}

function renderHooksReadme({
  presetName,
  commitPattern,
  triggerFilename,
  reviewerLabel,
  marketplaceName,
  pluginName
}) {
  return `# Crew Hooks

This repo runs two hook layers:

1. **Crew framework hooks** (installed by \`/crew:adopt\`):
   - \`log_event.sh\` — append-only event log to \`.claude/logs/events.jsonl\`
   - \`check_git_gate.sh\` — soft warning on \`git commit\` when Crew workflow gates are pending

2. **Crew commit bridge** (installed by \`/crew:install-commit-bridge\`, preset: \`${presetName}\`):
   - \`${BRIDGE_HOOK_FILE}\` — PostToolUse hook. When Claude edits a file
     whose name ends with \`${triggerFilename}\`, writes a Crew
     \`final-synthesis\` artifact so brief-me and wake-up see the update.
   - \`../../.git/hooks/post-commit\` — git hook. When any commit subject
     matches the configured pattern, writes a Crew \`review-result\` artifact.
     Catches commits made outside Claude Code as well as in-session commits.

## Bridge configuration

| Field | Value |
|---|---|
| Preset | \`${presetName}\` |
| Commit pattern | \`${commitPattern}\` |
| Trigger filename | \`${triggerFilename}\` |
| Reviewer label | \`${reviewerLabel}\` |
| CLI discovery glob | \`~/.claude/plugins/cache/${marketplaceName}/${pluginName}/*/scripts/crew.mjs\` |

To change configuration, re-run \`/crew:install-commit-bridge\` with the
appropriate \`--preset\` or explicit flags. The installer is idempotent
and overwrites these files in place.

## Why the bridge exists

Repos that record evidence inline (commit messages, slice docs, changelogs)
instead of via Crew's \`write-*\` commands end up with
\`.claude/artifacts/crew/\` effectively empty even though substantial
reviewed work is happening. The bridge translates the repo's existing
signals into Crew artifacts so the two methodologies coexist without one
being dead weight.

## What it doesn't do

- Doesn't enforce anything — both hooks are best-effort and silently
  no-op on any failure so they cannot block work
- Doesn't trigger validation or deployment artifacts — most methodologies
  have no canonical signal for those events
- Doesn't backfill historical commits — fires forward from install.
  Use \`crew backfill-commit-bridge --repo <path>\` for a one-time sweep.

## Testing

\`\`\`bash
# Trigger the git hook against the current HEAD:
.git/hooks/post-commit

# Trigger the PostToolUse hook with a fixture payload (substitute the real path):
printf '{"hook_event_name":"PostToolUse","tool_name":"Edit","cwd":"<repo-abs-path>","tool_input":{"file_path":"<repo-abs-path>/some/path/${triggerFilename}"}}' \\
  | .claude/hooks/${BRIDGE_HOOK_FILE}
\`\`\`
`;
}

function resolveConfig(options = {}) {
  const presetName = options.preset || DEFAULT_PRESET;
  const preset = PRESETS[presetName];
  if (!preset) {
    const known = Object.keys(PRESETS).join(", ");
    throw new Error(`Unknown preset "${presetName}". Known presets: ${known}`);
  }
  return {
    presetName,
    commitPattern: options.commitPattern || preset.commitPattern,
    triggerFilename: options.triggerFilename || preset.triggerFilename,
    reviewerLabel: options.reviewerLabel || preset.reviewerLabel
  };
}

function bridgePostToolUseEntry() {
  return {
    matcher: "Edit|Write|MultiEdit",
    hooks: [
      {
        type: "command",
        command: `\${PWD}/.claude/hooks/${BRIDGE_HOOK_FILE}`,
        description: BRIDGE_DESCRIPTION
      }
    ]
  };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileWithMode(filePath, contents, mode) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, mode ? { mode } : {});
}

// Merge the bridge PostToolUse registration into an existing settings.json.
// Preserves any other PostToolUse hooks the user has and avoids duplicates.
// Also strips any old crew:wiggin-loop-bridge entry from earlier installs
// so the registration ends up using the current BRIDGE_DESCRIPTION.
function mergeBridgeHook(currentSettings) {
  const next = { ...(currentSettings || {}) };
  next.hooks = { ...(next.hooks || {}) };
  const current = Array.isArray(next.hooks.PostToolUse) ? next.hooks.PostToolUse : [];
  const filtered = current.filter((entry) => {
    const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
    return !hooks.some((hook) => {
      const description = hook?.description || "";
      return description === BRIDGE_DESCRIPTION || description === "crew:wiggin-loop-bridge";
    });
  });
  next.hooks.PostToolUse = [...filtered, bridgePostToolUseEntry()];
  return next;
}

// Cleanup of legacy filenames from earlier installs (when only the Wiggin
// Loop bridge existed and used wiggin_loop_bridge.sh).
async function removeLegacyBridgeArtifacts(repoPath) {
  const legacy = path.join(repoPath, ".claude", "hooks", "wiggin_loop_bridge.sh");
  if (await pathExists(legacy)) {
    await fs.unlink(legacy);
  }
}

export async function installCommitBridge(repoPath, options = {}) {
  if (!(await pathExists(repoPath))) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  if (!(await pathExists(path.join(repoPath, ".git")))) {
    throw new Error(`Not a git repository (missing .git): ${repoPath}`);
  }

  const config = resolveConfig(options);
  const identity = await getPluginIdentity();
  const renderContext = {
    ...config,
    marketplaceName: identity.marketplaceName,
    pluginName: identity.pluginName
  };
  const writes = [];

  await removeLegacyBridgeArtifacts(repoPath);

  const postCommitPath = path.join(repoPath, ".git", "hooks", "post-commit");
  await writeFileWithMode(postCommitPath, renderPostCommitTemplate(renderContext), 0o755);
  writes.push(path.relative(repoPath, postCommitPath));

  const bridgeHookPath = path.join(repoPath, ".claude", "hooks", BRIDGE_HOOK_FILE);
  await writeFileWithMode(bridgeHookPath, renderPostToolUseTemplate(renderContext), 0o755);
  writes.push(path.relative(repoPath, bridgeHookPath));

  const readmePath = path.join(repoPath, ".claude", "hooks", "README.md");
  await writeFileWithMode(readmePath, renderHooksReadme(renderContext));
  writes.push(path.relative(repoPath, readmePath));

  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  const existing = await fs.readFile(settingsPath, "utf8").catch(() => null);
  const current = existing ? JSON.parse(existing) : {};
  const updated = mergeBridgeHook(current);
  const serialized = `${JSON.stringify(updated, null, 2)}\n`;
  if (serialized !== existing) {
    await ensureDir(path.dirname(settingsPath));
    await fs.writeFile(settingsPath, serialized);
    writes.push(path.relative(repoPath, settingsPath));
  }

  return {
    mode: "install-commit-bridge",
    preset: config.presetName,
    commitPattern: config.commitPattern,
    triggerFilename: config.triggerFilename,
    reviewerLabel: config.reviewerLabel,
    repoPath,
    writes
  };
}

// Backwards-compat alias. Always installs the wiggin-loop preset.
export async function installWigginBridge(repoPath) {
  return installCommitBridge(repoPath, { preset: "wiggin-loop" });
}

// One-time backfill: walk git history, find commits matching the configured
// pattern, and emit a Crew review-result artifact for each. Run once on
// repos that already have history when the bridge is installed late.
export async function backfillCommitBridge(repoPath, options = {}) {
  if (!(await pathExists(path.join(repoPath, ".git")))) {
    throw new Error(`Not a git repository (missing .git): ${repoPath}`);
  }

  const config = resolveConfig(options);
  const { writeArtifact } = await import("./artifacts.mjs");
  const { execFile: execFileCb } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFile = promisify(execFileCb);

  const recordSep = "<<<CREW-COMMIT>>>";
  const fieldSep = "<<<CREW-FIELD>>>";
  const { stdout } = await execFile(
    "git",
    ["log", "--all", "--reverse", `--pretty=format:${recordSep}%H${fieldSep}%s${fieldSep}%b`],
    { cwd: repoPath, maxBuffer: 32 * 1024 * 1024 }
  );

  const records = stdout
    .split(recordSep)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const pattern = new RegExp(config.commitPattern, "i");
  const written = [];

  for (const record of records) {
    const [sha = "", subject = "", body = ""] = record.split(fieldSep);
    if (!pattern.test(subject)) {
      continue;
    }

    const bodyLine = body.replace(/\s+/g, " ").trim().slice(0, 800);
    const summary = bodyLine
      ? `git commit ${sha.slice(0, 7)}: ${subject} | ${bodyLine}`
      : `git commit ${sha.slice(0, 7)}: ${subject}`;

    try {
      const result = await writeArtifact(repoPath, "review-result", {
        title: subject,
        reviewer: config.reviewerLabel,
        decision: "passed",
        summary
      });
      written.push({ sha: sha.slice(0, 7), subject, path: result.path });
    } catch (error) {
      if (options.failFast) {
        throw error;
      }
      written.push({ sha: sha.slice(0, 7), subject, error: error.message });
    }
  }

  return {
    mode: "backfill-commit-bridge",
    preset: config.presetName,
    commitPattern: config.commitPattern,
    repoPath,
    count: written.filter((entry) => !entry.error).length,
    skippedOrFailed: written.filter((entry) => entry.error).length,
    artifacts: written
  };
}

// Backwards-compat alias. Always uses the wiggin-loop preset.
export async function backfillWigginBridge(repoPath, options = {}) {
  return backfillCommitBridge(repoPath, { ...options, preset: "wiggin-loop" });
}

export function listBridgePresets() {
  return Object.entries(PRESETS).map(([name, value]) => ({ name, ...value }));
}
