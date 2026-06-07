// scripts/lib/preflight/checks.ts
// Pure-ish check functions for the preflight-shell hook.
// All checks return string[] of warning messages.
import fs from "node:fs/promises";
import path from "node:path";

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

export function checkEnvVarShape({ toolName, command }: EnvVarCheckInput): string[] {
  const warnings = [];

  if (toolName === "PowerShell") {
    // Match bare $NAME (uppercase) — heuristic for env-var-shaped identifiers — but NOT:
    //   - $env:NAME (preceded by "env:")
    //   - ${NAME} (next char after $ is "{")
    //   - $(cmd) (next char after $ is "(")
    //   - PowerShell automatic variables (deny-list above; case-insensitive lookup)
    //   - partial matches of mixed-case identifiers like $PSVersionTable, which match
    //     only the leading uppercase prefix; if the char immediately after the regex
    //     match is a letter, the full identifier is mixed-case and not an env var
    //     shape mistake
    const re = /\$([A-Z_][A-Z0-9_]*)/g;
    let match;
    while ((match = re.exec(command)) !== null) {
      const before = command.slice(0, match.index);
      const afterDollar = command[match.index + 1];
      if (afterDollar === "{" || afterDollar === "(") continue;
      if (match[1]!.toLowerCase().startsWith("env:")) continue;
      if (before.endsWith("env:")) continue;
      const charAfterMatch = command[match.index + match[0].length];
      if (charAfterMatch !== undefined && /[A-Za-z]/.test(charAfterMatch)) continue;
      if (POWERSHELL_AUTOMATIC_VARS.has(match[1]!.toUpperCase())) continue;
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

export async function checkChainedCdPaths({ command, cwd }: CdPathCheckInput): Promise<string[]> {
  const warnings = [];

  // Patterns:
  //   cd <path> &&
  //   cd <path>;
  //   Set-Location <path>
  // Capture the path (may be quoted or unquoted).
  // We handle both quoted (single or double) and unquoted paths.
  const patterns = [
    // cd "path" && or cd 'path' &&  or  cd path &&
    /\bcd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/g,
    // Set-Location "path" or Set-Location 'path' or Set-Location path (end of line or whitespace)
    /\bSet-Location\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s|$)/gi
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(command)) !== null) {
      // One of the three capture groups will be set
      const rawPath = (match[1] ?? match[2] ?? match[3])!;
      if (!rawPath) continue;
      const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
      try {
        await fs.stat(resolved);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          warnings.push(`chained cd target does not exist: ${resolved}`);
        }
        // Other errors (EPERM etc.) — don't warn, be conservative
      }
    }
  }

  return warnings;
}

export function checkUnquotedWindowsPathSpace({ command }: CommandInput): string[] {
  const warnings = [];

  // Find all Windows-style paths (C:\ or C:/) that contain a space
  // and are NOT enclosed in quotes.
  //
  // Detection strategy:
  //   1. Find a Windows path start [A-Za-z]:[\/]
  //   2. Check if it is inside a quoted string (preceded by an unmatched quote)
  //   3. If unquoted, walk forward collecting the path token (until whitespace)
  //   4. If the character immediately after the token is a space and the next
  //      portion is NOT an operator (&&, ;, |, >, <), the path likely has a
  //      space in it and is unquoted — warn.

  const winPathRe = /[A-Za-z]:[/\\]/g;
  let match;

  while ((match = winPathRe.exec(command)) !== null) {
    const startIdx = match.index;

    // Determine if this path is inside quotes by looking at the prefix.
    // Check for the nearest unmatched double or single quote before startIdx.
    const prefix = command.slice(0, startIdx);
    const doubleQuotes = (prefix.match(/"/g) || []).length;
    const singleQuotes = (prefix.match(/'/g) || []).length;
    // If there is an odd number of double or single quotes before the path start,
    // the path is inside a quoted string.
    if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
      continue;
    }

    // Walk forward from startIdx to the end of the unquoted token (stops at space/tab)
    let tokenEnd = startIdx + match[0].length;
    while (tokenEnd < command.length && command[tokenEnd] !== " " && command[tokenEnd] !== "\t") {
      tokenEnd++;
    }

    const token = command.slice(startIdx, tokenEnd);

    // Check: is there a space right after the token, followed by non-operator content?
    // This indicates the path continues past the space (unquoted path with embedded space).
    if (tokenEnd < command.length && (command[tokenEnd] === " " || command[tokenEnd] === "\t")) {
      const afterSpace = command.slice(tokenEnd).trimStart();
      // If next portion starts with an operator or end-of-string, it's fine
      if (!/^(&&|;|\|+|>|<)/.test(afterSpace) && afterSpace.length > 0) {
        warnings.push(`Windows path with space should be quoted: ${token}`);
        break;
      }
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
