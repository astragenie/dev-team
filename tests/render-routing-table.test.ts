// tests/render-routing-table.test.ts — FEAT-crew-architecture-review Section 7
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../scripts/render-routing-table.ts";
import type { RoutingRow } from "../scripts/lib/routing/schema.ts";

const BUILDER_ROW: RoutingRow = {
  section: "builder-matrix",
  signal: "`surface:ui` OR `stack:react` only",
  notes: "any",
  route_to: "`crew:frontend-dev`"
};

const WORKFLOW_ROW: RoutingRow = {
  section: "workflow-signals",
  signal: "**New feature request**",
  route_to: "dispatcher + fullstack-dev",
  notes: "Dispatcher refines scope."
};

test("renders the builder-matrix table with its own column headers", () => {
  const md = render([BUILDER_ROW]);
  assert.match(md, /\| Tags resolve to \| Changed-file signal \| Builder dispatch \|/);
  assert.match(md, /`surface:ui` OR `stack:react` only/);
});

test("renders other sections with Signal / Route to / Notes headers", () => {
  const md = render([BUILDER_ROW, WORKFLOW_ROW]);
  assert.match(md, /### Workflow signals/);
  assert.match(md, /\| Signal \| Route to \| Notes \|/);
  assert.match(md, /\*\*New feature request\*\*/);
});

test("escapes a literal pipe inside a cell so the table stays well-formed", () => {
  const row: RoutingRow = {
    section: "review-gates",
    signal: "matches `(auth|login|signin)`",
    route_to: "reviewer",
    notes: "n/a"
  };
  const md = render([row]);
  assert.match(md, /matches `\(auth\\\|login\\\|signin\)`/);
  // Sanity: the row still renders as exactly one table line (3 cells + delimiters).
  // Escaped pipes (`\|`) are literal cell content, not delimiters — strip them
  // before counting so the split reflects only the real cell boundaries.
  const rowLine = md.split("\n").find((l) => l.includes("matches"));
  assert.ok(rowLine);
  assert.equal(rowLine?.replace(/\\\|/g, "").split("|").length, 5); // leading + 3 cells + trailing
});

test("preserves a section with no notes on a row (empty cell, not 'undefined')", () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "signal only",
    route_to: "dispatcher"
  };
  const md = render([row]);
  assert.doesNotMatch(md, /undefined/);
});

test("render output is stable across repeated calls (deterministic)", () => {
  const rows = [BUILDER_ROW, WORKFLOW_ROW];
  assert.equal(render(rows), render(rows));
});

test("includes the static docs-comms migration note ahead of that section's table", () => {
  const md = render([{ ...WORKFLOW_ROW, section: "docs-comms" }]);
  const noteIdx = md.indexOf("Migration note (FEAT-124");
  // Every section renders its own (possibly empty) table, so find the Docs &
  // comms heading first and only look for the table after it — an earlier
  // section's empty "| Signal | Route to | Notes |" header must not count.
  const docsCommsIdx = md.indexOf("### Docs & comms");
  assert.ok(noteIdx > -1, "migration note missing");
  assert.ok(docsCommsIdx > -1, "Docs & comms heading missing");
  const tableIdx = md.indexOf("| Signal | Route to | Notes |", docsCommsIdx);
  assert.ok(tableIdx > noteIdx, "table should follow the migration note");
});

test("includes the Usage and Design principles footer", () => {
  const md = render([WORKFLOW_ROW]);
  assert.match(md, /## Usage/);
  assert.match(md, /## Design principles/);
});
