// scripts/lib/preflight/checks.ts
// Pure-ish check functions for the preflight-shell hook.
// All checks return string[] of warning messages.
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeMsysPath } from "../fs-utils.ts";

// PowerShell automatic variables — must NOT trigger the env-var shape warn.
// Stored uppercase since the env-var regex captures uppercase identifiers.
// Case-insensitive comparison applied after capture.
const POWERSHELL_AUTOMATIC_VARS = new Set([
  "_",
  "ARGS",
  "ERROR",
  "EXECUTIONCONTEXT",
  "FALSE",
  "FOREACH",
  "HOME",
  "HOST",
  "INPUT",
  "LASTEXITCODE",
  "MATCHES",
  "MYINVOCATION",
  "NESTEDPROMPTLEVEL",
  "NULL",
  "PID",
  "PROFILE",
  "PSBOUNDPARAMETERS",
  "PSCMDLET",
  "PSCOMMANDPATH",
  "PSCULTURE",
  "PSDEBUGCONTEXT",
  "PSHOME",
  "PSITEM",
  "PSSCRIPTROOT",
  "PSSENDERINFO",
  "PSUICULTURE",
  "PSVERSIONTABLE",
  "PWD",
  "SENDER",
  "SHELLID",
  "STACKTRACE",
  "SWITCH",
  "THIS",
  "TRUE"
]);

interface EnvVarCheckInput {
  toolName: string;
  command: string;
}

interface CdPathCheckInput {
  command: string;
  cwd: string;
}

interface CommandInput {
  command: string;
}

interface RunChecksInput {
  toolName: string;
  command: string;
  cwd: string;
}

interface CheckResult {
  warnings: string[];
}

// Decide whether a `$NAME` regex hit should be skipped (not a real env-var
// shape mistake). Centralizes the 5 false-positive guards so the matcher
// loop reads top-down.
function isFalsePositiveDollarMatch(command: string, match: RegExpExecArray): boolean {
  const before = command.slice(0, match.index);
  const afterDollar = command[match.index + 1];
  // ${...} and $(...) are explicit non-env-var shapes.
  if (afterDollar === "{" || afterDollar === "(") return true;
  // $env:NAME literal or `env:` already present before the dollar.
  if (match[1]!.toLowerCase().startsWith("env:")) return true;
  if (before.endsWith("env:")) return true;
  // Trailing letter means this is a mixed-case identifier we partially matched.
  const charAfterMatch = command[match.index + match[0].length];
  if (charAfterMatch !== undefined && /[A-Za-z]/.test(charAfterMatch)) return true;
  // PowerShell automatic variable (allow-list lookup).
  if (POWERSHELL_AUTOMATIC_VARS.has(match[1]!.toUpperCase())) return true;
  return false;
}

export function checkEnvVarShape({ toolName, command }: EnvVarCheckInput): string[] {
  const warnings: string[] = [];

  if (toolName === "PowerShell") {
    // Match bare $NAME (uppercase) — heuristic for env-var-shaped identifiers;
    // false positives filtered by isFalsePositiveDollarMatch.
    const re = /\$([A-Z_][A-Z0-9_]*)/g;
    let match;
    while ((match = re.exec(command)) !== null) {
      if (isFalsePositiveDollarMatch(command, match)) continue;
      warnings.push(`use \`$env:${match[1]!}\` in PowerShell, not \`$${match[1]!}\``);
      break;
    }
  } else if (toolName === "Bash") {
    // Bash does not understand $env:NAME syntax
    if (/\$env:[A-Za-z_][A-Za-z0-9_]*/i.test(command)) {
      warnings.push("bash does not understand `$env:NAME`, use `$NAME`");
    }
  }

  return warnings;
}

async function checkOneChainedCdPath(
  rawPath: string,
  cwd: string,
  warnings: string[]
): Promise<void> {
  const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
  try {
    await fs.stat(resolved);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      warnings.push(`chained cd target does not exist: ${resolved}`);
    }
    // Other errors (EPERM etc.) — don't warn, be conservative.
  }
}

export async function checkChainedCdPaths({ command, cwd }: CdPathCheckInput): Promise<string[]> {
  const warnings: string[] = [];

  // Patterns: cd <path> && | cd <path>; | Set-Location <path>
  // Path may be double-quoted, single-quoted, or unquoted.
  const patterns = [
    /\bcd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/g,
    /\bSet-Location\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s|$)/gi
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(command)) !== null) {
      const rawPath = normalizeMsysPath((match[1] ?? match[2] ?? match[3])!);
      if (!rawPath) continue;
      await checkOneChainedCdPath(rawPath, cwd, warnings);
    }
  }

  return warnings;
}

