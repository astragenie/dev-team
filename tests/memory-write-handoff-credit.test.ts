import { test, expect } from "bun:test";
// tests/memory-write-handoff-credit.test.ts — writeArtifact's
// "credit on receipt" hook (dispatch-memory-credit-loop, runner-plugin
// upstream request 2026-07-16). write-handoff is the one chokepoint where
// the orchestrator consumes a specialist's handoff for most specialist
// types; this proves the OPTIONAL `memoriesUsed` field triggers a bounded,
// detached credit call — never inline-awaited, never fired for other
// artifact kinds, and never fired when the field is absent/empty.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { __drainPendingCaptures, writeArtifact } from "../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../scripts/lib/artifacts/types.ts";

async function tmpRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("fires a detached, bounded credit call when kind:handoff carries memoriesUsed", async () => {
  const repo = await tmpRepo("write-handoff-credit-on-");
  try {
    const calls: string[][] = [];
    const fields: ArtifactFields = {
      title: "t",
      summary: "s",
      memoriesUsed: ["a", "b"]
    };
    const result = await writeArtifact(repo, "handoff", fields, {
      __creditMemoriesUsedLoader: async () => ({
        creditMemoriesUsed: async (opts: { ids: unknown }) => {
          calls.push(opts.ids as string[]);
          return { credited: opts.ids as string[] };
        }
      })
    });
    expect(result.ok).toBe(true);
    await __drainPendingCaptures();
    expect(calls).toEqual([["a", "b"]]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("does not fire the credit loader when memoriesUsed is absent", async () => {
  const repo = await tmpRepo("write-handoff-credit-absent-");
  try {
    let called = false;
    const result = await writeArtifact(
      repo,
      "handoff",
      { title: "t", summary: "s" },
      {
        __creditMemoriesUsedLoader: async () => ({
          creditMemoriesUsed: async () => {
            called = true;
            return { credited: [] };
          }
        })
      }
    );
    expect(result.ok).toBe(true);
    await __drainPendingCaptures();
    expect(called).toBe(false);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("does not fire the credit loader when memoriesUsed is an empty array", async () => {
  const repo = await tmpRepo("write-handoff-credit-empty-");
  try {
    let called = false;
    const result = await writeArtifact(
      repo,
      "handoff",
      { title: "t", summary: "s", memoriesUsed: [] },
      {
        __creditMemoriesUsedLoader: async () => ({
          creditMemoriesUsed: async () => {
            called = true;
            return { credited: [] };
          }
        })
      }
    );
    expect(result.ok).toBe(true);
    await __drainPendingCaptures();
    expect(called).toBe(false);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("never fires for a non-handoff artifact kind, even with memoriesUsed present", async () => {
  const repo = await tmpRepo("write-handoff-credit-otherkind-");
  try {
    let called = false;
    const result = await writeArtifact(
      repo,
      "review-result",
      { title: "t", summary: "s", decision: "approved", memoriesUsed: ["a"] },
      {
        __creditMemoriesUsedLoader: async () => ({
          creditMemoriesUsed: async () => {
            called = true;
            return { credited: [] };
          }
        })
      }
    );
    expect(result.ok).toBe(true);
    await __drainPendingCaptures();
    expect(called).toBe(false);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("writeArtifact returns promptly even when the credit loader is slow (detached, bounded by fireGuarded)", async () => {
  const repo = await tmpRepo("write-handoff-credit-slow-");
  try {
    const slowLoader = async () => ({
      creditMemoriesUsed: async (opts: { ids: unknown }) =>
        new Promise<{ credited: string[] }>((resolve) => {
          setTimeout(() => resolve({ credited: opts.ids as string[] }), 800);
        })
    });

    const t0 = performance.now();
    const result = await writeArtifact(
      repo,
      "handoff",
      { title: "t", summary: "s", memoriesUsed: ["a"] },
      { __creditMemoriesUsedLoader: slowLoader, __guardTimeoutMs: 50 }
    );
    const elapsed = performance.now() - t0;

    expect(result.ok).toBe(true);
    expect(elapsed < 300, `expected a prompt return, took ${elapsed}ms`).toBeTruthy();
  } finally {
    await __drainPendingCaptures();
    await fs.rm(repo, { recursive: true, force: true });
  }
});
