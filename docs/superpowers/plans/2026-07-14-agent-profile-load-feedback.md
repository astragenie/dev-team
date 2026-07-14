# Agent-Profile Load + Feedback Loop — Implementation Plan (dev-team)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At agent dispatch, inject the agent's astramem agent-profile (corrections + decisions + lessons) into its prompt, and feed usefulness back on gate PASS — so fleet agents stop repeating mistakes and reuse working patterns.

**Architecture:** Mirror the existing FEAT-188 recall-injection seam. A new `inject-profile.ts` (sibling of `inject-recall.ts`) resolves the configured MemoryProvider, calls a new `profile(agent)` method, and formats a `## Your track record (<agent>)` block appended alongside the existing `## Prior context (from astramem)` block at the same four dispatch sites. A per-run sidecar records which atom ids were injected; a post-dispatch feedback step calls the provider's `feedback(id,{used:true})` for those atoms on gate PASS. Everything is fail-silent and byte-identical to today when disabled.

**Tech Stack:** TypeScript (Node strip-types runtime, per ADR-002 CLI scripts run on Node), `node:test` + `node:assert/strict`, Bun test runner in CI, `@astragenie/memory-provider` provider seam.

## Global Constraints

- CLI/validator scripts run on **Node** (ADR-002); tests run under **Bun** (`bun test --timeout 60000 tests/`, no `--parallel`).
- **Fail-silent everywhere.** No path in profile injection or feedback may throw, block, or alter dispatch beyond omitting its block. Byte-identical dispatch output is the highest-risk regression property — guard it with a test in every task that touches the block.
- **`profile.enabled` and `feedback.enabled` default `false`.** The feature is invisible until explicitly enabled in `.claude/loop.json`'s `memory` block.
- **Feedback is single-id and positive-only.** Call `feedback(id,{used:true})` only for atoms actually credited; never fire for non-used atoms (the daemon has no negative path).
- **Block ordering is corrections → recent_decisions → top_lessons.** Corrections lead because they are deterministic (populated by invalidate/supersede events) and useful on day one independent of the usefulness signal.
- **Shared token budget.** The profile block's cap is a sub-allocation inside the existing recall budget (~800 tokens total across both blocks), not an additive second cap. Default `profile.maxTokens: 400`.
- **Lint stays zero-warning** (Biome). No `process.exit(N)` from library functions.
- **Upstream contract (built in plugins-common's own session, in parallel):** the resolved provider gains two optional methods —
  `profile(agent: string): Promise<AgentProfile | null>` and
  `feedback(atomId: string, opts: { used: boolean }): Promise<boolean>`.
  dev-team code treats both as **optional** (duck-typed) so it builds and no-ops cleanly before the package ships them. See Task 0.

---

## Task 0: Upstream contract (dependency — NOT implemented in this plan)

**Not a dev-team code task.** Recorded here so every task below has the exact signatures it depends on. Implemented in `plugins-common` (`@astragenie/memory-provider`) in that repo's own session/worktree, published, then consumed here. runner-plugin gets a sibling plan mirroring Tasks 1–6.

The `MemoryProvider` interface gains:

```ts
export interface AgentProfileLesson { id: string; text: string; importance: number; usefulness: number; created_at: number; }
export interface AgentProfileDecision { id: string; text: string; importance: number; created_at: number; }
export interface AgentProfileCorrection {
  id: string; type: string; text: string;
  action: "invalidated" | "superseded";
  reason: string | null; superseded_by: string | null; superseding_text: string | null;
  corrected_at: number;
}
export interface AgentProfile {
  agent: string;
  counts: Record<string, number>;
  total: number;
  first_seen: number | null;
  last_active: number | null;
  top_lessons: AgentProfileLesson[];
  recent_decisions: AgentProfileDecision[];
  corrections: AgentProfileCorrection[];
}

// Added to MemoryProvider — both fail-silent (null / false on any error or cap breach):
profile?(agent: string): Promise<AgentProfile | null>;   // GET /agents/:agent/profile
feedback?(atomId: string, opts: { used: boolean }): Promise<boolean>; // POST /memory/:id/used (fires only when used === true)
```

dev-team defines an identical **local** copy of these types in Task 1 (so it builds before the package ships them) and duck-types the resolved provider against them.

---

## Task 1: Profile types + pure formatter

**Files:**
- Create: `scripts/lib/memory/profile-types.ts`
- Create: `scripts/lib/memory/inject-profile.ts` (formatter only in this task)
- Test: `tests/memory-inject-profile.test.ts`

**Interfaces:**
- Produces: `AgentProfile`, `AgentProfileLesson`, `AgentProfileDecision`, `AgentProfileCorrection` (types); `formatProfileBlock(profile: AgentProfile, opts: { agent: string; maxChars: number; usefulnessWarm: boolean }): string`; internal `atomMarker(id: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/memory-inject-profile.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatProfileBlock } from "../scripts/lib/memory/inject-profile.ts";
import type { AgentProfile } from "../scripts/lib/memory/profile-types.ts";

function emptyProfile(agent: string): AgentProfile {
  return { agent, counts: {}, total: 0, first_seen: null, last_active: null,
    top_lessons: [], recent_decisions: [], corrections: [] };
}

test("formatProfileBlock returns '' when profile has no lessons/decisions/corrections", () => {
  assert.equal(formatProfileBlock(emptyProfile("crew:reviewer"), { agent: "crew:reviewer", maxChars: 1600, usefulnessWarm: true }), "");
});

test("formatProfileBlock orders corrections, then decisions, then lessons; each line carries an atom marker", () => {
  const p = emptyProfile("crew:reviewer");
  p.corrections = [{ id: "c1", type: "lesson", text: "Missed a null check", action: "superseded", reason: null, superseded_by: null, superseding_text: null, corrected_at: 1 }];
  p.recent_decisions = [{ id: "d1", text: "Use single-id feedback", importance: 0.7, created_at: 2 }];
  p.top_lessons = [{ id: "l1", text: "Prefer fail-silent recall", importance: 0.8, usefulness: 0.9, created_at: 3 }];
  const out = formatProfileBlock(p, { agent: "crew:reviewer", maxChars: 1600, usefulnessWarm: true });
  assert.match(out, /^## Your track record \(crew:reviewer\)/);
  const iC = out.indexOf("Missed a null check"), iD = out.indexOf("Use single-id feedback"), iL = out.indexOf("Prefer fail-silent recall");
  assert.ok(iC < iD && iD < iL, "corrections < decisions < lessons");
  assert.match(out, /<!--atom:c1-->/);
  assert.match(out, /<!--atom:l1-->/);
});

test("formatProfileBlock labels lessons 'importance-ranked' when usefulness signal is cold", () => {
  const p = emptyProfile("crew:reviewer");
  p.top_lessons = [{ id: "l1", text: "x".repeat(20), importance: 0.8, usefulness: 0.5, created_at: 3 }];
  const warm = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: true });
  const cold = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: false });
  assert.match(cold, /importance-ranked/i);
  assert.doesNotMatch(warm, /importance-ranked/i);
});

test("formatProfileBlock truncates to maxChars deterministically (keeps corrections first)", () => {
  const p = emptyProfile("a");
  p.corrections = [{ id: "c1", type: "lesson", text: "KEEP-CORRECTION", action: "invalidated", reason: null, superseded_by: null, superseding_text: null, corrected_at: 1 }];
  p.top_lessons = Array.from({ length: 10 }, (_, i) => ({ id: `l${i}`, text: `DROP-LESSON-${i}-${"y".repeat(60)}`, importance: 0.5, usefulness: 0.5, created_at: i }));
  const out = formatProfileBlock(p, { agent: "a", maxChars: 120, usefulnessWarm: false });
  assert.ok(out.length <= 120, `len ${out.length}`);
  assert.match(out, /KEEP-CORRECTION/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: FAIL — `formatProfileBlock` / `profile-types.ts` not found.

- [ ] **Step 3: Write the types**

```ts
// scripts/lib/memory/profile-types.ts — local mirror of the @astragenie/memory-provider
// AgentProfile contract (Task 0). Kept local so dev-team builds before the package
// ships profile()/feedback(); swap the import once the package exports these.
export interface AgentProfileLesson { id: string; text: string; importance: number; usefulness: number; created_at: number; }
export interface AgentProfileDecision { id: string; text: string; importance: number; created_at: number; }
export interface AgentProfileCorrection {
  id: string; type: string; text: string;
  action: "invalidated" | "superseded";
  reason: string | null; superseded_by: string | null; superseding_text: string | null;
  corrected_at: number;
}
export interface AgentProfile {
  agent: string;
  counts: Record<string, number>;
  total: number;
  first_seen: number | null;
  last_active: number | null;
  top_lessons: AgentProfileLesson[];
  recent_decisions: AgentProfileDecision[];
  corrections: AgentProfileCorrection[];
}

/** Duck-typed view of the resolved provider's OPTIONAL profile/feedback methods
 *  (Task 0 upstream contract). Both may be absent until the package ships them. */
export interface ProfileCapableProvider {
  profile?(agent: string): Promise<AgentProfile | null>;
  feedback?(atomId: string, opts: { used: boolean }): Promise<boolean>;
}
```

- [ ] **Step 4: Write the formatter**

```ts
// scripts/lib/memory/inject-profile.ts — FEAT (agent-profile load). Sibling of
// inject-recall.ts. Formats the agent's astramem profile into a
// `## Your track record (<agent>)` block. Corrections lead (deterministic,
// day-one value), then recent decisions, then top lessons. Each line carries
// its atom id in an HTML-comment marker so the feedback step can attribute use.
// Fail-silent + byte-identical-when-disabled is enforced in buildProfileBlock
// (Task 3); this module is a pure formatter.
import type { AgentProfile } from "./profile-types.ts";

/** Trailing marker carrying an atom id — invisible in rendered Markdown,
 *  machine-readable by the feedback step (Task 5). */
export function atomMarker(id: string): string {
  return ` <!--atom:${id}-->`;
}

export interface FormatProfileOptions {
  agent: string;
  /** Hard character budget (shared sub-allocation, ~4 chars/token). */
  maxChars: number;
  /** True once enough atoms carry a real usefulness signal; false => lessons
   *  are labelled importance-ranked to avoid implying a dead ranking is meaningful. */
  usefulnessWarm: boolean;
}

export function formatProfileBlock(profile: AgentProfile, opts: FormatProfileOptions): string {
  const lines: string[] = [];
  for (const c of profile.corrections) {
    lines.push(`- **[correction ${c.action}]** ${c.text}${atomMarker(c.id)}`);
  }
  for (const d of profile.recent_decisions) {
    lines.push(`- **[decision]** ${d.text}${atomMarker(d.id)}`);
  }
  const lessonLabel = opts.usefulnessWarm ? "lesson" : "lesson · importance-ranked";
  for (const l of profile.top_lessons) {
    lines.push(`- **[${lessonLabel}]** ${l.text}${atomMarker(l.id)}`);
  }
  if (lines.length === 0) return "";

  const header = `## Your track record (${opts.agent})`;
  let block = `${header}\n${lines.join("\n")}`;
  if (block.length > opts.maxChars) {
    // Deterministic truncation: keep the header + as many leading lines
    // (corrections first) as fit. Never split a line.
    const kept: string[] = [];
    let used = header.length;
    for (const line of lines) {
      if (used + 1 + line.length > opts.maxChars) break;
      kept.push(line);
      used += 1 + line.length;
    }
    block = kept.length === 0 ? header.slice(0, opts.maxChars) : `${header}\n${kept.join("\n")}`;
  }
  return block;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/memory/profile-types.ts scripts/lib/memory/inject-profile.ts tests/memory-inject-profile.test.ts
git commit -m "feat(memory): profile types + pure profile-block formatter"
```

---

## Task 2: Config parsing + enable gate

**Files:**
- Modify: `scripts/lib/memory/inject-profile.ts`
- Test: `tests/memory-inject-profile.test.ts` (append)

**Interfaces:**
- Consumes: `loadMemoryConfig(repoPath)` from `./inject-recall.ts` (already returns the raw `memory` object or `undefined`).
- Produces: `interface ProfileConfig { enabled: boolean; topLessons: number; maxTokens: number; minFeedbackSample: number; }` and `parseProfileConfig(rawMemory: unknown): ProfileConfig`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/memory-inject-profile.test.ts
import { parseProfileConfig } from "../scripts/lib/memory/inject-profile.ts";

test("parseProfileConfig defaults to disabled with safe values when memory/profile absent", () => {
  const c = parseProfileConfig(undefined);
  assert.equal(c.enabled, false);
  assert.equal(c.topLessons, 10);
  assert.equal(c.maxTokens, 400);
  assert.equal(c.minFeedbackSample, 5);
});

test("parseProfileConfig reads memory.profile overrides and coerces types", () => {
  const c = parseProfileConfig({ profile: { enabled: true, topLessons: 3, maxTokens: 200, minFeedbackSample: 2 } });
  assert.deepEqual(c, { enabled: true, topLessons: 3, maxTokens: 200, minFeedbackSample: 2 });
});

test("parseProfileConfig treats malformed profile block as disabled defaults (never throws)", () => {
  const c = parseProfileConfig({ profile: "nonsense" });
  assert.equal(c.enabled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: FAIL — `parseProfileConfig` not exported.

- [ ] **Step 3: Implement `parseProfileConfig`**

```ts
// add to scripts/lib/memory/inject-profile.ts
export interface ProfileConfig {
  enabled: boolean;
  topLessons: number;
  maxTokens: number;
  minFeedbackSample: number;
}

const PROFILE_DEFAULTS: ProfileConfig = { enabled: false, topLessons: 10, maxTokens: 400, minFeedbackSample: 5 };

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function parseProfileConfig(rawMemory: unknown): ProfileConfig {
  if (typeof rawMemory !== "object" || rawMemory === null) return { ...PROFILE_DEFAULTS };
  const p = (rawMemory as Record<string, unknown>).profile;
  if (typeof p !== "object" || p === null) return { ...PROFILE_DEFAULTS };
  const o = p as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    topLessons: num(o.topLessons, PROFILE_DEFAULTS.topLessons),
    maxTokens: num(o.maxTokens, PROFILE_DEFAULTS.maxTokens),
    minFeedbackSample: num(o.minFeedbackSample, PROFILE_DEFAULTS.minFeedbackSample)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/memory/inject-profile.ts tests/memory-inject-profile.test.ts
git commit -m "feat(memory): profile config parsing with disabled-by-default gate"
```

---

## Task 3: `buildProfileBlock` — resolve provider, gate, warm-up, fail-silent

**Files:**
- Modify: `scripts/lib/memory/inject-profile.ts`
- Test: `tests/memory-inject-profile.test.ts` (append)

**Interfaces:**
- Consumes: `resolveProvider(rawConfig, repoPath)` from `@astragenie/memory-provider`; `loadMemoryConfig` from `./inject-recall.ts`; `ProfileCapableProvider`, `AgentProfile` from `./profile-types.ts`; `parseProfileConfig`, `formatProfileBlock`.
- Produces: `interface BuildProfileOptions { repoPath: string; agent: string; rawConfig?: unknown; provider?: ProfileCapableProvider; }` and `buildProfileBlock(opts): Promise<{ block: string; injectedIds: string[] }>`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/memory-inject-profile.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildProfileBlock } from "../scripts/lib/memory/inject-profile.ts";
import type { ProfileCapableProvider, AgentProfile } from "../scripts/lib/memory/profile-types.ts";

async function tmpRepo(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }

function fakeProvider(profile: AgentProfile | null): ProfileCapableProvider {
  return { async profile() { return profile; }, async feedback() { return true; } };
}
function warmProfile(agent: string): AgentProfile {
  return { agent, counts: {}, total: 1, first_seen: 1, last_active: 2,
    corrections: [{ id: "c1", type: "lesson", text: "Do not skip the null check", action: "superseded", reason: null, superseded_by: null, superseding_text: null, corrected_at: 1 }],
    recent_decisions: [], top_lessons: [{ id: "l1", text: "Fail-silent recall is the rule", importance: 0.8, usefulness: 0.9, created_at: 3 }] };
}

test("buildProfileBlock returns empty block + [] when profile.enabled is false (default)", async () => {
  const repo = await tmpRepo("profile-off-");
  try {
    const r = await buildProfileBlock({ repoPath: repo, agent: "crew:reviewer", rawConfig: {}, provider: fakeProvider(warmProfile("crew:reviewer")) });
    assert.equal(r.block, "");
    assert.deepEqual(r.injectedIds, []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("buildProfileBlock returns block + injectedIds when enabled and provider yields a profile", async () => {
  const repo = await tmpRepo("profile-on-");
  try {
    const r = await buildProfileBlock({ repoPath: repo, agent: "crew:reviewer",
      rawConfig: { profile: { enabled: true } }, provider: fakeProvider(warmProfile("crew:reviewer")) });
    assert.match(r.block, /## Your track record \(crew:reviewer\)/);
    assert.deepEqual(r.injectedIds.sort(), ["c1", "l1"]);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("buildProfileBlock is fail-silent: provider without profile() method yields empty block", async () => {
  const repo = await tmpRepo("profile-nomethod-");
  try {
    const r = await buildProfileBlock({ repoPath: repo, agent: "a", rawConfig: { profile: { enabled: true } }, provider: {} });
    assert.equal(r.block, "");
    assert.deepEqual(r.injectedIds, []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("buildProfileBlock is fail-silent: a throwing provider yields empty block, never rejects", async () => {
  const repo = await tmpRepo("profile-throw-");
  try {
    const throwing: ProfileCapableProvider = { async profile() { throw new Error("daemon down"); } };
    const r = await buildProfileBlock({ repoPath: repo, agent: "a", rawConfig: { profile: { enabled: true } }, provider: throwing });
    assert.equal(r.block, "");
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("buildProfileBlock labels lessons importance-ranked until minFeedbackSample lessons carry usefulness != 0.5", async () => {
  const repo = await tmpRepo("profile-cold-");
  try {
    const cold = warmProfile("a"); cold.top_lessons = [{ id: "l1", text: "cold lesson text here", importance: 0.8, usefulness: 0.5, created_at: 3 }];
    const r = await buildProfileBlock({ repoPath: repo, agent: "a",
      rawConfig: { profile: { enabled: true, minFeedbackSample: 5 } }, provider: fakeProvider(cold) });
    assert.match(r.block, /importance-ranked/i);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: FAIL — `buildProfileBlock` not exported.

- [ ] **Step 3: Implement `buildProfileBlock`**

```ts
// add to scripts/lib/memory/inject-profile.ts
import { loadMemoryConfig } from "./inject-recall.ts";
import type { AgentProfile, ProfileCapableProvider } from "./profile-types.ts";

export interface BuildProfileOptions {
  repoPath: string;
  agent: string;
  /** Raw `memory` config; when omitted, loaded from <repoPath>/.claude/loop.json. */
  rawConfig?: unknown;
  /** Test seam / explicit provider; when omitted, resolveProvider() is used. */
  provider?: ProfileCapableProvider;
}

/** True once at least `minSample` lessons carry a moved usefulness signal
 *  (!= the Laplace-neutral 0.5). Below that, the ranking is effectively
 *  importance-ordered and must be labelled so. */
function usefulnessIsWarm(profile: AgentProfile, minSample: number): boolean {
  const moved = profile.top_lessons.filter((l) => l.usefulness !== 0.5).length;
  return moved >= minSample;
}

export async function buildProfileBlock(opts: BuildProfileOptions): Promise<{ block: string; injectedIds: string[] }> {
  const empty = { block: "", injectedIds: [] as string[] };
  try {
    const rawConfig = opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    const cfg = parseProfileConfig(rawConfig);
    if (!cfg.enabled) return empty;

    let provider = opts.provider;
    if (!provider) {
      const { resolveProvider } = await import("@astragenie/memory-provider");
      provider = resolveProvider(rawConfig, opts.repoPath) as unknown as ProfileCapableProvider;
    }
    if (typeof provider.profile !== "function") return empty; // package hasn't shipped it yet

    const profile = await provider.profile(opts.agent);
    if (!profile) return empty;

    // Enforce topLessons cap before formatting (daemon already caps at 10; be defensive).
    profile.top_lessons = profile.top_lessons.slice(0, cfg.topLessons);

    const block = formatProfileBlock(profile, {
      agent: opts.agent,
      maxChars: cfg.maxTokens * 4,
      usefulnessWarm: usefulnessIsWarm(profile, cfg.minFeedbackSample)
    });
    if (!block) return empty;

    const injectedIds = [
      ...profile.corrections.map((c) => c.id),
      ...profile.recent_decisions.map((d) => d.id),
      ...profile.top_lessons.map((l) => l.id)
    ];
    return { block, injectedIds };
  } catch {
    return empty; // fail-silent: never block or alter dispatch
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/memory-inject-profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/memory/inject-profile.ts tests/memory-inject-profile.test.ts
git commit -m "feat(memory): buildProfileBlock — gated, warm-up-aware, fail-silent"
```

---

## Task 4: Injected-atoms sidecar

**Files:**
- Create: `scripts/lib/memory/injected-atoms.ts`
- Test: `tests/memory-injected-atoms.test.ts`

**Interfaces:**
- Produces: `writeInjectedAtoms(repoPath: string, runId: string, ids: string[]): Promise<void>` and `readInjectedAtoms(repoPath: string, runId: string): Promise<string[]>`. Storage: `<repoPath>/.claude/state/crew/injected-atoms/<runId>.json` (machine-local/ignored tree — ephemeral per-run bookkeeping, deliberately NOT under committed `.claude/artifacts/`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/memory-injected-atoms.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { writeInjectedAtoms, readInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";

async function tmp(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }

test("round-trips ids under .claude/state/crew/injected-atoms/<runId>.json", async () => {
  const repo = await tmp("inj-atoms-");
  try {
    await writeInjectedAtoms(repo, "run-1", ["a", "b", "c"]);
    const target = path.join(repo, ".claude", "state", "crew", "injected-atoms", "run-1.json");
    assert.ok(await fs.stat(target));
    assert.deepEqual(await readInjectedAtoms(repo, "run-1"), ["a", "b", "c"]);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("readInjectedAtoms returns [] for a missing run (never throws)", async () => {
  const repo = await tmp("inj-atoms-missing-");
  try { assert.deepEqual(await readInjectedAtoms(repo, "nope"), []); }
  finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("writeInjectedAtoms is fire-and-forget: [] writes an empty list, never throws", async () => {
  const repo = await tmp("inj-atoms-empty-");
  try {
    await writeInjectedAtoms(repo, "run-2", []);
    assert.deepEqual(await readInjectedAtoms(repo, "run-2"), []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/memory-injected-atoms.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sidecar**

```ts
// scripts/lib/memory/injected-atoms.ts — per-run record of atom ids injected
// into a dispatch, so the feedback step (Task 5) can attribute usefulness.
// Machine-local/ignored (.claude/state/): ephemeral, not durable history.
// Fire-and-forget: never throws.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function sidecarPath(repoPath: string, runId: string): string {
  const safe = runId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(repoPath, ".claude", "state", "crew", "injected-atoms", `${safe}.json`);
}

export async function writeInjectedAtoms(repoPath: string, runId: string, ids: string[]): Promise<void> {
  try {
    const target = sidecarPath(repoPath, runId);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ runId, ids }), "utf8");
  } catch { /* fire-and-forget */ }
}

export async function readInjectedAtoms(repoPath: string, runId: string): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(sidecarPath(repoPath, runId), "utf8")) as { ids?: unknown };
    return Array.isArray(parsed.ids) ? parsed.ids.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/memory-injected-atoms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/memory/injected-atoms.ts tests/memory-injected-atoms.test.ts
