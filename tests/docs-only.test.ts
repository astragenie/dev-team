// #163 S3 — docs-only diff classifier + push-range resolution.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

import { isDocsOnlyDiff, pushedFileset, isDocsOnlyPush } from "../scripts/lib/docs-only.ts";

process.env.GIT_CEILING_DIRECTORIES = os.tmpdir();

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@test.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@test.com"
};

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, stdio: "pipe" }).toString().trim();
}

test("isDocsOnlyDiff — pure path classification", () => {
  // All-docs sets → true.
  assert.equal(isDocsOnlyDiff(["README.md", "docs/architecture/x.md"]), true);
  assert.equal(isDocsOnlyDiff(["CHANGELOG.md", "LICENSE"]), true);
  assert.equal(isDocsOnlyDiff([".claude/artifacts/crew/reviews/r.md"]), true);
  assert.equal(isDocsOnlyDiff(["notes.txt", "docs/guide.mdx"]), true);
  // Backslash paths (Windows-style) normalize.
  assert.equal(isDocsOnlyDiff(["docs\\a.md"]), true);

  // Any non-docs path → false.
  assert.equal(isDocsOnlyDiff(["README.md", "scripts/lib/x.ts"]), false);
  assert.equal(isDocsOnlyDiff(["package.json"]), false);
  assert.equal(isDocsOnlyDiff(["docs.ts"]), false); // not under docs/, .ts extension
  assert.equal(isDocsOnlyDiff(["src/readme.md.ts"]), false);

  // Empty → false (nothing to reason about).
  assert.equal(isDocsOnlyDiff([]), false);
  assert.equal(isDocsOnlyDiff(["  "]), false);
});

async function makeRepoWithUpstream(label: string): Promise<string> {
  // "remote" acts as the upstream origin; "work" is a clone that branches off.
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), `docs-remote-${label}-`));
  git(["init", "-q", "-b", "main", "--bare"], remote);

  const work = await fs.mkdtemp(path.join(os.tmpdir(), `docs-work-${label}-`));
  git(["init", "-q", "-b", "main"], work);
  git(["config", "user.email", "test@test.com"], work);
  git(["config", "user.name", "Test"], work);
  await fs.writeFile(path.join(work, "README.md"), "# test\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "init"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-q", "-u", "origin", "main"], work);
  return work;
}

test("pushedFileset resolves the branch's added files against upstream", async () => {
  const work = await makeRepoWithUpstream("fileset");
  git(["checkout", "-q", "-b", "chore/lane"], work);
  await fs.writeFile(path.join(work, "docs.md"), "docs\n");
  await fs.mkdir(path.join(work, "docs"), { recursive: true });
  await fs.writeFile(path.join(work, "docs", "guide.md"), "guide\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "docs"], work);
  // Track upstream so @{u} resolves.
  git(["branch", "--set-upstream-to=origin/main", "chore/lane"], work);

  const files = await pushedFileset(work);
  assert.notEqual(files, null);
  assert.deepEqual((files ?? []).sort(), ["docs.md", "docs/guide.md"]);
});

test("isDocsOnlyPush — true for a docs-only branch, false when code is mixed in", async () => {
  const work = await makeRepoWithUpstream("push");
  git(["checkout", "-q", "-b", "chore/lane"], work);
  await fs.writeFile(path.join(work, "NOTES.md"), "notes\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "docs"], work);
  git(["branch", "--set-upstream-to=origin/main", "chore/lane"], work);
  assert.equal(await isDocsOnlyPush(work), true);

  // Add a code file → no longer docs-only.
  await fs.writeFile(path.join(work, "index.ts"), "export const x = 1;\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "code"], work);
  assert.equal(await isDocsOnlyPush(work), false);
});

test("isDocsOnlyPush — false (indeterminate) when no upstream can be resolved", async () => {
  const solo = await fs.mkdtemp(path.join(os.tmpdir(), "docs-solo-"));
  git(["init", "-q", "-b", "main"], solo);
  git(["config", "user.email", "test@test.com"], solo);
  git(["config", "user.name", "Test"], solo);
  await fs.writeFile(path.join(solo, "a.md"), "a\n");
  git(["add", "-A"], solo);
  git(["commit", "-q", "-m", "init"], solo);
  // No remote, no upstream → indeterminate → false (normal gate applies).
  assert.equal(await pushedFileset(solo), null);
  assert.equal(await isDocsOnlyPush(solo), false);
});
