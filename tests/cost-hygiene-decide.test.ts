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
  assert.match(result.message!, /<system-reminder>/);
  assert.match(result.message!, /already loaded/);
  assert.match(result.message!, /1 time/);
  assert.match(result.message!, /Prior content:/);
  assert.match(result.message!, /hello world/);
  assert.match(result.message!, /Do not re-issue the Read/);
  assert.match(result.message!, /<\/system-reminder>/);
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
  assert.match(result.message!, /4 times/);
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
  assert.match(result.message!, /content omitted, file size 87 KB/);
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

// ─── FEAT-156: Edit verify-loop checks ──────────────────────────────────────

const EDIT_AT = "2026-05-28T18:00:00.000Z";
const READ_WITHIN_WINDOW = "2026-05-28T18:00:20.000Z"; // 20s after edit
const READ_OUTSIDE_WINDOW = "2026-05-28T18:00:40.000Z"; // 40s after edit (>30s window)

test("FEAT-156: Read within 30s of successful Edit (unchanged mtime) → warn (verify-loop)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 0,
      first_read_at: EDIT_AT,
      last_read_at: EDIT_AT,
      mtime_at_last_read: EDIT_AT,
      size_at_last_read: 0,
      content_bytes: 0,
      content: null,
      last_edit_at: EDIT_AT,
      mtime_at_last_edit: EDIT_AT
    },
    currentMtime: EDIT_AT,
    currentSize: 100,
    now: READ_WITHIN_WINDOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message!, /Edit\/Write'd/);
  assert.match(result.message!, /force.*true/);
});

test("FEAT-156: Read with mtime newer than last edit → pass (file modified externally)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 0,
      first_read_at: EDIT_AT,
      last_read_at: EDIT_AT,
      mtime_at_last_read: EDIT_AT,
      size_at_last_read: 0,
      content_bytes: 0,
      content: null,
      last_edit_at: EDIT_AT,
      mtime_at_last_edit: EDIT_AT
    },
    currentMtime: "2026-05-28T18:00:15.000Z",
    currentSize: 100,
    now: READ_WITHIN_WINDOW
  });
  assert.equal(result.action, "pass");
});

test("FEAT-156: Read with force: true → pass (override)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 0,
      first_read_at: EDIT_AT,
      last_read_at: EDIT_AT,
      mtime_at_last_read: EDIT_AT,
      size_at_last_read: 0,
      content_bytes: 0,
      content: null,
      last_edit_at: EDIT_AT,
      mtime_at_last_edit: EDIT_AT
    },
    currentMtime: EDIT_AT,
    currentSize: 100,
    now: READ_WITHIN_WINDOW,
    force: true
  });
  assert.equal(result.action, "pass");
});

test("FEAT-156: Read after window elapsed → pass (no verify-loop warn)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 0,
      first_read_at: EDIT_AT,
      last_read_at: EDIT_AT,
      mtime_at_last_read: EDIT_AT,
      size_at_last_read: 0,
      content_bytes: 0,
      content: null,
      last_edit_at: EDIT_AT,
      mtime_at_last_edit: EDIT_AT
    },
    currentMtime: EDIT_AT,
    currentSize: 100,
    now: READ_OUTSIDE_WINDOW
  });
  assert.equal(result.action, "pass");
});

test("FEAT-156: Read of file with prior read + recent edit → verify-loop wins (more specific)", () => {
  const result = decide({
    path: "/abs/path",
    storedEntry: {
      read_count: 3,
      first_read_at: T0,
      last_read_at: T0,
      mtime_at_last_read: T0,
      size_at_last_read: 100,
      content_bytes: 100,
      content: "old content",
      last_edit_at: EDIT_AT,
      mtime_at_last_edit: EDIT_AT
    },
    currentMtime: EDIT_AT,
    currentSize: 100,
    now: READ_WITHIN_WINDOW
  });
  assert.equal(result.action, "warn");
  assert.match(result.message!, /Edit\/Write'd/);
});
