// tests/memory-provider-astramem.test.ts
// FEAT-188 S4 AC coverage: astramemProvider — unpaired-fallback to
// fileProvider (AC-2) and contract-parity vs fileProvider (AC-3). No live
// astramem daemon exists in CI, so these tests force the "unpaired" branch
// deterministically by pointing MEMORY_API_URL_LOCAL at an unreachable port
// and leaving MEMORY_API_URL_SAAS unset (probeSaas short-circuits to null
// without a network call — see astramem-provider.ts).
//
// Paired-mode tests (below) use a pure in-memory fake `RemoteHandle`
// injected via the `__resolveRemote` test seam — no `http.Server`, no
// socket. This is a deliberate fix for astragenie/dev-team#170: the
// previous real-daemon-over-loopback version of these 2 tests flaked
// deterministically inside the full `bun run test` suite (never in
// isolation). Root cause (see the FEAT-188 S4 flake-fix handoff): the repo's
// only other in-process `http.Server` test (tests/telemetry-hook-flush.test.ts)
// aborts from the same known Bun #5090 node:test-cascade bug in the same
// full-suite runs — astramem's fire-and-forget remember() over a real
// socket was a downstream casualty of that single-process scheduling
// corruption, not standalone HTTP contention. Removing the real socket
// removes the exposure entirely while preserving the routing/dual-write
// assertions the tests exist to cover.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { astramemProvider, type RemoteHandle } from "../scripts/lib/memory/astramem-provider.ts";
import { fileProvider } from "../scripts/lib/memory/file-provider.ts";

const UNREACHABLE_LOCAL_URL = "http://127.0.0.1:1";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function withUnpairedEnv<T>(fn: () => Promise<T>): Promise<T> {
  const priorLocal = process.env["MEMORY_API_URL_LOCAL"];
  const priorSaas = process.env["MEMORY_API_URL_SAAS"];
  const priorSaasAlias = process.env["MEMORY_API_URL"];
  process.env["MEMORY_API_URL_LOCAL"] = UNREACHABLE_LOCAL_URL;
  delete process.env["MEMORY_API_URL_SAAS"];
  delete process.env["MEMORY_API_URL"];
  try {
    return await fn();
  } finally {
    if (priorLocal === undefined) delete process.env["MEMORY_API_URL_LOCAL"];
    else process.env["MEMORY_API_URL_LOCAL"] = priorLocal;
    if (priorSaas === undefined) delete process.env["MEMORY_API_URL_SAAS"];
    else process.env["MEMORY_API_URL_SAAS"] = priorSaas;
    if (priorSaasAlias === undefined) delete process.env["MEMORY_API_URL"];
    else process.env["MEMORY_API_URL"] = priorSaasAlias;
  }
}

test("astramemProvider describes itself as astramem", () => {
  assert.deepEqual(astramemProvider("/tmp/whatever").describe(), { provider: "astramem" });
});

test("astramemProvider falls back to fileProvider when unpaired (AC-2) — capture + recall never throw", async () => {
  const repo = await makeTempRepo("memory-astramem-unpaired-");
  try {
    await withUnpairedEnv(async () => {
      const provider = astramemProvider(repo);
      await assert.doesNotReject(
        provider.capture({
          kind: "failure",
          severity: "high",
          summary: "unpaired capture should fall back to file",
          source: "test"
        })
      );
      const results = await provider.recall({ k: 5 });
      assert.equal(results.length, 1);
      assert.equal(results[0]!.summary, "unpaired capture should fall back to file");
    });
  } finally {
    await cleanup(repo);
  }
});

test("astramemProvider contract-parity: recall() ranks/truncates identically to fileProvider when unpaired (AC-3)", async () => {
  const repoA = await makeTempRepo("memory-astramem-parity-a-");
  const repoB = await makeTempRepo("memory-astramem-parity-b-");
  try {
    await withUnpairedEnv(async () => {
      const astramem = astramemProvider(repoA);
      const file = fileProvider(repoB);

      const now = Date.now();
      const entries = [
        {
          id: "old-low",
          ts: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
          kind: "lesson",
          severity: "low",
          summary: "old and low severity",
          source: "t"
        },
        {
          id: "fresh-critical",
          ts: new Date(now - 60 * 1000).toISOString(),
          kind: "failure",
          severity: "critical",
          summary: "fresh and critical",
          source: "t"
        }
      ] as const;

      for (const entry of entries) {
        await astramem.capture(entry);
        await file.capture(entry);
      }

      const astramemResults = await astramem.recall({ k: 5 });
      const fileResults = await file.recall({ k: 5 });

      assert.deepEqual(
        astramemResults.map((r) => r.id),
        fileResults.map((r) => r.id),
        "unpaired astramemProvider ranking must match fileProvider exactly"
      );
      assert.equal(astramemResults[0]!.id, "fresh-critical");
    });
  } finally {
    await cleanup(repoA);
    await cleanup(repoB);
  }
});

test("astramemProvider.invalidate excludes an entry from future recall() calls (unpaired)", async () => {
  const repo = await makeTempRepo("memory-astramem-invalidate-");
  try {
    await withUnpairedEnv(async () => {
      const provider = astramemProvider(repo);
      await provider.capture({
        id: "bad-entry",
        kind: "lesson",
        severity: "high",
        summary: "turned out to be wrong",
        source: "t"
      });
      let results = await provider.recall({ k: 5 });
      assert.ok(results.some((r) => r.id === "bad-entry"));

      await provider.invalidate("bad-entry");
      results = await provider.recall({ k: 5 });
      assert.ok(!results.some((r) => r.id === "bad-entry"));
    });
  } finally {
    await cleanup(repo);
  }
});

