// tests/memory-provider-astramem.test.ts
// FEAT-188 S4 AC coverage: astramemProvider — unpaired-fallback to
// fileProvider (AC-2) and contract-parity vs fileProvider (AC-3). No live
// astramem daemon exists in CI, so these tests force the "unpaired" branch
// deterministically by pointing MEMORY_API_URL_LOCAL at an unreachable port
// and leaving MEMORY_API_URL_SAAS unset — the underlying
// astramem-plugin/providers/local factory (invoked by astramem-client's
// resolveWireProvider(), which this module now delegates to) reads that env
// var as its default health-check target.
//
// astramem-client caches the FIRST resolveWireProvider() result (success or
// failure) for the process lifetime — see astramem-client/src/resolve.ts.
// `withUnpairedEnv()` calls `_resetResolveCache()` around each test so a
// resolution cached by an earlier test (in this file or elsewhere in the
// same `bun test` process) can't leak into these env-var-driven assertions.
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
import { test, expect } from "bun:test";
import { _resetResolveCache } from "@astragenie/astramem-client";
import { astramemProvider, fileProvider, type RemoteHandle } from "@astragenie/memory-provider";

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
  _resetResolveCache();
  try {
    return await fn();
  } finally {
    if (priorLocal === undefined) delete process.env["MEMORY_API_URL_LOCAL"];
    else process.env["MEMORY_API_URL_LOCAL"] = priorLocal;
    if (priorSaas === undefined) delete process.env["MEMORY_API_URL_SAAS"];
    else process.env["MEMORY_API_URL_SAAS"] = priorSaas;
    if (priorSaasAlias === undefined) delete process.env["MEMORY_API_URL"];
    else process.env["MEMORY_API_URL"] = priorSaasAlias;
    _resetResolveCache();
  }
}

test("astramemProvider describes itself as astramem", () => {
  expect(astramemProvider("/tmp/whatever").describe()).toEqual({ provider: "astramem" });
});

test("astramemProvider falls back to fileProvider when unpaired (AC-2) — capture + recall never throw", async () => {
  const repo = await makeTempRepo("memory-astramem-unpaired-");
  try {
    await withUnpairedEnv(async () => {
      const provider = astramemProvider(repo);
      await provider.capture({
        kind: "failure",
        severity: "high",
        summary: "unpaired capture should fall back to file",
        source: "test"
      });
      const results = await provider.recall({ k: 5 });
      expect(results.length).toBe(1);
      expect(results[0]!.summary).toBe("unpaired capture should fall back to file");
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

      expect(
        astramemResults.map((r) => r.id),
        "unpaired astramemProvider ranking must match fileProvider exactly"
      ).toEqual(fileResults.map((r) => r.id));
      expect(astramemResults[0]!.id).toBe("fresh-critical");
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
      expect(results.some((r) => r.id === "bad-entry")).toBeTruthy();

      await provider.invalidate("bad-entry");
      results = await provider.recall({ k: 5 });
      expect(!results.some((r) => r.id === "bad-entry")).toBeTruthy();
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
      expect(ids.includes("v2")).toBeTruthy();
      expect(!ids.includes("v1")).toBeTruthy();
    });
  } finally {
    await cleanup(repo);
  }
});

test("resolveProvider wires provider:astramem to astramemProvider (S2 hand-off)", async () => {
  const { resolveProvider } = await import("@astragenie/memory-provider");
  const repo = await makeTempRepo("memory-astramem-wiring-");
  try {
    await withUnpairedEnv(async () => {
      const provider = resolveProvider({ provider: "astramem", enabled: "auto" }, repo);
      expect(provider.describe()).toEqual({ provider: "astramem" });
      await provider.capture({
        kind: "lesson",
        severity: "low",
        summary: "wired via resolveProvider",
        source: "t"
      });
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
// (@astragenie/memory-provider) — production callers never set this option.

interface FakeWireDaemon {
  rememberCalls: number;
  resolveRemote: () => Promise<RemoteHandle | null>;
}

function makeFakeWireDaemon(): FakeWireDaemon {
  let rememberCalls = 0;
  const handle: RemoteHandle = {
    name: "local",
    provider: {
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
  expect(
    daemon.rememberCalls,
    `remember() call count did not reach ${expected} within ${timeoutMs}ms`
  ).toBe(expected);
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
    expect(
      fileResults.length,
      "dualWrite:true must also mirror the entry into the local JSONL"
    ).toBe(1);
    expect(fileResults[0]!.summary).toBe("paired dual-write capture");
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
    expect(fileResults.length, "dualWrite:false must NOT mirror into the local JSONL").toBe(0);
  } finally {
    await cleanup(repo);
  }
});
