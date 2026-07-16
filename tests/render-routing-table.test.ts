import { test, expect } from "bun:test";
// tests/render-routing-table.test.ts — FEAT-crew-architecture-review Section 7
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
  expect(md).toMatch(/\| Tags resolve to \| Changed-file signal \| Builder dispatch \|/);
  expect(md).toMatch(/`surface:ui` OR `stack:react` only/);
});

test("renders other sections with Signal / Route to / Notes headers", () => {
  const md = render([BUILDER_ROW, WORKFLOW_ROW]);
  expect(md).toMatch(/### Workflow signals/);
  expect(md).toMatch(/\| Signal \| Route to \| Notes \|/);
  expect(md).toMatch(/\*\*New feature request\*\*/);
});

test("escapes a literal pipe inside a cell so the table stays well-formed", () => {
  const row: RoutingRow = {
    section: "review-gates",
    signal: "matches `(auth|login|signin)`",
    route_to: "reviewer",
    notes: "n/a"
  };
  const md = render([row]);
  expect(md).toMatch(/matches `\(auth\\\|login\\\|signin\)`/);
  // Sanity: the row still renders as exactly one table line (3 cells + delimiters).
  // Escaped pipes (`\|`) are literal cell content, not delimiters — strip them
  // before counting so the split reflects only the real cell boundaries.
  const rowLine = md.split("\n").find((l) => l.includes("matches"));
  expect(rowLine).toBeTruthy();
  expect(rowLine?.replace(/\\\|/g, "").split("|").length).toBe(5); // leading + 3 cells + trailing
});

test("preserves a section with no notes on a row (empty cell, not 'undefined')", () => {
  const row: RoutingRow = {
    section: "workflow-signals",
    signal: "signal only",
    route_to: "dispatcher"
  };
  const md = render([row]);
  expect(md).not.toMatch(/undefined/);
});

test("render output is stable across repeated calls (deterministic)", () => {
  const rows = [BUILDER_ROW, WORKFLOW_ROW];
  expect(render(rows)).toBe(render(rows));
});

test("includes the static docs-comms migration note ahead of that section's table", () => {
  const md = render([{ ...WORKFLOW_ROW, section: "docs-comms" }]);
  const noteIdx = md.indexOf("Migration note (FEAT-124");
  // Every section renders its own (possibly empty) table, so find the Docs &
  // comms heading first and only look for the table after it — an earlier
  // section's empty "| Signal | Route to | Notes |" header must not count.
  const docsCommsIdx = md.indexOf("### Docs & comms");
  expect(noteIdx > -1, "migration note missing").toBeTruthy();
  expect(docsCommsIdx > -1, "Docs & comms heading missing").toBeTruthy();
  const tableIdx = md.indexOf("| Signal | Route to | Notes |", docsCommsIdx);
  expect(tableIdx > noteIdx, "table should follow the migration note").toBeTruthy();
});

test("includes the Usage and Design principles footer", () => {
  const md = render([WORKFLOW_ROW]);
  expect(md).toMatch(/## Usage/);
  expect(md).toMatch(/## Design principles/);
});
