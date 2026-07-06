// tests/memory-provider-schema.test.ts
// FEAT-188 S2 AC coverage: MemoryEntry Zod schema (kind | severity | tags |
// summary<=280 | source-provenance | supersedes).
import test from "node:test";
import assert from "node:assert/strict";
import { MemoryEntrySchema } from "../scripts/lib/memory/schema.ts";

function validEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    ts: new Date().toISOString(),
    kind: "failure",
    severity: "high",
    tags: ["stack:typescript"],
    summary: "review rejected: missing null guard",
    source: "review_fail",
    ...overrides
  };
}

test("MemoryEntrySchema accepts a well-formed entry", () => {
  const parsed = MemoryEntrySchema.parse(validEntry());
  assert.equal(parsed.kind, "failure");
  assert.equal(parsed.severity, "high");
  assert.deepEqual(parsed.tags, ["stack:typescript"]);
  assert.equal(parsed.source, "review_fail");
});

test("MemoryEntrySchema accepts all four kinds", () => {
  for (const kind of ["failure", "lesson", "decision", "standard_violation"]) {
    assert.doesNotThrow(() => MemoryEntrySchema.parse(validEntry({ kind })));
  }
});

test("MemoryEntrySchema rejects an unknown kind", () => {
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ kind: "bogus" })));
});

test("MemoryEntrySchema accepts all four severities", () => {
  for (const severity of ["critical", "high", "medium", "low"]) {
    assert.doesNotThrow(() => MemoryEntrySchema.parse(validEntry({ severity })));
  }
});

test("MemoryEntrySchema rejects an unknown severity", () => {
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ severity: "urgent" })));
});

test("MemoryEntrySchema rejects a summary over 280 chars", () => {
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ summary: "x".repeat(281) })));
});

test("MemoryEntrySchema accepts a summary at exactly 280 chars", () => {
  assert.doesNotThrow(() => MemoryEntrySchema.parse(validEntry({ summary: "x".repeat(280) })));
});

test("MemoryEntrySchema requires source (provenance) to be a non-empty string", () => {
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ source: "" })));
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ source: undefined })));
});

test("MemoryEntrySchema accepts an optional supersedes id", () => {
  const parsed = MemoryEntrySchema.parse(validEntry({ supersedes: "entry-0" }));
  assert.equal(parsed.supersedes, "entry-0");
});

test("MemoryEntrySchema defaults tags to an empty array when omitted", () => {
  const { tags: _tags, ...rest } = validEntry();
  const parsed = MemoryEntrySchema.parse(rest);
  assert.deepEqual(parsed.tags, []);
});

test("MemoryEntrySchema rejects a non-ISO timestamp", () => {
  assert.throws(() => MemoryEntrySchema.parse(validEntry({ ts: "not-a-date" })));
});
