import fs from "node:fs/promises";
import path from "node:path";

// Templates for the Wiggin Loop <-> Crew bridge. See commands/install-wiggin-bridge.md
// for the user-facing description. These hooks are best-effort and never block
// commits or tool output.

const POST_COMMIT_TEMPLATE = `#!/usr/bin/env bash
# Crew <-> Wiggin Loop bridge: SLICE commits write a review-result artifact.
#
# Why this exists: repos following the Wiggin Loop methodology record
# evidence inline in commit messages and docs rather than via Crew's
# write-* commands. Without this hook, .claude/artifacts/crew/ stays
# empty even though real reviewed work is happening on every SLICE
# commit. This hook closes the gap so Crew's brief-me, wake-up, and
# memory buckets surface the slice trail.
#
# Fires for any commit whose subject matches a SLICE pattern (SLICE_NN,
# slice-NN, "all N slices" for merges). Silent no-op for anything else.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || exit 0

subject="$(git log -1 --pretty=%s)"
sha="$(git log -1 --pretty=%h)"
body="$(git log -1 --pretty=%b)"

if ! printf '%s' "$subject" | grep -qiE '(SLICE_[0-9]+|slice-[0-9]+|all [0-9]+ slices)'; then
  exit 0
fi

crew_cli="$(ls -dt "$HOME"/.claude/plugins/cache/crew-dev/crew/*/scripts/crew.mjs 2>/dev/null | head -1 || true)"
if [ -z "$crew_cli" ] || [ ! -f "$crew_cli" ]; then
  echo "crew bridge: crew CLI not found under ~/.claude/plugins/cache/crew-dev/crew/*/scripts/crew.mjs; skipping artifact write" >&2
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
  --reviewer "wiggin-loop" \\
  --decision passed \\
  --summary "$summary" >/dev/null || {
  echo "crew bridge: write-review-result failed for commit $sha; continuing" >&2
  exit 0
}
`;

const POST_TOOL_USE_BRIDGE_TEMPLATE = `#!/usr/bin/env bash
# Crew <-> Wiggin Loop bridge: completed-slices.md edits write a final-synthesis artifact.
#
# Triggered as a PostToolUse hook from .claude/settings.json. Only fires
# when Claude Code itself edited completed-slices.md via the Edit, Write,
# or MultiEdit tool. External edits (e.g. someone editing the file in
# VS Code outside a Claude session) won't fire this; the git post-commit
# hook is the safety net for SLICE commits.

set -euo pipefail

payload="$(cat || true)"
[ -n "$payload" ] || exit 0

HOOK_PAYLOAD="$payload" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const os = require("node:os");

const input = JSON.parse(process.env.HOOK_PAYLOAD || "{}");
if (input.hook_event_name !== "PostToolUse") process.exit(0);

const tool = input.tool_name || "";
if (!["Edit", "Write", "MultiEdit"].includes(tool)) process.exit(0);

const filePath = input.tool_input?.file_path || input.tool_input?.filePath || "";
if (!filePath.toLowerCase().endsWith("completed-slices.md")) process.exit(0);

const cwd = input.cwd || process.cwd();

const cacheGlob = path.join(os.homedir(), ".claude", "plugins", "cache", "crew-dev", "crew");
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

let title = "Wiggin Loop slice completion";
try {
  const body = fs.readFileSync(filePath, "utf8");
  const match = body.match(/^##\\s+(.+?)$/m);
  if (match) title = \`Slice complete: \${match[1].trim()}\`;
} catch {
  // fall back to generic title
}

try {
  execFileSync("node", [
    crewCli,
    "write-final-synthesis",
    "--repo", cwd,
    "--title", title,
    "--summary", "completed-slices.md updated; synthesized via Wiggin Loop bridge"
  ], { stdio: "ignore" });
} catch {
  // best-effort; never block tool output on bridge failure
}
NODE
`;

const HOOKS_README_TEMPLATE = `# Crew Hooks

This repo runs two hook layers:

1. **Crew framework hooks** (installed by \`/crew:adopt\`):
   - \`log_event.sh\` — append-only event log to \`.claude/logs/events.jsonl\`
   - \`check_git_gate.sh\` — soft warning on \`git commit\` when Crew workflow gates are pending

2. **Wiggin Loop bridge** (installed by \`/crew:install-wiggin-bridge\`):
   - \`wiggin_loop_bridge.sh\` — PostToolUse hook. When Claude edits
     \`completed-slices.md\` anywhere in the repo, writes a Crew
     \`final-synthesis\` artifact so brief-me and wake-up see the slice
     completion.
   - \`../../.git/hooks/post-commit\` — git hook. When any commit subject
     matches a SLICE pattern (\`SLICE_NN\`, \`slice-NN\`, "all N slices"),
     writes a Crew \`review-result\` artifact. Catches commits made outside
     Claude Code as well as in-session commits.

## Why the bridge exists

Repos following the Wiggin Loop methodology record evidence inline in
commit messages and docs rather than via Crew's \`write-*\` commands.
Without the bridge, \`.claude/artifacts/crew/\` stays effectively empty
even though substantial reviewed work is happening every slice. The
bridge translates Wiggin Loop signals into Crew artifacts so the two
methodologies coexist without one being dead weight.

## What it doesn't do

- Doesn't enforce anything — both hooks are best-effort and silently
  no-op on any failure so they cannot block work
- Doesn't trigger validation or deployment artifacts — Wiggin Loop has
  no canonical signal for those events
- Doesn't backfill historical commits — fires forward from install
- Doesn't handle non-Wiggin-Loop repos — the SLICE regex and the
  \`completed-slices.md\` filename are Wiggin-Loop-specific

## Testing

Discover the Crew CLI under \`~/.claude/plugins/cache/crew-dev/crew/*/scripts/crew.mjs\`.

\`\`\`bash
# Trigger the git hook against the current HEAD:
.git/hooks/post-commit

# Trigger the PostToolUse hook with a fixture payload:
printf '{"hook_event_name":"PostToolUse","tool_name":"Edit","cwd":"<repo-abs-path>","tool_input":{"file_path":"<repo-abs-path>/<some-dir>/completed-slices.md"}}' \\
  | .claude/hooks/wiggin_loop_bridge.sh
\`\`\`
`;