git commit -m "feat(memory): per-run injected-atoms sidecar (state, ignored)"
```

---

## Task 5: Outcome-gated feedback step

**Files:**
- Create: `scripts/lib/memory/profile-feedback.ts`
- Test: `tests/memory-profile-feedback.test.ts`

**Interfaces:**
- Consumes: `readInjectedAtoms` (Task 4); `ProfileCapableProvider` (Task 1); `loadMemoryConfig`, `resolveProvider`.
- Produces: `submitOutcomeFeedback(opts: { repoPath: string; runId: string; outcome: "pass" | "fail"; rawConfig?: unknown; provider?: ProfileCapableProvider }): Promise<{ credited: string[] }>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/memory-profile-feedback.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { submitOutcomeFeedback } from "../scripts/lib/memory/profile-feedback.ts";
import { writeInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";
import type { ProfileCapableProvider } from "../scripts/lib/memory/profile-types.ts";

async function tmp(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }
function recordingProvider(sink: Array<[string, boolean]>): ProfileCapableProvider {
  return { async feedback(id, o) { sink.push([id, o.used]); return true; } };
}

test("credits every injected atom with used:true on PASS", async () => {
  const repo = await tmp("fb-pass-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a", "b"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({ repoPath: repo, runId: "r1", outcome: "pass",
      rawConfig: { feedback: { enabled: true } }, provider: recordingProvider(sink) });
    assert.deepEqual(r.credited.sort(), ["a", "b"]);
    assert.deepEqual(sink.sort(), [["a", true], ["b", true]]);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("credits nothing on FAIL (positive-only signal)", async () => {
  const repo = await tmp("fb-fail-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({ repoPath: repo, runId: "r1", outcome: "fail",
      rawConfig: { feedback: { enabled: true } }, provider: recordingProvider(sink) });
    assert.deepEqual(r.credited, []);
    assert.deepEqual(sink, []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("no-ops when feedback.enabled is false (default)", async () => {
  const repo = await tmp("fb-off-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const sink: Array<[string, boolean]> = [];
    const r = await submitOutcomeFeedback({ repoPath: repo, runId: "r1", outcome: "pass",
      rawConfig: {}, provider: recordingProvider(sink) });
    assert.deepEqual(r.credited, []);
    assert.deepEqual(sink, []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});

test("fail-silent: a throwing feedback() never rejects", async () => {
  const repo = await tmp("fb-throw-");
  try {
    await writeInjectedAtoms(repo, "r1", ["a"]);
    const throwing: ProfileCapableProvider = { async feedback() { throw new Error("down"); } };
    const r = await submitOutcomeFeedback({ repoPath: repo, runId: "r1", outcome: "pass",
      rawConfig: { feedback: { enabled: true } }, provider: throwing });
    assert.deepEqual(r.credited, []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/memory-profile-feedback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the feedback step**

```ts
// scripts/lib/memory/profile-feedback.ts — outcome-gated, positive-only
// usefulness feedback for profile-injected atoms. v1 tracking = outcome
// backstop: on gate PASS, credit every injected atom used:true. Reference-
// detection is a documented phase-2 refinement. Fail-silent throughout.
import { readInjectedAtoms } from "./injected-atoms.ts";
import type { ProfileCapableProvider } from "./profile-types.ts";

export interface SubmitOutcomeFeedbackOptions {
  repoPath: string;
  runId: string;
  outcome: "pass" | "fail";
  rawConfig?: unknown;
  provider?: ProfileCapableProvider;
}

function feedbackEnabled(rawConfig: unknown): boolean {
  if (typeof rawConfig !== "object" || rawConfig === null) return false;
  const f = (rawConfig as Record<string, unknown>).feedback;
  return typeof f === "object" && f !== null && (f as Record<string, unknown>).enabled === true;
}

export async function submitOutcomeFeedback(opts: SubmitOutcomeFeedbackOptions): Promise<{ credited: string[] }> {
  const credited: string[] = [];
  try {
    if (opts.outcome !== "pass") return { credited };

    const { loadMemoryConfig } = await import("./inject-recall.ts");
    const rawConfig = opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    if (!feedbackEnabled(rawConfig)) return { credited };

    let provider = opts.provider;
    if (!provider) {
      const { resolveProvider } = await import("@astragenie/memory-provider");
      provider = resolveProvider(rawConfig, opts.repoPath) as unknown as ProfileCapableProvider;
    }
    if (typeof provider.feedback !== "function") return { credited };

    const ids = await readInjectedAtoms(opts.repoPath, opts.runId);
    for (const id of ids) {
      try {
        const ok = await provider.feedback(id, { used: true });
        if (ok) credited.push(id);
      } catch { /* per-id fail-silent */ }
    }
    return { credited };
  } catch {
    return { credited };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/memory-profile-feedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/memory/profile-feedback.ts tests/memory-profile-feedback.test.ts
git commit -m "feat(memory): outcome-gated positive-only profile feedback step"
```

---

## Task 6: Barrel exports + `crew profile-block` / `crew profile-feedback` CLI

**Files:**
- Modify: `scripts/lib/memory/index.ts:29-35`
- Modify: `scripts/crew.ts:1600` (after the `recall-block` handler)
- Test: `tests/crew-profile-cli.test.ts`

**Interfaces:**
- Consumes: `buildProfileBlock`, `writeInjectedAtoms`, `submitOutcomeFeedback`.
- Produces: CLI `crew profile-block --agent <a> [--run-id <id>]` → `{ block, injectedIds }` (and writes the sidecar when `--run-id` given); CLI `crew profile-feedback --run-id <id> --outcome <pass|fail>` → `{ credited }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/crew-profile-cli.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildProfileBlock } from "../scripts/lib/memory/index.ts";
import { readInjectedAtoms } from "../scripts/lib/memory/injected-atoms.ts";

async function tmp(p: string) { return fs.mkdtemp(path.join(os.tmpdir(), p)); }

test("barrel re-exports buildProfileBlock and injected-atoms/feedback helpers", async () => {
  const mod = await import("../scripts/lib/memory/index.ts");
  assert.equal(typeof mod.buildProfileBlock, "function");
  assert.equal(typeof mod.submitOutcomeFeedback, "function");
  assert.equal(typeof mod.writeInjectedAtoms, "function");
});

test("buildProfileBlock via barrel is byte-silent when disabled (integration guard)", async () => {
  const repo = await tmp("cli-profile-off-");
  try {
    const r = await buildProfileBlock({ repoPath: repo, agent: "crew:reviewer", rawConfig: {} });
    assert.equal(r.block, "");
    assert.deepEqual(await readInjectedAtoms(repo, "any"), []);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/crew-profile-cli.test.ts`
Expected: FAIL — barrel does not export `buildProfileBlock`.

- [ ] **Step 3: Extend the barrel**

```ts
// add to scripts/lib/memory/index.ts (after the inject-recall exports)
export type { AgentProfile, ProfileCapableProvider } from "./profile-types.ts";
export {
  buildProfileBlock,
  formatProfileBlock,
  parseProfileConfig,
  type BuildProfileOptions,
  type ProfileConfig
} from "./inject-profile.ts";
export { writeInjectedAtoms, readInjectedAtoms } from "./injected-atoms.ts";
export { submitOutcomeFeedback } from "./profile-feedback.ts";
```

- [ ] **Step 4: Add the two CLI handlers**

```ts
// add to scripts/crew.ts immediately after the "recall-block" handler (~line 1600)
  // Agent-profile load: returns the `## Your track record (<agent>)` block and,
  // when --run-id is given, records the injected atom ids for later feedback.
  "profile-block": async ({ repoPath, flags }: CommandContext) => {
    const { buildProfileBlock } = await import("./lib/memory/inject-profile.ts");
    const { writeInjectedAtoms } = await import("./lib/memory/injected-atoms.ts");
    const agent = typeof flags.agent === "string" ? flags.agent : "";
    if (!agent) return { block: "", injectedIds: [] };
    const { block, injectedIds } = await buildProfileBlock({ repoPath, agent });
    if (typeof flags["run-id"] === "string" && flags["run-id"]) {
      await writeInjectedAtoms(repoPath, flags["run-id"], injectedIds);
    }
    return { block, injectedIds };
  },

  // Outcome-gated positive-only feedback for a run's profile-injected atoms.
  "profile-feedback": async ({ repoPath, flags }: CommandContext) => {
    const { submitOutcomeFeedback } = await import("./lib/memory/profile-feedback.ts");
    const runId = typeof flags["run-id"] === "string" ? flags["run-id"] : "";
    const outcome = flags.outcome === "pass" ? "pass" : "fail";
    if (!runId) return { credited: [] };
    return submitOutcomeFeedback({ repoPath, runId, outcome });
  },
```

- [ ] **Step 5: Run tests + validators to verify they pass**

Run: `bun test tests/crew-profile-cli.test.ts && node ./scripts/validate-manifests.ts`
Expected: PASS; manifests OK.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/memory/index.ts scripts/crew.ts tests/crew-profile-cli.test.ts
git commit -m "feat(memory): barrel exports + crew profile-block/profile-feedback CLI"
```

---

## Task 7: Wire dispatch sites + feedback trigger + e2e smoke

**Files:**
- Modify: `commands/build.md`, `commands/fix.md`, `commands/ship.md`, `commands/orchestrate-slice.md` (the blocks that already call `crew recall-block`)
- Modify: `scripts/e2e-smoke.ts:329-480` (add a profile scenario mirroring the recall scenarios)
- Test: `scripts/e2e-smoke.ts` (self-checking)

**Interfaces:**
- Consumes: `crew profile-block`, `crew profile-feedback` (Task 6).

- [ ] **Step 1: Add the profile e2e scenario (failing)**

In `scripts/e2e-smoke.ts`, mirror `scenarioRecallInjectionAc2`: build a temp repo with `memory.profile.enabled:true` and a `file`-provider fixture exposing a `profile()` stub, assert the block header appears and the sidecar is written; and a disabled repo asserting byte-identical dispatch. Add a `scenarioProfileInjection(buildProfileBlock, dispatchBaseline)` and call it from the smoke `main()`.

```ts
// scripts/e2e-smoke.ts — add near the recall scenarios
async function scenarioProfileInjectionDisabled(
  buildProfileBlock: typeof import("./lib/memory/inject-profile.ts").buildProfileBlock,
  dispatchBaseline: string
) {
  const repo = await makeTempRepo("e2e-profile-off-");
  try {
    const { block } = await buildProfileBlock({ repoPath: repo, agent: "crew:reviewer", rawConfig: {} });
    assert.equal(block, "", "profile block must be empty when disabled");
    assert.equal(`${dispatchBaseline}`, dispatchBaseline);
  } finally { await fs.rm(repo, { recursive: true, force: true }); }
}
```

- [ ] **Step 2: Run smoke to verify the new scenario fails**

Run: `node ./scripts/e2e-smoke.ts`
Expected: FAIL until the scenario is wired into `main()`.

- [ ] **Step 3: Wire the scenario into `main()` and the four command md files**

In each of `commands/build.md`, `commands/fix.md`, `commands/ship.md`, `commands/orchestrate-slice.md`, immediately after the existing `crew recall-block` call, add the parallel profile call, appending its `block` to the same dispatch text and passing `--run-id <currentRunId>`:

```md
Then fetch the agent's track record and append it too (best-effort, empty when disabled):

    crew profile-block --agent <agent> --run-id <currentRunId>

Append the returned `block` to the dispatch text after the recall block. After the
review/validation gate resolves, record usefulness:

    crew profile-feedback --run-id <currentRunId> --outcome <pass|fail>
```

- [ ] **Step 4: Run the full smoke + validators + lint**

Run: `node ./scripts/e2e-smoke.ts && node ./scripts/validate-manifests.ts && bun run lint`
Expected: PASS; zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add commands/build.md commands/fix.md commands/ship.md commands/orchestrate-slice.md scripts/e2e-smoke.ts
git commit -m "feat(memory): wire profile-block/feedback into the 4 dispatch sites + e2e"
```

---

## Task 8: Full-suite verification

- [ ] **Step 1: Run the full gate**

Run: `bun run test && bun run lint && bun run format:check && bun run typecheck`
Expected: all PASS, zero lint warnings.

- [ ] **Step 2: Confirm disabled-by-default regression property end-to-end**

Run: `node ./scripts/e2e-smoke.ts`
Expected: PASS — with no `memory.profile` config, dispatch output is byte-identical to pre-feature.

- [ ] **Step 3: Update CHANGELOG + config docs**

Add a CHANGELOG entry under a new dated section and document the new `memory.profile.*` / `memory.feedback.*` keys wherever the `memory` block is documented (search: `recall.enabled` in docs).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/
git commit -m "docs(memory): document memory.profile/feedback config + changelog"
```

---

## Follow-on plans (separate, own sessions)

- **plugins-common** (`@astragenie/memory-provider`): implement Task 0's `profile()` + `feedback()` on the astramem provider (via the existing `resolveAstramemRemote()` seam — `GET /agents/:agent/profile`, `POST /memory/:id/used`), export the `AgentProfile` types, publish + version bump. dev-team then swaps its local `profile-types.ts` import for the package export.
- **runner-plugin**: mirror Tasks 1–7 in `src/scripts/lib/` (the `memory-context.mts` dispatch surface), reusing the same block header, sidecar convention, and config keys.
- **Packaging blocker (#185/#194/#220):** `@astragenie/*` must resolve from the plugin cache before this runs end-to-end. Tracked separately; Tasks 1–6 build and test against the local interface + injected fake providers without it.

## Self-review notes

- **Spec coverage:** provider seam (Task 0), agent-global profile block + corrections-first (Tasks 1/3), warm-up gate (Tasks 1/3), disabled-by-default (Task 2), fail-silent/byte-identical (every task), sidecar (Task 4), outcome-gated positive-only feedback (Task 5), shared token budget (Task 1/3 `maxTokens*4`), CLI + dispatch wiring (Tasks 6/7), external-deps documented (Follow-on). Reference-detection correctly deferred (spec §Feedback, Task 5 comment).
- **Types consistent:** `AgentProfile`/`ProfileCapableProvider` defined once (Task 1), consumed unchanged in Tasks 3/5/6. `buildProfileBlock` returns `{block, injectedIds}` in Tasks 3/6/7. `submitOutcomeFeedback` signature identical in Tasks 5/6.
- **No placeholders:** every code step carries complete code; every run step names the exact command + expected result.
