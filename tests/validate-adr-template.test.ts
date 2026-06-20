/**
 * Tests for scripts/validate-adr-template.ts (FEAT-142 SLICE-A).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { validateAdr } from "../scripts/validate-adr-template.ts";

const WELL_FORMED = `# ADR-001: Example

## Context

Some context.

## Options Considered

### Option 1: Use Postgres

Body.

Why rejected: Operational cost too high — no in-house DBA, on-call burden +30%.

### Option 2: Use MongoDB

Body.

Why rejected: Schema drift over time would force a rewrite at year 2; team has no Mongo ops experience.

### Option 3: Use SQLite + Litestream

Body.

## Decision

Option 3.

## Consequences

Lower ops cost. Single-writer constraint.
`;

const SINGLE_OPTION = `# ADR-002: Bad

## Context

## Options Considered

### Option 1: Just do the obvious thing

Body.

## Decision

Option 1.

## Consequences
`;

const TRIVIAL_REJECTIONS = `# ADR-003: Trivial

## Context

## Options Considered

### Option 1: A

Body.

Why rejected: Too complex.

### Option 2: B

Body.

Why rejected: Not preferred.

### Option 3: C

Body.

## Decision

Option 3.
`;

const MISSING_REJECTION_LINE = `# ADR-004: Missing

## Context

## Options Considered

### Option 1: First

Body without a Why-rejected line.

### Option 2: Second

Body.

Why rejected: Vendor lock-in to AWS — multi-cloud SLA requires escape hatch.

### Option 3: Third

Body.

## Decision

Option 3.
`;

const NO_OPTIONS_SECTION = `# ADR-005: Naive

## Context

## Decision

Just do it.

## Consequences
`;

test("validateAdr: well-formed ADR yields zero findings", () => {
  const findings = validateAdr("adr-001.md", WELL_FORMED);
  assert.equal(findings.length, 0, JSON.stringify(findings, null, 2));
});

test("validateAdr: single-option ADR flags insufficient-options error", () => {
  const findings = validateAdr("adr-002.md", SINGLE_OPTION);
  const insufficient = findings.find((f) => f.rule === "insufficient-options");
  assert.ok(insufficient, "must flag insufficient-options");
  assert.equal(insufficient.severity, "error");
});

test("validateAdr: trivial rejection reasoning fires warnings on non-chosen options", () => {
  const findings = validateAdr("adr-003.md", TRIVIAL_REJECTIONS);
  const trivials = findings.filter((f) => f.rule === "trivial-rejection-reasoning");
  // Options 1 and 2 are non-chosen (Option 3 is the decision); both have trivial reasoning.
  assert.equal(trivials.length, 2, `expected 2 trivial findings, got ${trivials.length}`);
  assert.ok(trivials.every((t) => t.severity === "warn"));
});

test("validateAdr: missing Why-rejected line on a non-chosen option errors", () => {
  const findings = validateAdr("adr-004.md", MISSING_REJECTION_LINE);
  const miss = findings.find((f) => f.rule === "missing-why-rejected");
  assert.ok(miss, "must flag missing-why-rejected");
  assert.equal(miss.severity, "error");
  // Option 3 is chosen; Option 2 has valid reasoning. Only Option 1 should error.
  assert.match(miss.detail, /Option 1/);
});

test("validateAdr: completely absent Options Considered section errors fast", () => {
  const findings = validateAdr("adr-005.md", NO_OPTIONS_SECTION);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.rule, "missing-options-considered");
  assert.equal(findings[0]?.severity, "error");
});
