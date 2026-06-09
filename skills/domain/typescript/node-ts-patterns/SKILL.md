---
name: node-ts-patterns
tier: domain
stack: typescript
description: Node.js 22/24 LTS patterns for TypeScript — ESM, streams, worker threads, node:test, context propagation, native type-stripping. Load when writing plugin code, CLI tools, or Node.js backend services in TypeScript.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["node:fs", "node:path", "node:stream", "node:worker_threads", "node:test", "import.meta", "fileURLToPath", "createRequire", "process.on", "AsyncLocalStorage", "WorkerData", "*.mjs", "*.cjs"]
---

# Node.js TypeScript Patterns

Patterns for TypeScript targeting Node.js 22 LTS (default) or 24 LTS (native type-stripping). Distinct from browser TypeScript — Node.js has no DOM, has file system access, and manages its own process lifecycle.

## When to use

Load when building plugin code, CLI scripts, server-side services, or any TypeScript that runs in Node.js rather than a browser.

## ESM-first module patterns

All new Node.js TypeScript code uses ESM. Never start a new file with `require()`.

```ts
// ✅ ESM — resolve paths relative to the current file
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);           // Node 22: use import.meta.dirname directly

// ✅ Dynamic import for optional/conditional modules
const mod = await import('./optional-feature.js');

// ✅ Interop with CJS from ESM when needed
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
```

**`package.json` must declare `"type": "module"`** for ESM. TypeScript `tsconfig.json` must use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. Imports must include `.js` extensions (resolves to `.ts` at compile time).

## Explicit resource management (`using` / `await using`)

Prefer over `try/finally` cleanup for any disposable resource.

```ts
// File handle — auto-closes on scope exit
{
  await using fh = await fs.open('data.txt', 'r');
  const content = await fh.readFile({ encoding: 'utf-8' });
} // fh.close() called automatically

// DB connection
async function withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  await using conn = await pool.connect(); // conn[Symbol.asyncDispose] = release
  return fn(conn);
}
```

Implement `Symbol.dispose` (sync) or `Symbol.asyncDispose` (async) on custom disposable classes.

## Typed streams

Use `node:stream/promises` for pipeline; type stream data with generics.

```ts
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform, type TransformCallback } from 'node:stream';

class UpperCaseTransform extends Transform {
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    cb(null, chunk.toString().toUpperCase());
  }
}

await pipeline(
  createReadStream('input.txt'),
  new UpperCaseTransform(),
  createWriteStream('output.txt'),
);
// pipeline throws on error — no manual 'error' listener needed
```

Never use `stream.on('data')` + `stream.on('end')` — use `pipeline()` or async iterators:
```ts
for await (const chunk of createReadStream('file.txt', { encoding: 'utf-8' })) {
  process(chunk);
}
```

## Worker threads

Type `workerData` and message payloads explicitly — never `any`.

```ts
// worker.ts
import { workerData, parentPort } from 'node:worker_threads';
type WorkerInput  = { items: string[] };
type WorkerOutput = { result: number };
const data = workerData as WorkerInput; // validate with Zod in production
parentPort!.postMessage({ result: data.items.length } satisfies WorkerOutput);

// main.ts
import { Worker } from 'node:worker_threads';
function runWorker(items: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./worker.js', import.meta.url), {
      workerData: { items } satisfies WorkerInput,
    });
    w.once('message', (msg: WorkerOutput) => resolve(msg.result));
    w.once('error', reject);
  });
}
```

Use `workerData` for initial input. Use `MessageChannel` for bidirectional communication.

## `node:test` built-in runner

Use for library packages and plugin code that must run without test dependencies.

```ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
describe('MyFeature', () => {
  before(async () => { /* setup */ });
  after(async ()  => { /* teardown */ });
  it('returns correct value', () => { assert.strictEqual(myFn(1), 2); });
  it('handles error path', async () => {
    await assert.rejects(() => myFn(-1), { message: /negative/ });
  });
});
```

Run with `node --test`. Use Vitest for application code that needs mocking, snapshots, and coverage.

## Context propagation with `AsyncLocalStorage`

Pass request-scoped context (correlation ID, user, tenant) without threading through every function signature.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = { correlationId: string; userId?: string };
export const requestContext = new AsyncLocalStorage<RequestContext>();

// middleware / entry point
requestContext.run({ correlationId: generateId() }, () => {
  handleRequest();
});

// deep in the call stack — no parameter needed
function logEvent(event: string): void {
  const ctx = requestContext.getStore(); // never undefined inside run()
  logger.info({ event, correlationId: ctx?.correlationId });
}
```

## Process lifecycle

```ts
// Unhandled rejections must be handled — default throws in Node 22+
process.on('unhandledRejection', (reason) => {
  logger.error({ msg: 'unhandledRejection', reason });
  process.exitCode = 1;
});

// Graceful shutdown — release resources before exit
const shutdown = async (): Promise<void> => {
  await server.close();
  await db.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT',  () => void shutdown());
```

Never `process.exit(N)` from library code — set `process.exitCode` instead and let the event loop drain.

## Node.js 24 native type-stripping

Node.js 24 LTS runs `.ts` files directly via `--experimental-strip-types` (no decorators, no `const enum`, no namespace-as-value).

```bash
node --experimental-strip-types script.ts
# package.json: "start": "node --experimental-strip-types src/index.ts"
```

Use for CLI scripts and plugin hooks. Code using decorators or advanced emit transforms still requires `tsc`.

## Done criteria

- All imports use ESM syntax; no top-level `require()`
- File extension `.js` on all local imports (resolves to `.ts` at compile time)
- Disposable resources use `using` / `await using` instead of `try/finally`
- Streams use `pipeline()` or async iterators — no raw event listener patterns
- Worker thread message types are explicitly typed via discriminated union or `satisfies`
- `unhandledRejection` handler present in process entry points
- Graceful `SIGTERM` / `SIGINT` shutdown registered
- No `process.exit()` from library functions — use `process.exitCode`
