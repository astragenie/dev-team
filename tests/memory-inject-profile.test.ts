import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatProfileBlock,
  parseProfileConfig,
  buildProfileBlock
} from "../scripts/lib/memory/inject-profile.ts";
import type { AgentProfile, ProfileCapableProvider } from "../scripts/lib/memory/profile-types.ts";

function emptyProfile(agent: string): AgentProfile {
  return {
    agent,
    counts: {},
    total: 0,
    first_seen: null,
    last_active: null,
    top_lessons: [],
    recent_decisions: [],
    corrections: []
  };
}

test("formatProfileBlock returns '' when profile has no lessons/decisions/corrections", () => {
  assert.equal(
    formatProfileBlock(emptyProfile("crew:reviewer"), {
      agent: "crew:reviewer",
      maxChars: 1600,
      usefulnessWarm: true
    }),
    ""
  );
});

test("formatProfileBlock orders corrections, then decisions, then lessons; each line carries an atom marker", () => {
  const p = emptyProfile("crew:reviewer");
  p.corrections = [
    {
      id: "c1",
      type: "lesson",
      text: "Missed a null check",
      action: "superseded",
      reason: null,
      superseded_by: null,
      superseding_text: null,
      corrected_at: 1
    }
  ];
  p.recent_decisions = [
    { id: "d1", text: "Use single-id feedback", importance: 0.7, created_at: 2 }
  ];
  p.top_lessons = [
    { id: "l1", text: "Prefer fail-silent recall", importance: 0.8, usefulness: 0.9, created_at: 3 }
  ];
  const out = formatProfileBlock(p, {
    agent: "crew:reviewer",
    maxChars: 1600,
    usefulnessWarm: true
  });
  assert.match(out, /^## Your track record \(crew:reviewer\)/);
  const iC = out.indexOf("Missed a null check"),
    iD = out.indexOf("Use single-id feedback"),
    iL = out.indexOf("Prefer fail-silent recall");
  assert.ok(iC < iD && iD < iL, "corrections < decisions < lessons");
  assert.match(out, /<!--atom:c1-->/);
  assert.match(out, /<!--atom:l1-->/);
});

test("formatProfileBlock labels lessons 'importance-ranked' when usefulness signal is cold", () => {
  const p = emptyProfile("crew:reviewer");
  p.top_lessons = [
    { id: "l1", text: "x".repeat(20), importance: 0.8, usefulness: 0.5, created_at: 3 }
  ];
  const warm = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: true });
  const cold = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: false });
  assert.match(cold, /importance-ranked/i);
  assert.doesNotMatch(warm, /importance-ranked/i);
});

test("formatProfileBlock truncates to maxChars deterministically (keeps corrections first)", () => {
  const p = emptyProfile("a");
  p.corrections = [
    {
      id: "c1",
      type: "lesson",
      text: "KEEP-CORRECTION",
      action: "invalidated",
      reason: null,
      superseded_by: null,
      superseding_text: null,
      corrected_at: 1
    }
  ];
  p.top_lessons = Array.from({ length: 10 }, (_, i) => ({
    id: `l${i}`,
    text: `DROP-LESSON-${i}-${"y".repeat(60)}`,
    importance: 0.5,
    usefulness: 0.5,
    created_at: i
  }));
  const out = formatProfileBlock(p, { agent: "a", maxChars: 120, usefulnessWarm: false });
  assert.ok(out.length <= 120, `len ${out.length}`);
  assert.match(out, /KEEP-CORRECTION/);
});

test("parseProfileConfig defaults to disabled with safe values when memory/profile absent", () => {
  const c = parseProfileConfig(undefined);
  assert.equal(c.enabled, false);
  assert.equal(c.topLessons, 10);
  assert.equal(c.maxTokens, 400);
  assert.equal(c.minFeedbackSample, 5);
});

test("parseProfileConfig reads memory.profile overrides and coerces types", () => {
  const c = parseProfileConfig({
    profile: { enabled: true, topLessons: 3, maxTokens: 200, minFeedbackSample: 2 }
  });
  assert.deepEqual(c, { enabled: true, topLessons: 3, maxTokens: 200, minFeedbackSample: 2 });
});

test("parseProfileConfig treats malformed profile block as disabled defaults (never throws)", () => {
  const c = parseProfileConfig({ profile: "nonsense" });
  assert.equal(c.enabled, false);
});

async function tmpRepo(p: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), p));
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

test("buildProfileBlock returns empty block + [] when profile.enabled is false (default)", async () => {
  const repo = await tmpRepo("profile-off-");
  try {
    const r = await buildProfileBlock({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig: {},
      provider: fakeProvider(warmProfile("crew:reviewer"))
    });
    assert.equal(r.block, "");
    assert.deepEqual(r.injectedIds, []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("buildProfileBlock returns block + injectedIds when enabled and provider yields a profile", async () => {
  const repo = await tmpRepo("profile-on-");
  try {
    const r = await buildProfileBlock({
      repoPath: repo,
      agent: "crew:reviewer",
      rawConfig: { profile: { enabled: true } },
      provider: fakeProvider(warmProfile("crew:reviewer"))
    });
    assert.match(r.block, /## Your track record \(crew:reviewer\)/);
    assert.deepEqual(r.injectedIds.sort(), ["c1", "l1"]);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("buildProfileBlock is fail-silent: provider without profile() method yields empty block", async () => {
  const repo = await tmpRepo("profile-nomethod-");
  try {
    const r = await buildProfileBlock({
      repoPath: repo,
      agent: "a",
      rawConfig: { profile: { enabled: true } },
      provider: {}
    });
    assert.equal(r.block, "");
    assert.deepEqual(r.injectedIds, []);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("buildProfileBlock is fail-silent: a throwing provider yields empty block, never rejects", async () => {
  const repo = await tmpRepo("profile-throw-");
  try {
    const throwing: ProfileCapableProvider = {
      async profile() {
        throw new Error("daemon down");
      }
    };
    const r = await buildProfileBlock({
      repoPath: repo,
      agent: "a",
      rawConfig: { profile: { enabled: true } },
      provider: throwing
    });
    assert.equal(r.block, "");
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});

test("buildProfileBlock labels lessons importance-ranked until minFeedbackSample lessons carry usefulness != 0.5", async () => {
  const repo = await tmpRepo("profile-cold-");
  try {
    const cold = warmProfile("a");
    cold.top_lessons = [
      { id: "l1", text: "cold lesson text here", importance: 0.8, usefulness: 0.5, created_at: 3 }
    ];
    const r = await buildProfileBlock({
      repoPath: repo,
      agent: "a",
      rawConfig: { profile: { enabled: true, minFeedbackSample: 5 } },
      provider: fakeProvider(cold)
    });
    assert.match(r.block, /importance-ranked/i);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
