#!/usr/bin/env node

// Tool-baseline validator for SHIPPED PROMPT CONTENT.
//
// Why this exists: this plugin ships to other people's machines. Every CLI
// tool named in an agent/command/skill prompt becomes an install requirement
// for every consumer. Two bugs of exactly this shape shipped before this
// validator existed:
//
//   1. `rg -l Old | xargs sed -i ...` was prescribed in four builder prompts
//      as the CHEAP path for multi-file renames. `rg` is not on PATH, so the
//      command failed and agents fell back to per-file LLM edits — the exact
//      expensive path the guidance was written to prevent (dev-team#165 burned
//      496k tokens that way).
//   2. `jq -r '.currentRun.status // empty' ... 2>/dev/null` in the worktree
//      collision pre-flight. `jq` absent + suppressed stderr = empty status =
//      "no collision" reported even when one exists. Silent, not noisy.
//
// Both rules already existed in prose elsewhere in the tree (agents/verifier.md
// "do NOT depend on jq"; runner-plugin's triage skill "portable to the
// Windows/no-jq host") and were simply not applied consistently. Prose rules
// do not enforce themselves — hence a CI gate.
//
// Scope: prompt text only (agents/, commands/, skills/). Executable code under
// scripts/ and hooks/ is out of scope — it runs on machines we control and is
// covered by normal typecheck/test gates.
//
// Errors (fail CI):
//   - a denied tool invoked in command position inside a shipped prompt
//
// Not flagged:
//   - the tool named in prose or backticks outside command position
//     ("do NOT depend on `jq`", "the git delta between…")
//   - a line carrying an explicit opt-out marker (see ALLOW_MARKER)
//   - guidance aimed at CONSUMER repos rather than this plugin's own agents
//     (opt out per-line with the marker and state why)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["agents", "commands", "skills"];

// Tools NOT guaranteed present on a consumer machine. Verified absent from a
// stock Windows 11 + Git Bash install (the reference consumer environment).
// Keep this list short and evidence-based — it is a denylist, not a style
// preference. Adding an entry means "we have seen this break, or we know it
// is not installed by default".
const DENIED: Record<string, string> = {
  rg: "ripgrep — use the built-in Grep tool, or `grep -r`",
  fd: "fd — use `find`, or the built-in Glob tool",
  bat: "bat — use `cat`, or the built-in Read tool",
  jq: "jq — use `node -e` / `node -p` (node is already a hard dependency)",
  fzf: "fzf — interactive-only; no place in an agent prompt",
  delta: "delta — a pager; agents do not read paged output",
  just: "just — use `bun run <script>` / `npm run <script>`",
  uv: "uv — use `python -m pip`, or state the install step explicitly",
  pipx: "pipx — use `python -m pip`, or state the install step explicitly",
  gsed: "gsed — GNU sed under another name; use `sed`",
  ggrep: "ggrep — GNU grep under another name; use `grep`",
  ast_grep: "ast-grep — use the built-in Grep tool",
  sd: "sd — use `sed`",
  http: "httpie — use `curl`"
};

// Present on Linux and Windows Git Bash, ABSENT on macOS (BSD userland).
// Warned, not failed: these work on two of the three platforms consumers
// actually run, and the existing uses carry real value. Fixing them means
// adding a `command -v` guard or a fallback, which is a deliberate change —
// not something to force under CI pressure.
const WARN_ONLY: Record<string, string> = {
  timeout: "GNU coreutils `timeout` — absent on macOS; guard with `command -v timeout`",
  nohup: "`nohup` — not guaranteed on macOS/minimal images; document a fallback"
};

// Per-line opt-out. Use when the command is guidance for a CONSUMER repo's
// own tooling rather than something this plugin's agents execute. Always
// state the reason on the same line.
const ALLOW_MARKER = "tool-baseline:allow";

/**
 * Command position = the token is being executed, not merely mentioned.
 * Matches start-of-line, or immediately after a pipe, `$(`, `&&`, `||`, `;`.
 * This is what separates `jq -r '...'` (a real invocation) from
 * "do NOT depend on `jq`" (prose we want to keep).
 */
