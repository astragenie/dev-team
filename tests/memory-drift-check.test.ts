// tests/memory-drift-check.test.ts
// FEAT-188 S5 AC coverage: drift-detection diagnostic (S4 accepted-risk
// follow-up). astramem writes are fire-and-forget, so the JSONL "derived
// duplicate" can be more complete than the astramem "source of truth" —
// checkDrift() compares the two (read-only, never writes to astramem).
//
// Uses a pure in-memory fake RemoteHandle (same pattern as
// tests/memory-provider-astramem.test.ts's makeFakeWireDaemon) — no real
// socket, no http.Server.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { checkDrift } from "../scripts/lib/memory/drift-check.ts";
import { fileProvider } from "../scripts/lib/memory/file-provider.ts";
import type { RemoteHandle } from "../scripts/lib/memory/astramem-provider.ts";
import type { RecallHit } from "@astragenie/astramem-plugin/contracts";

async function makeTempRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

/** A fake RemoteHandle whose recall() only "knows about" the given ids. */
function makeFakeRemote(knownIds: Set<string>): RemoteHandle {
  return {
    name: "local",
    provider: {
      async ingest(): Promise<void> {},
      async ingestTranscript(): Promise<void> {},
      async remember(): Promise<void> {},
      async health() {
        return { ok: true, version: "test-fake" };
      },
      async recall(req: { query: string; k: number }) {
        // Best-effort fake: match on substring since the diagnostic queries
        // with the entry's own summary text.
        const hits: RecallHit[] = [...knownIds]
          .filter((id) => req.query.includes(id))
          .map((id) => ({ id, type: "lesson", text: req.query, score: 1 }));
        return { hits };
      }
    }
  };
}

test("checkDrift reports a JSONL entry that astramem does not know about", async () => {
  const repo = await makeTempRepo("memory-drift-missing-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "only-local-marker",
      kind: "failure",
      severity: "high",
      summary: "captured locally, only-local-marker never reached astramem",
      source: "test"
    });

    const remote = makeFakeRemote(new Set()); // astramem knows nothing
    const report = await checkDrift(repo, remote);

    assert.equal(report.checked, 1);
    assert.ok(
      report.missingFromAstramem.some((e) => e.id === "only-local-marker"),
      "an entry astramem cannot confirm must be reported as drift"
    );
  } finally {
    await cleanup(repo);
  }
});

test("checkDrift does not report an entry astramem confirms present", async () => {
  const repo = await makeTempRepo("memory-drift-present-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "present-marker",
      kind: "lesson",
      severity: "medium",
      summary: "present-marker made it to astramem too",
      source: "test"
    });

    const remote = makeFakeRemote(new Set(["present-marker"]));
    const report = await checkDrift(repo, remote);

    assert.equal(report.checked, 1);
    assert.ok(
      !report.missingFromAstramem.some((e) => e.id === "present-marker"),
      "an entry astramem confirms present must not be reported as drift"
    );
  } finally {
    await cleanup(repo);
  }
});

test("checkDrift only considers entries inside the configured window", async () => {
  const repo = await makeTempRepo("memory-drift-window-");
  try {
    const provider = fileProvider(repo);
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await provider.capture({
      id: "outside-window",
      ts: old,
      kind: "lesson",
      severity: "low",
      summary: "outside-window entry predates the drift-check window",
      source: "test"
    });

    const remote = makeFakeRemote(new Set());
    const report = await checkDrift(repo, remote, { windowDays: 45 });

    assert.equal(report.checked, 0, "an entry older than the window should not be checked at all");
    assert.ok(!report.missingFromAstramem.some((e) => e.id === "outside-window"));
  } finally {
    await cleanup(repo);
  }
});

test("checkDrift never writes to astramem — it is a read-only diagnostic", async () => {
  const repo = await makeTempRepo("memory-drift-readonly-");
  try {
    const provider = fileProvider(repo);
    await provider.capture({
      id: "readonly-check",
      kind: "lesson",
      severity: "low",
      summary: "readonly-check entry",
      source: "test"
    });

    let rememberCalls = 0;
    const remote: RemoteHandle = {
      name: "local",
      provider: {
        async ingest(): Promise<void> {},
        async ingestTranscript(): Promise<void> {},
        async remember(): Promise<void> {
          rememberCalls += 1;
        },
        async health() {
          return { ok: true, version: "test-fake" };
        },
        async recall() {
          return { hits: [] };
        }
      }
    };

    await checkDrift(repo, remote);
    assert.equal(rememberCalls, 0, "checkDrift must never call remember() — diagnostic only");
  } finally {
    await cleanup(repo);
  }
});
