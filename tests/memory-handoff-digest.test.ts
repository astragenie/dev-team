// tests/memory-handoff-digest.test.ts — dispatch-memory-credit-loop digest
// (runner-plugin upstream request 2026-07-16). Covers: byte-identical
// behavior to buildProfileBlock when memory.feedback.creditLoop.enabled is
// false (default), id-carrying recall hits appended when enabled, the k<=5
// hard cap, and the global memory.enabled:"never" kill-switch winning over
// every sub-flag.
//
// Config lives at `memory.feedback.creditLoop.*`, not a bare top-level
// `memory.creditLoop` — @astragenie/memory-provider's MemoryConfigSchema is
// `.strict()` at the top level; only `profile`/`feedback` are declared
// passthrough extension namespaces (see handoff-digest.ts's header).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildHandoffDigest, parseCreditLoopConfig } from "../scripts/lib/memory/handoff-digest.ts";
import { buildProfileBlock } from "../scripts/lib/memory/inject-profile.ts";
import { fileProvider } from "@astragenie/memory-provider";
import type { AgentProfile, ProfileCapableProvider } from "../scripts/lib/memory/profile-types.ts";

async function tmpRepo(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}

function warmProfile(agent: string): AgentProfile {
  return {
    agent,
    counts: {},
    total: 1,
    first_seen: 1,
    last_active: 2,
    corrections: [
      {
        id: "c1",
        type: "lesson",
        text: "Do not skip the null check",
        action: "superseded",
        reason: null,
        superseded_by: null,
        superseding_text: null,
        corrected_at: 1
      }
    ],
    recent_decisions: [],
    top_lessons: [
      {
        id: "l1",
        text: "Fail-silent recall is the rule",
        importance: 0.8,
        usefulness: 0.9,
        created_at: 3
      }
    ]
  };
}

function fakeProvider(profile: AgentProfile | null): ProfileCapableProvider {
  return {
    async profile() {
      return profile;
    },
    async feedback() {
      return true;
    }
  };
}

test("parseCreditLoopConfig defaults to disabled, k=5, on absent/malformed config", () => {
  assert.deepEqual(parseCreditLoopConfig(undefined), { enabled: false, k: 5 });
  assert.deepEqual(parseCreditLoopConfig({ feedback: { creditLoop: "nonsense" } }), {
    enabled: false,
    k: 5
  });
  // A bare top-level `creditLoop` (not nested under `feedback`) is ignored,
  // not honored — proves the nesting requirement is load-bearing, not
  // incidental.
  assert.deepEqual(parseCreditLoopConfig({ creditLoop: { enabled: true } }), {
    enabled: false,
    k: 5
  });
});

test("parseCreditLoopConfig hard-caps k at 5 even when a larger value is configured", () => {
  assert.deepEqual(parseCreditLoopConfig({ feedback: { creditLoop: { enabled: true, k: 100 } } }), {
    enabled: true,
    k: 5
  });
});

test("buildHandoffDigest is byte-identical to buildProfileBlock when creditLoop.enabled is false (default)", async () => {
  const repo = await tmpRepo("digest-off-");
  try {
    const rawConfig = { profile: { enabled: true } };
    const provider = fakeProvider(warmProfile("crew:reviewer"));

    const direct = await buildProfileBlock({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig,
      provider
    });
    const digest = await buildHandoffDigest({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig,
      provider
    });

    assert.equal(digest.block, direct.block);
    assert.deepEqual(digest.ids.sort(), direct.injectedIds.sort());
    assert.doesNotMatch(digest.block, /Recall \(memory credit loop\)/);
  } finally {
    await cleanup(repo);
  }
});

test("buildHandoffDigest appends an id-carrying recall block when creditLoop.enabled is true", async () => {
  const repo = await tmpRepo("digest-on-");
  try {
    await fileProvider(repo).capture({
      kind: "lesson",
      severity: "medium",
      summary: "credit-loop recall hit",
      source: "test"
    });
    const rawConfig = { provider: "file", feedback: { creditLoop: { enabled: true } } };

    const digest = await buildHandoffDigest({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig
    });

    assert.match(digest.block, /## Recall \(memory credit loop\)/);
    assert.match(digest.block, /credit-loop recall hit/);
    assert.match(digest.block, /<!--atom:[^>]+-->/);
    assert.ok(digest.ids.length > 0, "recall hit id must be surfaced in ids");
  } finally {
    await cleanup(repo);
  }
});

test("buildHandoffDigest hard-caps recall hits at 5 even when more entries match", async () => {
  const repo = await tmpRepo("digest-cap-");
  try {
    const provider = fileProvider(repo);
    for (let i = 0; i < 8; i += 1) {
      await provider.capture({ kind: "lesson", severity: "low", summary: `hit-${i}`, source: "t" });
    }
    const rawConfig = {
      provider: "file",
      recall: { k: 8, maxTokens: 4000 },
      feedback: { creditLoop: { enabled: true, k: 8 } }
    };

    const digest = await buildHandoffDigest({ repoPath: repo, agent: "crew:reviewer", rawConfig });
    const recallLines = digest.block
      .split("\n")
      .filter((l) => l.startsWith("- **[") && l.includes("hit-"));
    assert.ok(recallLines.length <= 5, `expected <=5 recall lines, got ${recallLines.length}`);
  } finally {
    await cleanup(repo);
  }
});

test("global memory.enabled:'never' wins over profile.enabled + creditLoop.enabled (kill-switch)", async () => {
  const repo = await tmpRepo("digest-killswitch-");
  try {
    await fileProvider(repo).capture({
      kind: "lesson",
      severity: "high",
      summary: "must never be recalled",
      source: "test"
    });
    const rawConfig = {
      enabled: "never",
      provider: "file",
      profile: { enabled: true },
      feedback: { creditLoop: { enabled: true } }
    };

    // No provider override here: exercise the real resolveProvider() gate
    // (noopProvider lacks profile()/feedback ()), not a test double.
    const digest = await buildHandoffDigest({ repoPath: repo, agent: "crew:reviewer", rawConfig });
    assert.equal(digest.block, "");
    assert.deepEqual(digest.ids, []);
  } finally {
    await cleanup(repo);
  }
});

test("buildHandoffDigest is fail-silent when recall fails to parse — profile half is unaffected", async () => {
  const repo = await tmpRepo("digest-recall-throw-");
  try {
    const rawConfig = {
      // An unknown provider value is a hard Zod error inside parseMemoryConfig
      // (see memory-inject-recall.test.ts's identical guard case) —
      // recallEntries swallows it internally and returns [], and the profile
      // half (explicit provider override, bypassing resolveProvider
      // entirely) must still render regardless.
      provider: "not-a-real-provider",
      profile: { enabled: true },
      feedback: { creditLoop: { enabled: true } }
    };
    const provider = fakeProvider(warmProfile("crew:reviewer"));

    const digest = await buildHandoffDigest({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig,
      provider
    });

    assert.match(digest.block, /## Your track record \(crew:reviewer\)/);
    assert.doesNotMatch(digest.block, /Recall \(memory credit loop\)/);
  } finally {
    await cleanup(repo);
  }
});
