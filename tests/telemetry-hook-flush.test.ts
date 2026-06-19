/**
 * Live-flush integration test for FEAT-165 hooks (v0.37.1 hotfix gate).
 *
 * Why this exists: InMemorySpanExporter from @opentelemetry/sdk-trace-base is
 * synchronous — onEnd() queues spans the moment they're emitted, masking the
 * async batch-then-export path. A hook that forgets `await sdk.shutdown()`
 * before process exit will pass every InMemorySpanExporter unit test but
 * drop every span in production.
 *
 * This test spawns each hook script as a real subprocess, captures the OTLP
 * HTTP request, and asserts a span arrived before process exit. If the hook
 * skips shutdown(), no request lands → test fails.
 *
 * Discovered via live Langfuse-cloud dogfood post-v0.37.0:
 *   - hooks/otel-post-tool-use.ts:   shipped without flush — dropped spans
 *   - hooks/otel-subagent-stop.ts:   shipped without flush — dropped spans
 *   - hooks/otel-stop.ts:            already correct, used as reference shape
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

interface CapturedRequest {
  body: Buffer;
  authHeader: string | undefined;
  contentType: string | undefined;
}

/**
 * Starts a minimal HTTP server that accepts OTLP POST and records the body.
 * Returns the listen port + a Promise that resolves with the first captured
 * request OR rejects on `timeoutMs` of silence.
 */
function startCollector(timeoutMs: number): Promise<{
  port: number;
  server: Server;
  received: Promise<CapturedRequest>;
}> {
  return new Promise((resolveStart) => {
    let resolveReceived: (req: CapturedRequest) => void;
    let rejectReceived: (err: Error) => void;
    const received = new Promise<CapturedRequest>((res, rej) => {
      resolveReceived = res;
      rejectReceived = rej;
    });

    const timer = setTimeout(() => {
      rejectReceived(new Error(`collector received no request in ${timeoutMs}ms`));
    }, timeoutMs);

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        clearTimeout(timer);
        const body = Buffer.concat(chunks);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-protobuf");
        res.end();
        resolveReceived({
          body,
          authHeader: req.headers["authorization"] as string | undefined,
          contentType: req.headers["content-type"] as string | undefined
        });
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        throw new Error("server address unavailable");
      }
      resolveStart({ port: addr.port, server, received });
    });
  });
}

/**
 * Runs one hook subprocess with the supplied payload + telemetry config.
 * Returns exit code + collector capture promise.
 */
async function runHookWithCollector(opts: {
  hookPath: string;
  stdinPayload: string;
  timeoutMs?: number;
}): Promise<{ exitCode: number; capture: CapturedRequest }> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const { port, server, received } = await startCollector(timeoutMs);
  const cwd = await mkdtemp(join(tmpdir(), "otel-flush-test-"));

  try {
    const telemetryDir = join(cwd, ".claude", "crew");
    await writeFile(
      join(telemetryDir, "telemetry.yaml"),
      `enabled: true
endpoint: "http://127.0.0.1:${port}/v1/traces"
auth:
  header_name: "Authorization"
  header_value: "Basic test-auth-token"
sample_rate: 1.0
scrub_pii: true
redact_paths: []
redact_attr_max_chars: 2048
max_queue_size: 2048
schedule_delay_ms: 5000
export_timeout_ms: 30000
`,
      { encoding: "utf8" }
    ).catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(telemetryDir, { recursive: true });
      await writeFile(
        join(telemetryDir, "telemetry.yaml"),
        `enabled: true
endpoint: "http://127.0.0.1:${port}/v1/traces"
auth:
  header_name: "Authorization"
  header_value: "Basic test-auth-token"
sample_rate: 1.0
scrub_pii: true
redact_paths: []
redact_attr_max_chars: 2048
max_queue_size: 2048
schedule_delay_ms: 5000
export_timeout_ms: 30000
`,
        { encoding: "utf8" }
      );
    });

    const exitCode = await new Promise<number>((resolveExit, rejectExit) => {
      const proc = spawn("bun", [opts.hookPath], {
        cwd,
        env: {
          ...process.env,
          CREW_OTEL_ENABLED: "1"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
      proc.stdin.end(opts.stdinPayload);
      proc.on("error", rejectExit);
      proc.on("close", (code) => resolveExit(code ?? 0));
    });

    const capture = await received;
    return { exitCode, capture };
  } finally {
    server.close();
    await rm(cwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------

test("otel-post-tool-use.ts flushes BatchSpanProcessor before exit", async () => {
  const payload = JSON.stringify({
    hook_event_name: "PostToolUse",
    session_id: "flush-test-post",
    tool_name: "Bash",
    tool_input: { command: "echo flush-check" },
    tool_response: { stdout: "flush-check\n", exit_code: 0 }
  });
  const { exitCode, capture } = await runHookWithCollector({
    hookPath: join(REPO_ROOT, "hooks", "otel-post-tool-use.ts"),
    stdinPayload: payload
  });
  assert.equal(exitCode, 0, "hook must exit 0");
  assert.equal(capture.authHeader, "Basic test-auth-token", "auth header forwarded");
  assert.ok(capture.body.length > 0, "OTLP body non-empty (span flushed before process exit)");
});

test("otel-stop.ts flushes BatchSpanProcessor before exit", async () => {
  const payload = JSON.stringify({
    hook_event_name: "Stop",
    session_id: "flush-test-stop",
    stop_hook_active: true
  });
  const { exitCode, capture } = await runHookWithCollector({
    hookPath: join(REPO_ROOT, "hooks", "otel-stop.ts"),
    stdinPayload: payload
  });
  assert.equal(exitCode, 0, "hook must exit 0");
  assert.ok(capture.body.length > 0, "OTLP body non-empty (span flushed before process exit)");
});

test("otel-subagent-stop.ts flushes BatchSpanProcessor before exit", async () => {
  const payload = JSON.stringify({
    hook_event_name: "SubagentStop",
    session_id: "flush-test-subagent",
    stop_hook_active: true
  });
  const { exitCode, capture } = await runHookWithCollector({
    hookPath: join(REPO_ROOT, "hooks", "otel-subagent-stop.ts"),
    stdinPayload: payload
  });
  assert.equal(exitCode, 0, "hook must exit 0");
  assert.ok(capture.body.length > 0, "OTLP body non-empty (span flushed before process exit)");
});
