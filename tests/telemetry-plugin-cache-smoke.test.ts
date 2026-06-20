/**
 * Plugin-cache install smoke for FEAT-168.
 *
 * Caps the bug class behind v0.37.2 hotfix. v0.37.1 shipped with a top-level
 * `import { trace, SpanKind } from "@opentelemetry/api"` in otel-bridge.ts,
 * statically reachable from all three hooks/otel-*.ts entries. Plugin installs
 * land at ~/.claude/plugins/cache/astra/crew/<version>/ with package.json but
 * an incomplete node_modules — the customer saw @opentelemetry/api ENOENT on
 * every tool call even though yaml + zod (other top-level deps) resolved fine.
 *
 * This test simulates that shape: copies the hook + telemetry source tree to a
 * temp dir, mirrors node_modules from the repo MINUS @opentelemetry/*, then
 * spawns each hook subprocess on the default disabled-telemetry path. Any
 * stderr containing @opentelemetry, ENOENT, or MODULE_NOT_FOUND fails the
 * test — proving the disabled path never resolves @opentelemetry/*.
 *
 * Symlink type='junction' is used for cross-platform compatibility — Windows
 * needs junction for directory symlinks without admin rights.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, cp, symlink, readdir, copyFile } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const SYMLINK_DIR_TYPE = platform() === "win32" ? "junction" : "dir";

/**
 * Builds a temp dir that simulates a plugin-cache install with all deps
 * EXCEPT @opentelemetry/*. Returns the temp dir path.
 */
async function buildPluginCacheTemp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crew-cache-smoke-"));

  // Copy source trees the hooks reach via static import.
  await cp(join(REPO_ROOT, "hooks"), join(root, "hooks"), { recursive: true });
  await mkdir(join(root, "scripts", "lib"), { recursive: true });
  await cp(
    join(REPO_ROOT, "scripts", "lib", "telemetry"),
    join(root, "scripts", "lib", "telemetry"),
    { recursive: true }
  );
  await copyFile(join(REPO_ROOT, "package.json"), join(root, "package.json"));

  // Mirror node_modules entry-by-entry, skipping @opentelemetry/*.
  // For scoped packages (@scope/pkg), descend one level so we can selectively
  // skip individual scoped packages.
  const repoNodeModules = join(REPO_ROOT, "node_modules");
  const tempNodeModules = join(root, "node_modules");
  await mkdir(tempNodeModules, { recursive: true });

  const entries = await readdir(repoNodeModules, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "@opentelemetry") {
      // Explicit skip — the bug class this test guards.
      continue;
    }
    if (entry.name.startsWith("@")) {
      // Scoped namespace — recreate dir and symlink each child individually so
      // future scoped omissions can be added without restructuring.
      const scopedSrc = join(repoNodeModules, entry.name);
      const scopedDst = join(tempNodeModules, entry.name);
      await mkdir(scopedDst, { recursive: true });
      const scopedEntries = await readdir(scopedSrc, { withFileTypes: true });
      for (const child of scopedEntries) {
        if (!child.isDirectory()) continue;
        await symlink(
          join(scopedSrc, child.name),
          join(scopedDst, child.name),
          SYMLINK_DIR_TYPE
        );
      }
      continue;
    }
    await symlink(
      join(repoNodeModules, entry.name),
      join(tempNodeModules, entry.name),
      SYMLINK_DIR_TYPE
    );
  }

  return root;
}

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function spawnHook(opts: {
  cacheRoot: string;
  hookRelPath: string;
  stdinPayload: string;
  timeoutMs?: number;
}): Promise<SpawnResult> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const hookAbs = join(opts.cacheRoot, opts.hookRelPath);

  return new Promise<SpawnResult>((resolveSpawn, rejectSpawn) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    // Build clean env — drop CREW_OTEL_ENABLED + NODE_PATH so resolution is
    // strictly per-tree (no global module path escape hatch).
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env["CREW_OTEL_ENABLED"];
    delete env["NODE_PATH"];
    env["CLAUDE_PROJECT_DIR"] = opts.cacheRoot;

    const proc = spawn("bun", [hookAbs], {
      cwd: opts.cacheRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const timer = setTimeout(() => {
      proc.kill();
      rejectSpawn(new Error(`hook ${opts.hookRelPath} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    proc.stderr.on("data", (c: Buffer) => stderrChunks.push(c));
    proc.stdin.end(opts.stdinPayload);
    proc.on("error", (err) => {
      clearTimeout(timer);
      rejectSpawn(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolveSpawn({
        exitCode: code ?? 0,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8")
      });
    });
  });
}

function assertNoOtelLeak(stderr: string, hookName: string): void {
  const banned = ["@opentelemetry", "ENOENT", "MODULE_NOT_FOUND"];
  for (const needle of banned) {
    assert.ok(
      !stderr.includes(needle),
      `${hookName}: disabled-path stderr must not contain "${needle}" — got:\n${stderr}`
    );
  }
}

// ---------------------------------------------------------------------------
// Cases — one per hook entry. Each spawns in an isolated plugin-cache temp dir.
// ---------------------------------------------------------------------------

test("otel-post-tool-use.ts: disabled path resolves without @opentelemetry/*", async () => {
  const cacheRoot = await buildPluginCacheTemp();
  try {
    const payload = JSON.stringify({
      hook_event_name: "PostToolUse",
      session_id: "cache-smoke-post",
      tool_name: "Bash",
      tool_input: { command: "echo cache-smoke" },
      tool_response: { stdout: "cache-smoke\n", exit_code: 0 }
    });
    const result = await spawnHook({
      cacheRoot,
      hookRelPath: join("hooks", "otel-post-tool-use.ts"),
      stdinPayload: payload
    });
    assert.equal(result.exitCode, 0, `hook must exit 0, stderr:\n${result.stderr}`);
    assertNoOtelLeak(result.stderr, "otel-post-tool-use");
  } finally {
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test("otel-stop.ts: disabled path resolves without @opentelemetry/*", async () => {
  const cacheRoot = await buildPluginCacheTemp();
  try {
    const payload = JSON.stringify({
      hook_event_name: "Stop",
      session_id: "cache-smoke-stop",
      stop_hook_active: true
    });
    const result = await spawnHook({
      cacheRoot,
      hookRelPath: join("hooks", "otel-stop.ts"),
      stdinPayload: payload
    });
    assert.equal(result.exitCode, 0, `hook must exit 0, stderr:\n${result.stderr}`);
    assertNoOtelLeak(result.stderr, "otel-stop");
  } finally {
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test("otel-subagent-stop.ts: disabled path resolves without @opentelemetry/*", async () => {
  const cacheRoot = await buildPluginCacheTemp();
  try {
    const payload = JSON.stringify({
      hook_event_name: "SubagentStop",
      session_id: "cache-smoke-subagent",
      stop_hook_active: true
    });
    const result = await spawnHook({
      cacheRoot,
      hookRelPath: join("hooks", "otel-subagent-stop.ts"),
      stdinPayload: payload
    });
    assert.equal(result.exitCode, 0, `hook must exit 0, stderr:\n${result.stderr}`);
    assertNoOtelLeak(result.stderr, "otel-subagent-stop");
  } finally {
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
