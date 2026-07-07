// tests/memory-provider-astramem-resolver.test.ts
// FEAT-188 S5 (S4 review 🟡 test-fidelity fast-follow): no existing test
// exercised a SUCCESSFUL probeLocal()/probeSaas()/makeRemoteResolver()
// resolution — the paired tests in memory-provider-astramem.test.ts bypass
// the resolver entirely via the `__resolveRemote` seam, and the unpaired
// tests only ever hit the failure branch (probeLocal/probeSaas both return
// null). This file exercises the REAL resolution code path via the new
// `RemoteLoaderOverrides` seam (astramem-provider.ts) — a fake loader
// function returning a healthy provider, with NO real network call and NO
// in-process http.Server (the astragenie/dev-team#170 flake source).
import test from "node:test";
import assert from "node:assert/strict";
import {
  makeRemoteResolver,
  probeLocal,
  probeSaas,
  type RemoteHandle
} from "../scripts/lib/memory/astramem-provider.ts";
import type { MemoryProvider as AstramemWireProvider } from "@astragenie/astramem-plugin/contracts";

function makeHealthyFakeProvider(): AstramemWireProvider {
  return {
    async ingest(): Promise<void> {},
    async ingestTranscript(): Promise<void> {},
    async remember(): Promise<void> {},
    async recall() {
      return { hits: [] };
    },
    async health() {
      return { ok: true, version: "test-fake" };
    }
  };
}

function makeUnhealthyFakeProvider(): AstramemWireProvider {
  return {
    async ingest(): Promise<void> {},
    async ingestTranscript(): Promise<void> {},
    async remember(): Promise<void> {},
    async recall() {
      return { hits: [] };
    },
    async health() {
      return { ok: false };
    }
  };
}

test("probeLocal resolves a RemoteHandle when the (fake) local loader reports healthy", async () => {
  const handle = await probeLocal({ loadLocal: async () => makeHealthyFakeProvider() });
  assert.ok(handle, "probeLocal must return a RemoteHandle on a healthy probe");
  assert.equal(handle?.name, "local");
});

test("probeLocal returns null when the (fake) local loader reports unhealthy", async () => {
  const handle = await probeLocal({ loadLocal: async () => makeUnhealthyFakeProvider() });
  assert.equal(handle, null);
});

test("probeSaas resolves a RemoteHandle when configured (MEMORY_API_URL_SAAS set) and the fake loader reports healthy", async () => {
  const prior = process.env["MEMORY_API_URL_SAAS"];
  process.env["MEMORY_API_URL_SAAS"] = "http://example.invalid";
  try {
    const handle = await probeSaas({ loadSaas: async () => makeHealthyFakeProvider() });
    assert.ok(handle, "probeSaas must return a RemoteHandle on a healthy probe when configured");
    assert.equal(handle?.name, "saas");
  } finally {
    if (prior === undefined) delete process.env["MEMORY_API_URL_SAAS"];
    else process.env["MEMORY_API_URL_SAAS"] = prior;
  }
});

test("probeSaas returns null when unconfigured, regardless of the fake loader", async () => {
  const priorSaas = process.env["MEMORY_API_URL_SAAS"];
  const priorAlias = process.env["MEMORY_API_URL"];
  delete process.env["MEMORY_API_URL_SAAS"];
  delete process.env["MEMORY_API_URL"];
  try {
    const handle = await probeSaas({ loadSaas: async () => makeHealthyFakeProvider() });
    assert.equal(
      handle,
      null,
      "unconfigured SaaS must short-circuit before even calling the loader"
    );
  } finally {
    if (priorSaas === undefined) delete process.env["MEMORY_API_URL_SAAS"];
    else process.env["MEMORY_API_URL_SAAS"] = priorSaas;
    if (priorAlias === undefined) delete process.env["MEMORY_API_URL"];
    else process.env["MEMORY_API_URL"] = priorAlias;
  }
});

test("makeRemoteResolver resolves to the local handle (local-first precedence) via the real success path", async () => {
  const priorSaas = process.env["MEMORY_API_URL_SAAS"];
  const priorAlias = process.env["MEMORY_API_URL"];
  delete process.env["MEMORY_API_URL_SAAS"];
  delete process.env["MEMORY_API_URL"];
  try {
    let saasCalls = 0;
    const resolver = makeRemoteResolver({
      loadLocal: async () => makeHealthyFakeProvider(),
      loadSaas: async () => {
        saasCalls += 1;
        return makeHealthyFakeProvider();
      }
    });

    const handle: RemoteHandle | null = await resolver();
    assert.ok(handle);
    assert.equal(handle?.name, "local");
    assert.equal(saasCalls, 0, "saas should never be probed once local resolves healthy");
  } finally {
    if (priorSaas === undefined) delete process.env["MEMORY_API_URL_SAAS"];
    else process.env["MEMORY_API_URL_SAAS"] = priorSaas;
    if (priorAlias === undefined) delete process.env["MEMORY_API_URL"];
    else process.env["MEMORY_API_URL"] = priorAlias;
  }
});

test("makeRemoteResolver caches a successful resolution across calls within the TTL", async () => {
  let localCalls = 0;
  const resolver = makeRemoteResolver({
    loadLocal: async () => {
      localCalls += 1;
      return makeHealthyFakeProvider();
    }
  });

  await resolver();
  await resolver();
  await resolver();

  assert.equal(
    localCalls,
    1,
    "the resolver should cache a resolved handle instead of re-probing every call"
  );
});