// Odd quote count in `prefix` means the position is inside a quoted string.
function isPrefixInsideQuotes(prefix: string): boolean {
  const doubleQuotes = (prefix.match(/"/g) || []).length;
  const singleQuotes = (prefix.match(/'/g) || []).length;
  return doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0;
}

// Walk forward from `startIdx` until whitespace; return the end index.
function findTokenEnd(command: string, startIdx: number): number {
  let i = startIdx;
  while (i < command.length && command[i] !== " " && command[i] !== "\t") i++;
  return i;
}

// A bare token shaped like a path-continuation (has slash, not a flag, not
// quoted, not an absolute Windows path on its own).
function looksLikePathContinuation(nextToken: string): boolean {
  if (!/[\\/]/.test(nextToken)) return false;
  if (nextToken.startsWith("-")) return false;
  if (nextToken.startsWith('"') || nextToken.startsWith("'")) return false;
  if (/^[A-Za-z]:[/\\]/.test(nextToken)) return false;
  return true;
}

// For one regex hit on a Windows-path start, decide if it represents an
// unquoted path with an embedded space. Returns the warning text or null.
function buildUnquotedWindowsPathWarning(command: string, match: RegExpExecArray): string | null {
  const startIdx = match.index;
  if (isPrefixInsideQuotes(command.slice(0, startIdx))) return null;

  const tokenEnd = findTokenEnd(command, startIdx + match[0].length);
  if (tokenEnd >= command.length) return null;
  const charAfterToken = command[tokenEnd];
  if (charAfterToken !== " " && charAfterToken !== "\t") return null;

  const afterSpace = command.slice(tokenEnd).trimStart();
  if (/^(&&|;|\|+|>|<)/.test(afterSpace) || afterSpace.length === 0) return null;

  const nextTokenMatch = afterSpace.match(/^(\S+)/);
  if (!nextTokenMatch) return null;
  const nextToken = nextTokenMatch[1] ?? "";
  if (!looksLikePathContinuation(nextToken)) return null;

  const token = command.slice(startIdx, tokenEnd);
  return `Windows path with space should be quoted: ${token} ${nextToken}`;
}

export function checkUnquotedWindowsPathSpace({ command }: CommandInput): string[] {
  const warnings: string[] = [];
  // Find all Windows-style paths (C:\ or C:/) that contain a space and are
  // NOT enclosed in quotes. Detection strategy:
  //   1. Find a Windows path start [A-Za-z]:[\/]
  //   2. Skip if inside a quoted string (odd quote count in prefix)
  //   3. Walk forward collecting the path token (until whitespace)
  //   4. If the next token looks like a path continuation, warn.
  const winPathRe = /[A-Za-z]:[/\\]/g;
  let match;
  while ((match = winPathRe.exec(command)) !== null) {
    const warning = buildUnquotedWindowsPathWarning(command, match);
    if (warning) {
      warnings.push(warning);
      break;
    }
  }
  return warnings;
}

export function checkUnterminatedHeredoc({ command }: CommandInput): string[] {
  // Look for <<'EOF' or <<EOF
  const heredocRe = /<<'?EOF'?/g;
  let match;

  while ((match = heredocRe.exec(command)) !== null) {
    // Check for closing EOF on its own line after this point.
    // Handle both real newlines (\n) and escaped newlines (literal \n in strings).
    const rest = command.slice(match.index + match[0].length);
    // Real newline: \nEOF at word boundary or end
    // Escaped newline (\\n literal): \\nEOF at word boundary or end
    const hasTerminator = /\nEOF(\b|$)/.test(rest) || /\\nEOF(\b|$)/.test(rest);
    if (!hasTerminator) {
      return ["here-doc terminator missing"];
    }
  }

  return [];
}

export async function runChecks({ toolName, command, cwd }: RunChecksInput): Promise<CheckResult> {
  const warnings = [];

  warnings.push(...checkEnvVarShape({ toolName, command }));
  warnings.push(...(await checkChainedCdPaths({ command, cwd })));
  warnings.push(...checkUnquotedWindowsPathSpace({ command }));
  warnings.push(...checkUnterminatedHeredoc({ command }));

  return { warnings };
}
