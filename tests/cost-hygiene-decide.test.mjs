import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../scripts/lib/cost-hygiene/decide.ts";

const T0 = "2026-05-28T18:00:00.000Z";
const T1 = "2026-05-28T18:05:00.000Z";
const NOW = "2026-05-28T18:10:00.000Z";

test("first read of path (no stored entry) → pass", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: null,
    currentMtime: T0,
    currentSize: 1000,
    now: NOW
  });
  assert.equal(result.action, "pass");
  assert.equal(result.message, null);
});

test("reread, mtime unchanged, content stored → warn with quoted content", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "hello world"
    },
    currentMtime: T0,
    currentSize: 100,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /<system-reminder>/);
  assert.match(result.message, /already loaded/);
  assert.match(result.message, /1 time/);
  assert.match(result.message, /Prior content:/);
  assert.match(result.message, /hello world/);
  assert.match(result.message, /Do not re-issue the Read/);
  assert.match(result.message, /<\/system-reminder>/);
});

test("reread, mtime newer than stored → pass (Q7 edit exception)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "old content"
    },
    currentMtime: T1,
    currentSize: 200,
    now: NOW
  });
  assert.equal(result.action, "pass");
  assert.equal(result.message, null);
});

test("5th reread, content stored → warn with read_count 4 in message", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 4,
      first_read_at: T0,
      last_read_at: T1,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "x"
    },
    currentMtime: T0,
    currentSize: 100,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /4 times/);
});

test("reread with content omitted (>50KB) → warn says content omitted with KB", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 87234,
      content_bytes: 0,
      content: null
    },
    currentMtime: T0,
    currentSize: 87234,
    now: NOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message, /content omitted, file size 87 KB/);
});

test("reread, mtime unchanged + size changed → warn (mtime is the gate)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 1,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "abc"
    },
    currentMtime: T0,
    currentSize: 150,
    now: NOW
  });
  assert.equal(result.action, "warn");
});
