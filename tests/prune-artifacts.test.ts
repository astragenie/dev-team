import { test } from "node:test";
import assert from "node:assert/strict";

import { isOlderThan, validateDays } from "../scripts/prune-artifacts.ts";

const DAY_MS = 86_400_000;
const NOW = 1_000_000 * DAY_MS; // arbitrary fixed "now"

// isOlderThan(mtimeMs, nowMs, days) — true when file is beyond threshold

test("isOlderThan: returns true when file is exactly one day older than threshold", () => {
  const mtime = NOW - 91 * DAY_MS; // 91 days old, threshold 90
  assert.equal(isOlderThan(mtime, NOW, 90), true);
});

test("isOlderThan: returns false when file is newer than threshold", () => {
  const mtime = NOW - 30 * DAY_MS; // 30 days old, threshold 90
  assert.equal(isOlderThan(mtime, NOW, 90), false);
});

test("isOlderThan: returns false when file mtime equals the threshold boundary", () => {
  const mtime = NOW - 90 * DAY_MS; // exactly at the boundary — not older
  assert.equal(isOlderThan(mtime, NOW, 90), false);
});

test("isOlderThan: returns true for very old files (mtime = 0)", () => {
  assert.equal(isOlderThan(0, NOW, 90), true);
});

test("isOlderThan: returns false when mtime equals nowMs (file from now)", () => {
  assert.equal(isOlderThan(NOW, NOW, 1), false);
});

test("isOlderThan: works with threshold of 1 day", () => {
  const mtime = NOW - 2 * DAY_MS; // 2 days old, threshold 1
  assert.equal(isOlderThan(mtime, NOW, 1), true);
});

test("isOlderThan: works with large threshold (365 days)", () => {
  const mtime = NOW - 364 * DAY_MS; // 364 days old, threshold 365
  assert.equal(isOlderThan(mtime, NOW, 365), false);
});

test("isOlderThan: works with large threshold when file is past it", () => {
  const mtime = NOW - 366 * DAY_MS; // 366 days old, threshold 365
  assert.equal(isOlderThan(mtime, NOW, 365), true);
});

// validateDays — float and invalid input rejection
test("validateDays: accepts positive integer", () => {
  assert.equal(validateDays(90), null);
});

test("validateDays: rejects float (1.5)", () => {
  assert.notEqual(validateDays(1.5), null);
});

test("validateDays: rejects zero", () => {
  assert.notEqual(validateDays(0), null);
});

test("validateDays: rejects negative", () => {
  assert.notEqual(validateDays(-5), null);
});

test("validateDays: rejects NaN", () => {
  assert.notEqual(validateDays(NaN), null);
});