test("astramemProvider.supersede resolves the chain when unpaired — only the latest entry is returned", async () => {
  const repo = await makeTempRepo("memory-astramem-supersede-");
  try {
    await withUnpairedEnv(async () => {
      const provider = astramemProvider(repo);
      await provider.capture({
        id: "v1",
        kind: "decision",
        severity: "medium",
        summary: "original",
        source: "t"
      });
      await provider.supersede("v1", {
        id: "v2",
        kind: "decision",
        severity: "medium",
        summary: "revised",
        source: "t"
      });

      const results = await provider.recall({ k: 5 });
      const ids = results.map((r) => r.id);
      assert.ok(ids.includes("v2"));
      assert.ok(!ids.includes("v1"));
    });
  } finally {
    await cleanup(repo);
  }
});

test("resolveProvider wires provider:astramem to astramemProvider (S2 hand-off)", async () => {
  const { resolveProvider } = await import("../scripts/lib/memory/resolve-provider.ts");
  const repo = await makeTempRepo("memory-astramem-wiring-");
  try {
    await withUnpairedEnv(async () => {
      const provider = resolveProvider({ provider: "astramem", enabled: "auto" }, repo);
      assert.deepEqual(provider.describe(), { provider: "astramem" });
      await assert.doesNotReject(
        provider.capture({
          kind: "lesson",
          severity: "low",
          summary: "wired via resolveProvider",
          source: "t"
        })
      );
    });
  } finally {
    await cleanup(repo);
  }
});

// --- paired mode (in-memory fake wire provider) — exercises the branch the
// unpaired tests above cannot reach: a "healthy" resolveRemote() + a
// remember() call — with NO real socket. Fixed per astragenie/dev-team#170:
// see the file-header comment for why the previous real-http.Server version
// of these 2 tests flaked in the full suite. Injected via the
// `__resolveRemote` test seam on AstramemProviderOptions
// (scripts/lib/memory/astramem-provider.ts) — production callers never set
// this option.

interface FakeWireDaemon {
  rememberCalls: number;
  resolveRemote: () => Promise<RemoteHandle | null>;
}

function makeFakeWireDaemon(): FakeWireDaemon {
  let rememberCalls = 0;
  const handle: RemoteHandle = {
    name: "local",
    provider: {
      async ingest(): Promise<void> {
        /* not exercised by astramemProvider's write path */
      },
      async ingestTranscript(): Promise<void> {
        /* not exercised by astramemProvider's write path */
      },
      async recall() {
        return { hits: [] };
      },
      async remember(): Promise<void> {
        rememberCalls += 1;
      },
      async health() {
        return { ok: true, version: "test-fake" };
      }
    }
  };
  return {
    get rememberCalls() {
      return rememberCalls;
    },
    resolveRemote: async () => handle
  };
}

/**
 * remember() is intentionally fire-and-forget (not awaited by capture()) —
 * poll briefly instead of asserting immediately, since the in-memory
 * increment is not guaranteed to have landed the instant capture() resolves
 * (it still goes through a microtask hop via the fire-and-forget promise
 * chain in writeThrough()).
 */
async function waitForRememberCalls(
  daemon: FakeWireDaemon,
  expected: number,
  timeoutMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (daemon.rememberCalls >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(
    daemon.rememberCalls,
    expected,
    `remember() call count did not reach ${expected} within ${timeoutMs}ms`
  );
}

test("astramemProvider (paired, dualWrite:true) writes BOTH the fake remote AND the local JSONL", async () => {
  const repo = await makeTempRepo("memory-astramem-paired-dualwrite-");
  const daemon = makeFakeWireDaemon();
  try {
    const provider = astramemProvider(repo, {
      dualWrite: true,
      __resolveRemote: daemon.resolveRemote
    });
    await provider.capture({
      kind: "failure",
      severity: "high",
      summary: "paired dual-write capture",
      source: "test"
    });

    await waitForRememberCalls(daemon, 1);

    const fileResults = await fileProvider(repo).recall({ k: 5 });
    assert.equal(
      fileResults.length,
      1,
      "dualWrite:true must also mirror the entry into the local JSONL"
    );
    assert.equal(fileResults[0]!.summary, "paired dual-write capture");
  } finally {
    await cleanup(repo);
  }
});

test("astramemProvider (paired, dualWrite:false) writes ONLY the fake remote — no local JSONL mirror", async () => {
  const repo = await makeTempRepo("memory-astramem-paired-nodual-");
  const daemon = makeFakeWireDaemon();
  try {
    const provider = astramemProvider(repo, { __resolveRemote: daemon.resolveRemote });
    await provider.capture({
      kind: "failure",
      severity: "high",
      summary: "paired single-write capture",
      source: "test"
    });

    await waitForRememberCalls(daemon, 1);

    const fileResults = await fileProvider(repo).recall({ k: 5 });
    assert.equal(fileResults.length, 0, "dualWrite:false must NOT mirror into the local JSONL");
  } finally {
    await cleanup(repo);
  }
});