function commandPositionRegex(tool: string): RegExp {
  const t = tool.replace(/_/g, "-");
  // Left side: start, or after a pipe / `$(` / `&&` / `;` / `xargs`.
  // Right side: at least one ARGUMENT must follow. A bare token is a mention,
  // not an invocation — "do NOT depend on `jq`", "`timeout` — e.g. 30 seconds",
  // and "`uv`" in a prose list must all stay legal. `jq -r '...'` must not.
  const left = "(^|[|;&(]|\\$\\(|&&|\\|\\||\\bxargs(\\s+-\\S+)*\\s+)";
  const right = "(?=\\s+[-\\w\"'$/.~])";
  return new RegExp(`${left}\\s*\`?${t}\\b${right}`);
}

type Finding = {
  file: string;
  line: number;
  tool: string;
  text: string;
  severity: "error" | "warn";
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const SHELL_LANGS = new Set(["", "bash", "sh", "shell", "console", "zsh"]);

const TOOL_SEVERITIES: ReadonlyArray<readonly [string, "error" | "warn"]> = [
  ...Object.keys(DENIED).map((t) => [t, "error"] as const),
  ...Object.keys(WARN_ONLY).map((t) => [t, "warn"] as const)
];

/**
 * Candidate command strings on a line.
 *
 * Inside a shell fence the whole line is a command. Outside one, only the
 * text INSIDE backticks counts — scanning whole prose lines would flag
 * ordinary sentences that happen to contain a tool name, e.g. "(just return
 * the task)" or "the git delta between two commits".
 */
function commandCandidates(line: string, shellFence: boolean): string[] {
  if (shellFence) return [line];
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
}

function findingsForLine(
  line: string,
  shellFence: boolean,
  file: string,
  lineNo: number
): Finding[] {
  if (line.includes(ALLOW_MARKER)) return [];
  const candidates = commandCandidates(line, shellFence);
  if (candidates.length === 0) return [];

  const out: Finding[] = [];
  for (const [tool, severity] of TOOL_SEVERITIES) {
    const re = commandPositionRegex(tool);
    if (candidates.some((c) => re.test(c))) {
      out.push({ file, line: lineNo, tool, text: line.trim().slice(0, 110), severity });
    }
  }
  return out;
}

/**
 * Only scan lines that plausibly carry a shell command: inside a fenced code
 * block, or an inline-backtick span. Prose paragraphs are skipped entirely so
 * that a sentence mentioning a tool name never trips the gate.
 */
function scanFile(text: string, file: string): Finding[] {
  const findings: Finding[] = [];
  let fenceLang: string | null = null; // null = not inside a fence

  text.split(/\r?\n/).forEach((line, i) => {
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      fenceLang = fenceLang === null ? (fence[1] ?? "").toLowerCase() : null;
      return;
    }
    // A ```json or ```md block is data, not commands.
    const shellFence = fenceLang !== null && SHELL_LANGS.has(fenceLang);
    findings.push(...findingsForLine(line, shellFence, file, i + 1));
  });

  return findings;
}

export async function validateToolBaseline(root = ROOT): Promise<Finding[]> {
  const files: string[] = [];
  for (const d of SCAN_DIRS) files.push(...(await walk(path.join(root, d))));

  const findings: Finding[] = [];
  for (const f of files) {
    const text = await fs.readFile(f, "utf8");
    findings.push(...scanFile(text, path.relative(root, f)));
  }
  return findings;
}

async function main(): Promise<void> {
  const findings = await validateToolBaseline();
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  for (const f of warns) {
    console.warn(`  WARN ${f.file}:${f.line}`);
    console.warn(`    ${f.text}`);
    console.warn(`    -> ${WARN_ONLY[f.tool]}`);
    console.warn("");
  }

  if (errors.length > 0) {
    console.error(
      `Tool-baseline FAILED: ${errors.length} disallowed invocation(s) in shipped prompts.\n`
    );
    for (const f of errors) {
      console.error(`  ${f.file}:${f.line}`);
      console.error(`    ${f.text}`);
      console.error(`    -> ${DENIED[f.tool]}`);
      console.error("");
    }
    console.error(
      `Shipped prompts must only invoke tools present on a stock consumer machine.\n` +
        `If a command is guidance for a CONSUMER repo rather than this plugin's own\n` +
        `agents, mark that line with "${ALLOW_MARKER}" and state why.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Tool baseline OK: no disallowed tool invocations in shipped prompts` +
      (warns.length > 0 ? ` (${warns.length} macOS-portability warning(s) above).` : ".")
  );
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("validate-tool-baseline.ts")
) {
  await main();
}
