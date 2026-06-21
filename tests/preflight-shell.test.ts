// tests/preflight-shell.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { runPreflightShellHook } from "../hooks/lib/preflight-shell.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(__dirname, "..", "hooks", "preflight-shell.ts");

/**
 * In-process hook runner: import core, call directly, return { exitCode: 0, stdout, stderr: "" }
 */
async function runHook(
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const out = await runPreflightShellHook(stdin);
  return { exitCode: 0, stdout: out ?? "", stderr: "" };
}

/**
 * Spawn-based smoke runner: validates stdin/stdout wiring.
 */
function runHookSpawn(
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", ["--experimental-strip-types", HOOK_PATH], {
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    proc.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    proc.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    proc.stdin.end(stdin);
  });
}

function makeStdin(toolName: string, command: string, cwd: string) {
  return JSON.stringify({
    session_id: "test-session",
    tool_name: toolName,
    tool_input: { command },
    cwd
  });
}

// ── Default-on behavior (config-driven; disable via crew.json features) ─────

test("default-on — hook runs and warns on $env: in Bash without any crew.json", async () => {
  const result = await runHook(makeStdin("Bash", "echo $env:HOME", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /\$env:/);
});

// SMOKE: Hook runtime contract default-on (verifies stdin→stdout wiring)
test("smoke: default-on — hook runs via spawn with no special env", async () => {
  const result = await runHookSpawn(makeStdin("Bash", "echo $env:HOME", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
});

// ── AC-7: Failure mode 1 — env-var shape mismatch ───────────────────────────

// SMOKE: Hook runtime contract with warning path (verifies stdin→stdout payload wiring)
test("smoke: AC-7a — Bash tool with $env:HOME warns about $env: syntax", async () => {
  const result = await runHookSpawn(makeStdin("Bash", "echo $env:HOME", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /\$env:/);
  assert.match(parsed.systemMessage, /bash does not understand/);
});

test("AC-7b: PowerShell tool with bare $PATH warns about $NAME vs $env:NAME", async () => {
  // Use $PATH — a real env var that is NOT a PowerShell automatic variable.
  // ($HOME, $LASTEXITCODE, $NULL, etc. are PS built-ins and must NOT warn —
  // see deny-list regression tests below.)
  const result = await runHook(makeStdin("PowerShell", "Write-Host $PATH", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /\$env:PATH/);
  assert.match(parsed.systemMessage, /not `\$PATH`/);
});

// ── AC-8: Failure mode 2 — chained-cd missing path ──────────────────────────

test("AC-8: chained cd to non-existent path warns naming the path", async () => {
  // Use a path that definitively does not exist
  const missingPath = path.join(os.tmpdir(), "preflight-no-such-path-" + Date.now());
  const command = `cd ${missingPath} && ls`;
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /does not exist/);
  assert.ok(
    parsed.systemMessage.includes(missingPath),
    `warn should contain path, got: ${parsed.systemMessage}`
  );
});

test("AC-8b: chained cd to existing path is silent", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "preflight-exists-"));
  try {
    const command = `cd ${tmpDir} && ls`;
    const result = await runHook(makeStdin("Bash", command, process.cwd()));
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("AC-8c: chained cd to existing dir via MSYS-style path (/c/...) is silent", {
  skip: process.platform !== "win32"
}, async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "preflight-msys-"));
  try {
    // C:\Users\... -> /c/Users/... (the form Git-Bash reports and accepts)
    const msysPath = tmpDir
      .replace(/^([A-Za-z]):\\/, (_m, d) => `/${d.toLowerCase()}/`)
      .replace(/\\/g, "/");
    const command = `cd ${msysPath} && ls`;
    const result = await runHook(makeStdin("Bash", command, process.cwd()));
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "", `MSYS drive path should not warn, got: ${result.stdout}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

// ── AC-9: Failure mode 3 — unquoted Windows path with space ─────────────────

test("AC-9a: unquoted Windows path with space triggers warn", async () => {
  const command = "cd C:/work mega/hero-crew && ls";
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /[Ww]indows path/);
});

test("AC-9b: quoted Windows path with space is silent", async () => {
  // Use a path that does NOT exist (so cd-missing check doesn't fire either)
  // but is quoted
  const command = 'cd "C:/work mega/no-such-dir" && ls';
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  // May warn about missing path but NOT about unquoted windows path
  if (result.stdout !== "") {
    const parsed = JSON.parse(result.stdout);
    assert.doesNotMatch(parsed.systemMessage, /[Ww]indows path/);
  }
});

test("AC-9c: Windows path followed by normal arg (no separator) is silent", async () => {
  // Regression: previously the heuristic warned on any Windows path followed by
  // a space + non-operator, including innocent `git -C C:/x status` calls.
  // The fix narrows the check: only warn when the next token actually looks
  // like a path continuation (contains `/` or `\`).
  const command = "git -C C:/work/mega/hero-crew status --short";
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  if (result.stdout !== "") {
    const parsed = JSON.parse(result.stdout);
    assert.doesNotMatch(parsed.systemMessage, /[Ww]indows path/);
  }
});

test("AC-9d: Windows path piped to operator is silent", async () => {
  // Operators (&&, ;, |, >, <) after the path are not continuations.
  const command = "ls C:/work/mega/foo/bar.json; echo done";
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  if (result.stdout !== "") {
    const parsed = JSON.parse(result.stdout);
    assert.doesNotMatch(parsed.systemMessage, /[Ww]indows path/);
  }
});

// ── AC-10: Failure mode 4 — unterminated here-doc ───────────────────────────

test("AC-10a: unterminated here-doc triggers warn", async () => {
  const command = "bash -c \"cat <<'EOF'\\nhello\"";
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.notEqual(result.stdout, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.decision, "approve");
  assert.match(parsed.systemMessage, /here-doc terminator missing/);
});

test("AC-10b: properly terminated here-doc is silent", async () => {
  const command = "bash -c \"cat <<'EOF'\\nhello\\nEOF\"";
  const result = await runHook(makeStdin("Bash", command, process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// ── AC-11: Clean command — silent + exit 0 ───────────────────────────────────

test("AC-11: clean command produces zero stdout and exits 0", async () => {
  const result = await runHook(makeStdin("Bash", "echo hello", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("AC-11b: clean PowerShell command produces zero stdout and exits 0", async () => {
  const result = await runHook(makeStdin("PowerShell", "Write-Host 'hello'", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// ── AC-12: Exception resilience ──────────────────────────────────────────────

test("AC-12: malformed JSON on stdin exits 0 silently", async () => {
  const result = await runHook("not json at all");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("AC-12b: missing tool_input.command exits 0 silently", async () => {
  const result = await runHook(
    JSON.stringify({
      session_id: "s1",
      tool_name: "Bash",
      tool_input: {},
      cwd: process.cwd()
    })
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("AC-12c: hook does not propagate exceptions from bad input", async () => {
  // Pass a command with null bytes that might confuse regexes
  const result = await runHook(makeStdin("Bash", "echo \x00\x01\x02", process.cwd()));
  assert.equal(result.exitCode, 0);
  // Either silent or warns, but must not crash
  if (result.stdout !== "") {
    const parsed = JSON.parse(result.stdout);
    assert.notEqual(parsed.decision, "block");
  }
});

// ── Regex false-positive guards ───────────────────────────────────────────────

test("false-positive: bash ${HOME} does NOT trigger PowerShell-shape warn (wrong tool)", async () => {
  // This is Bash tool, not PowerShell — so env-var shape check should fire
  // for $env:NAME pattern only. ${HOME} in Bash is fine.
  const result = await runHook(makeStdin("Bash", "echo ${HOME}", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("false-positive: PowerShell ${HOME} with braces does NOT warn", async () => {
  // ${HOME} uses braces — should be excluded from PowerShell bare-$NAME check
  const result = await runHook(makeStdin("PowerShell", "Write-Host ${HOME}", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("false-positive: PowerShell $() command substitution does NOT warn", async () => {
  const result = await runHook(
    makeStdin("PowerShell", "Write-Host $(Get-Location)", process.cwd())
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("false-positive: bash $1 positional arg does NOT trigger warn", async () => {
  // $1 is lowercase/digit — not [A-Z_][A-Z0-9_]* so should not fire PowerShell warn
  // (and this is Bash tool anyway)
  const result = await runHook(makeStdin("Bash", "echo $1", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("false-positive: PowerShell $env:NAME does NOT trigger bare-$NAME warn", async () => {
  const result = await runHook(makeStdin("PowerShell", "Write-Host $env:HOME", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

// ── PowerShell automatic variables MUST NOT trigger the env-var shape warn ───

test("PS auto-var: $_ in pipeline context does NOT warn", async () => {
  const result = await runHook(
    makeStdin("PowerShell", "Get-Process | Where-Object { $_.CPU -gt 100 }", process.cwd())
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("PS auto-var: $LASTEXITCODE does NOT warn", async () => {
  const result = await runHook(makeStdin("PowerShell", "Write-Host $LASTEXITCODE", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("PS auto-var: $HOME does NOT warn (built-in)", async () => {
  const result = await runHook(makeStdin("PowerShell", "Write-Host $HOME", process.cwd()));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("PS auto-var: $NULL, $TRUE, $FALSE do NOT warn", async () => {
  for (const v of ["$NULL", "$TRUE", "$FALSE"]) {
    const result = await runHook(makeStdin("PowerShell", `Write-Host ${v}`, process.cwd()));
    assert.equal(result.exitCode, 0, `${v} should exit 0`);
    assert.equal(result.stdout, "", `${v} should be silent, got: ${result.stdout}`);
  }
});

test("PS auto-var: $PSVersionTable (mixed-case) does NOT partial-match warn $PSV", async () => {
  const result = await runHook(
    makeStdin("PowerShell", "Write-Host $PSVersionTable", process.cwd())
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
});

test("PS auto-var: $PSScriptRoot and $MyInvocation (mixed-case) do NOT warn", async () => {
  for (const v of ["$PSScriptRoot", "$MyInvocation"]) {
    const result = await runHook(makeStdin("PowerShell", `Write-Host ${v}`, process.cwd()));
    assert.equal(result.exitCode, 0, `${v} should exit 0`);
    assert.equal(result.stdout, "", `${v} should be silent, got: ${result.stdout}`);
  }
});

// ── AC-4 shape guard ─────────────────────────────────────────────────────────

test("AC-4: output is always decision=approve, never decision=block", async () => {
  // Run several warning-triggering commands and confirm none produce block
  const cases = [
    makeStdin("Bash", "echo $env:HOME", process.cwd()),
    makeStdin("PowerShell", "echo $PATH", process.cwd()),
    makeStdin("Bash", "bash -c \"cat <<'EOF'\\nhello\"", process.cwd())
  ];
  for (const stdin of cases) {
    const result = await runHook(stdin);
    if (result.stdout !== "") {
      const parsed = JSON.parse(result.stdout);
      assert.notEqual(parsed.decision, "block", `Got block decision for: ${stdin}`);
      assert.equal(parsed.decision, "approve");
    }
  }
});
