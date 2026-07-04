// tests/routing-schema.test.ts — FEAT-crew-architecture-review Section 7
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoutingTable, RoutingTableSchema } from "../scripts/lib/routing/schema.ts";

const VALID_ROW = {
  section: "workflow-signals" as const,
  signal: "**New feature request**",
  route_to: "dispatcher + fullstack-dev",
  notes: "Dispatcher refines scope."
};

test("accepts a well-formed routing table", () => {
  const table = parseRoutingTable({ version: "1.0.0", rows: [VALID_ROW] });
  assert.equal(table.version, "1.0.0");
  assert.equal(table.rows.length, 1);
});

test("notes is optional", () => {
  const { notes: _notes, ...rowWithoutNotes } = VALID_ROW;
  const table = parseRoutingTable({ version: "1.0.0", rows: [rowWithoutNotes] });
  assert.equal(table.rows[0]?.notes, undefined);
});

test("rejects an unknown section enum value", () => {
  assert.throws(() =>
    parseRoutingTable({
      version: "1.0.0",
      rows: [{ ...VALID_ROW, section: "not-a-real-section" }]
    })
  );
});

test("rejects a malformed version string", () => {
  assert.throws(() => parseRoutingTable({ version: "not-semver", rows: [VALID_ROW] }));
});

test("rejects an empty rows array", () => {
  assert.throws(() => parseRoutingTable({ version: "1.0.0", rows: [] }));
});

test("rejects a row missing route_to", () => {
  const { route_to: _routeTo, ...rowMissingRouteTo } = VALID_ROW;
  assert.throws(() => parseRoutingTable({ version: "1.0.0", rows: [rowMissingRouteTo] }));
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
  assert.equal(table.rows.length, 10);
});
