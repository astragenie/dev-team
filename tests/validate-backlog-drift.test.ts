/**
 * Tests for scripts/validate-backlog-drift.ts (arch-review 2026-07-04
 * Finding 2.10 — triaged/ files whose slice-close ceremony already ran in
 * git history but were never moved to done/).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { findDrift } from "../scripts/validate-backlog-drift.ts";

test("findDrift: flags a triaged slice already closed in git history (synthetic drift)", () => {
  const triagedFiles = ["SLICE-999-synthetic-drift.md", "SLICE-200-open-work.md"];
  const closeLogLines = ["docs(backlog): close SLICE-999 as done — synthetic fixture"];
  assert.deepEqual(findDrift(triagedFiles, closeLogLines), ["SLICE-999"]);
});

test("findDrift: no drift when the triaged slice has no matching close commit", () => {
  const triagedFiles = ["SLICE-200-open-work.md"];
  const closeLogLines = ["docs(backlog): close SLICE-106 as done"];
  assert.deepEqual(findDrift(triagedFiles, closeLogLines), []);
});

test("findDrift: a single commit closing multiple slices flags both", () => {
  const triagedFiles = ["SLICE-103-a.md", "SLICE-104-b.md"];
  const closeLogLines = ["docs(backlog): close SLICE-103 + SLICE-104 as done"];
  assert.deepEqual(findDrift(triagedFiles, closeLogLines), ["SLICE-103", "SLICE-104"]);
});

test("findDrift: FEAT-only triaged filenames carry no slice ID, never false-positive", () => {
  const triagedFiles = ["FEAT-182.md"];
  const closeLogLines = ["docs(backlog): close SLICE-1 as done"];
  assert.deepEqual(findDrift(triagedFiles, closeLogLines), []);
});

test("findDrift: no triaged files and no close commits yields empty", () => {
  assert.deepEqual(findDrift([], []), []);
});
