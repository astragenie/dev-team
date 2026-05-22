import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectFleetWorktrees, renderFleet, buildFleetReport } from "../scripts/lib/fleet.mjs";

async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeSliceProgress(dir, content) {
  const stateDir = path.join(dir, ".claude", "state", "crew");
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, "slice-progress.md"), content);
}

const PROGRESS_IDLE = `# Slice Progress

Updated: 2026-05-22T10:00:00.000Z

Active plan: \`docs/superpowers/plans/plan.md\` (source: superpowers)
Progress: 3/3 completed

## Slices

- SLICE-01 — First — **COMPLETED** — \`docs/ai-loop/04-implementation-slices/SLICE_01.md\`
- SLICE-02 — Second — **COMPLETED** — \`docs/ai-loop/04-implementation-slices/SLICE_02.md\`
- SLICE-03 — Third — **COMPLETED** — \`docs/ai-loop/04-implementation-slices/SLICE_03.md\`
`;

const PROGRESS_IN_FLIGHT = `# Slice Progress

Updated: 2026-05-22T11:00:00.000Z

Active plan: \`docs/superpowers/plans/plan.md\` (source: superpowers)
Progress: 1/3 completed

## Slices

- SLICE-01 — First — **COMPLETED** — \`docs/ai-loop/04-implementation-slices/SLICE_01.md\`
- SLICE-02 — Second — **IN_PROGRESS** — \`docs/ai-loop/04-implementation-slices/SLICE_02.md\`
- SLICE-03 — Third — **PENDING (file present)** — \`docs/ai-loop/04-implementation-slices/SLICE_03.md\`
`;

test("collectFleetWorktrees finds sibling repos", async () => {
  const root = await makeTempDir("fleet-siblings-");
  const repoA = path.join(root, "repo-a");
  const repoB = path.join(root, "repo-b");
  const repoC = path.join(root, "repo-c");
  await fs.mkdir(repoA, { recursive: true });
  await fs.mkdir(repoB, { recursive: true });
  await fs.mkdir(repoC, { recursive: true });

  await writeSliceProgress(repoA, PROGRESS_IDLE);
  await writeSliceProgress(repoB, PROGRESS_IN_FLIGHT);
  // repoC has no slice-progress.md

  const items = await collectFleetWorktrees(repoA, { includeSelf: true });
  const names = items.map((i) => i.repoName).sort();
  assert.deepEqual(names, ["repo-a", "repo-b"]);
});

test("collectFleetWorktrees excludes self when --no-self", async () => {
  const root = await makeTempDir("fleet-noself-");
  const repoA = path.join(root, "repo-a");
  const repoB = path.join(root, "repo-b");
  await fs.mkdir(repoA, { recursive: true });
  await fs.mkdir(repoB, { recursive: true });
  await writeSliceProgress(repoA, PROGRESS_IDLE);
  await writeSliceProgress(repoB, PROGRESS_IN_FLIGHT);

  const items = await collectFleetWorktrees(repoA, { includeSelf: false });
  assert.equal(items.length, 1);
  assert.equal(items[0].repoName, "repo-b");
  assert.equal(items[0].isSelf, false);
});

test("collectFleetWorktrees parses IN_PROGRESS slice", async () => {
  const root = await makeTempDir("fleet-parse-");
  const repoA = path.join(root, "repo-a");
  await fs.mkdir(repoA, { recursive: true });
  await writeSliceProgress(repoA, PROGRESS_IN_FLIGHT);

  const items = await collectFleetWorktrees(repoA, { includeSelf: true });
  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.inProgressSlice, "SLICE-02");
  assert.equal(item.inProgressTitle, "Second");
  assert.equal(item.completedCount, 1);
  assert.equal(item.totalCount, 3);
});

test("collectFleetWorktrees marks self correctly", async () => {
  const root = await makeTempDir("fleet-self-");
  const repoA = path.join(root, "repo-a");
  const repoB = path.join(root, "repo-b");
  await fs.mkdir(repoA, { recursive: true });
  await fs.mkdir(repoB, { recursive: true });
  await writeSliceProgress(repoA, PROGRESS_IDLE);
  await writeSliceProgress(repoB, PROGRESS_IN_FLIGHT);

  const items = await collectFleetWorktrees(repoA, { includeSelf: true });
  const self = items.find((i) => i.isSelf);
  assert.ok(self, "one item should be marked isSelf");
  assert.equal(self.repoName, "repo-a");
  const sibling = items.find((i) => !i.isSelf);
  assert.equal(sibling.repoName, "repo-b");
});

test("renderFleet produces markdown table with correct columns", async () => {
  const items = [
    {
      repoName: "repo-a",
      inProgressSlice: "SLICE-02",
      inProgressTitle: "Second",
      completedCount: 1,
      totalCount: 3,
      updatedAt: new Date().toISOString(),
      isSelf: true
    },
    {
      repoName: "repo-b",
      inProgressSlice: null,
      inProgressTitle: null,
      completedCount: 3,
      totalCount: 3,
      updatedAt: new Date().toISOString(),
      isSelf: false
    }
  ];
  const md = renderFleet(items);
  assert.match(md, /# Fleet/);
  assert.match(md, /\| Repo \|/);
  assert.match(md, /repo-a.*this/);
  assert.match(md, /SLICE-02/);
  assert.match(md, /1\/3/);
  assert.match(md, /repo-b/);
  assert.match(md, /idle/);
  assert.match(md, /3\/3/);
});

test("renderFleet returns empty-fleet message when no items", () => {
  const md = renderFleet([]);
  assert.match(md, /no active loops found/);
});

test("buildFleetReport returns items + markdown", async () => {
  const root = await makeTempDir("fleet-report-");
  const repoA = path.join(root, "repo-a");
  await fs.mkdir(repoA, { recursive: true });
  await writeSliceProgress(repoA, PROGRESS_IN_FLIGHT);

  const { items, markdown } = await buildFleetReport(repoA, { includeSelf: true });
  assert.ok(Array.isArray(items));
  assert.ok(typeof markdown === "string");
  assert.match(markdown, /SLICE-02/);
});

test("collectFleetWorktrees supports extraRoots", async () => {
  const root1 = await makeTempDir("fleet-root1-");
  const root2 = await makeTempDir("fleet-root2-");
  const repoA = path.join(root1, "repo-a");
  const repoB = path.join(root2, "repo-b");
  await fs.mkdir(repoA, { recursive: true });
  await fs.mkdir(repoB, { recursive: true });
  await writeSliceProgress(repoA, PROGRESS_IDLE);
  await writeSliceProgress(repoB, PROGRESS_IN_FLIGHT);

  const items = await collectFleetWorktrees(repoA, {
    extraRoots: [root2],
    includeSelf: true
  });
  const names = items.map((i) => i.repoName).sort();
  assert.ok(names.includes("repo-b"), "should find repo-b via extraRoots");
});
