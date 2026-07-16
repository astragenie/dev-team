import { test, expect } from "bun:test";
// tests/memory-provider-schema.test.ts
// FEAT-188 S2 AC coverage: MemoryEntry Zod schema (kind | severity | tags |
// summary<=280 | source-provenance | supersedes).
import { MemoryEntrySchema } from "@astragenie/memory-provider";

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
  expect(parsed.kind).toBe("failure");
  expect(parsed.severity).toBe("high");
  expect(parsed.tags).toEqual(["stack:typescript"]);
  expect(parsed.source).toBe("review_fail");
});

test("MemoryEntrySchema accepts all four kinds", () => {
  for (const kind of ["failure", "lesson", "decision", "standard_violation"]) {
    expect(() => MemoryEntrySchema.parse(validEntry({ kind }))).not.toThrow();
  }
});

test("MemoryEntrySchema rejects an unknown kind", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ kind: "bogus" }))).toThrow();
});

test("MemoryEntrySchema accepts all four severities", () => {
  for (const severity of ["critical", "high", "medium", "low"]) {
    expect(() => MemoryEntrySchema.parse(validEntry({ severity }))).not.toThrow();
  }
});

test("MemoryEntrySchema rejects an unknown severity", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ severity: "urgent" }))).toThrow();
});

test("MemoryEntrySchema rejects a summary over 280 chars", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ summary: "x".repeat(281) }))).toThrow();
});

test("MemoryEntrySchema accepts a summary at exactly 280 chars", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ summary: "x".repeat(280) }))).not.toThrow();
});

test("MemoryEntrySchema requires source (provenance) to be a non-empty string", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ source: "" }))).toThrow();
  expect(() => MemoryEntrySchema.parse(validEntry({ source: undefined }))).toThrow();
});

test("MemoryEntrySchema accepts an optional supersedes id", () => {
  const parsed = MemoryEntrySchema.parse(validEntry({ supersedes: "entry-0" }));
  expect(parsed.supersedes).toBe("entry-0");
});

test("MemoryEntrySchema defaults tags to an empty array when omitted", () => {
  const { tags: _tags, ...rest } = validEntry();
  const parsed = MemoryEntrySchema.parse(rest);
  expect(parsed.tags).toEqual([]);
});

test("MemoryEntrySchema rejects a non-ISO timestamp", () => {
  expect(() => MemoryEntrySchema.parse(validEntry({ ts: "not-a-date" }))).toThrow();
});