const BRIDGE_POST_TOOL_USE_HOOK = {
  matcher: "Edit|Write|MultiEdit",
  hooks: [
    {
      type: "command",
      command: "${PWD}/.claude/hooks/wiggin_loop_bridge.sh",
      description: "crew:wiggin-loop-bridge"
    }
  ]
};

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
function mergeBridgeHook(currentSettings) {
  const next = { ...(currentSettings || {}) };
  next.hooks = { ...(next.hooks || {}) };
  const current = Array.isArray(next.hooks.PostToolUse) ? next.hooks.PostToolUse : [];
  const filtered = current.filter((entry) => {
    const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
    return !hooks.some((hook) => (hook?.description || "") === "crew:wiggin-loop-bridge");
  });
  next.hooks.PostToolUse = [...filtered, BRIDGE_POST_TOOL_USE_HOOK];
  return next;
}

export async function installWigginBridge(repoPath) {
  if (!(await pathExists(repoPath))) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  const gitDir = path.join(repoPath, ".git");
  if (!(await pathExists(gitDir))) {
    throw new Error(`Not a git repository (missing .git): ${repoPath}`);
  }

  const writes = [];

  const postCommitPath = path.join(repoPath, ".git", "hooks", "post-commit");
  await writeFileWithMode(postCommitPath, POST_COMMIT_TEMPLATE, 0o755);
  writes.push(path.relative(repoPath, postCommitPath));

  const bridgeHookPath = path.join(repoPath, ".claude", "hooks", "wiggin_loop_bridge.sh");
  await writeFileWithMode(bridgeHookPath, POST_TOOL_USE_BRIDGE_TEMPLATE, 0o755);
  writes.push(path.relative(repoPath, bridgeHookPath));

  const readmePath = path.join(repoPath, ".claude", "hooks", "README.md");
  await writeFileWithMode(readmePath, HOOKS_README_TEMPLATE);
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
    mode: "install-wiggin-bridge",
    repoPath,
    writes
  };
}

// One-time backfill: walk git history, find commits matching the SLICE
// pattern, and emit a Crew review-result artifact for each. Intended to be
// run once on repos that already have a slice history when the bridge is
// installed late. Forward-firing commits are handled by the post-commit hook.
export async function backfillWigginBridge(repoPath, options = {}) {
  if (!(await pathExists(path.join(repoPath, ".git")))) {
    throw new Error(`Not a git repository (missing .git): ${repoPath}`);
  }

  const { writeArtifact } = await import("./artifacts.mjs");
  const { execFile: execFileCb } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFile = promisify(execFileCb);

  // %H sha, %s subject, %b body, separated by NUL bytes; commits separated by a record sentinel.
  const recordSep = "<<<CREW-COMMIT>>>";
  const fieldSep = "<<<CREW-FIELD>>>";
  const { stdout } = await execFile(
    "git",
    [
      "log",
      "--all",
      "--reverse",
      `--pretty=format:${recordSep}%H${fieldSep}%s${fieldSep}%b`
    ],
    { cwd: repoPath, maxBuffer: 32 * 1024 * 1024 }
  );

  const records = stdout
    .split(recordSep)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const slicePattern = /(SLICE_[0-9]+|slice-[0-9]+|all [0-9]+ slices)/i;
  const written = [];

  for (const record of records) {
    const [sha = "", subject = "", body = ""] = record.split(fieldSep);
    if (!slicePattern.test(subject)) {
      continue;
    }

    const bodyLine = body
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
    const summary = bodyLine
      ? `git commit ${sha.slice(0, 7)}: ${subject} | ${bodyLine}`
      : `git commit ${sha.slice(0, 7)}: ${subject}`;

    try {
      const result = await writeArtifact(repoPath, "review-result", {
        title: subject,
        reviewer: "wiggin-loop",
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
    mode: "backfill-wiggin-bridge",
    repoPath,
    count: written.filter((entry) => !entry.error).length,
    skippedOrFailed: written.filter((entry) => entry.error).length,
    artifacts: written
  };
}
