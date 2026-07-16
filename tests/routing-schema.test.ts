import { test, expect } from "bun:test";
// tests/routing-schema.test.ts — FEAT-crew-architecture-review Section 7
import { parseRoutingTable, RoutingTableSchema } from "../scripts/lib/routing/schema.ts";

const VALID_ROW = {
  section: "workflow-signals" as const,
  signal: "**New feature request**",
  route_to: "dispatcher + fullstack-dev",
  notes: "Dispatcher refines scope."
};

test("accepts a well-formed routing table", () => {
  const table = parseRoutingTable({ version: "1.0.0", rows: [VALID_ROW] });
  expect(table.version).toBe("1.0.0");
  expect(table.rows.length).toBe(1);
});

test("notes is optional", () => {
  const { notes: _notes, ...rowWithoutNotes } = VALID_ROW;
  const table = parseRoutingTable({ version: "1.0.0", rows: [rowWithoutNotes] });
  expect(table.rows[0]?.notes).toBe(undefined);
});

test("rejects an unknown section enum value", () => {
  expect(() =>
    parseRoutingTable({
      version: "1.0.0",
      rows: [{ ...VALID_ROW, section: "not-a-real-section" }]
    })
  ).toThrow();
});

test("rejects a malformed version string", () => {
  expect(() => parseRoutingTable({ version: "not-semver", rows: [VALID_ROW] })).toThrow();
});

test("rejects an empty rows array", () => {
  expect(() => parseRoutingTable({ version: "1.0.0", rows: [] })).toThrow();
});

test("rejects a row missing route_to", () => {
  const { route_to: _routeTo, ...rowMissingRouteTo } = VALID_ROW;
  expect(() => parseRoutingTable({ version: "1.0.0", rows: [rowMissingRouteTo] })).toThrow();
});

test("RoutingTableSchema exposes all 10 section ids", () => {
  const table = RoutingTableSchema.parse({
    version: "1.0.0",
    rows: [
      "builder-matrix",
      "workflow-signals",
      "review-gates",
      "code-language",
      "architecture",
      "infra-ops",
      "research",
      "docs-comms",
      "ux",
      "crew-internals"
    ].map((section) => ({ ...VALID_ROW, section }))
  });
  expect(table.rows.length).toBe(10);
});
