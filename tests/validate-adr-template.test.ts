/**
 * Tests for scripts/validate-adr-template.ts (FEAT-142 SLICE-A;
 * heading + bullet format aligned to the real ADR convention, arch-review
 * 2026-07-04 Finding 2.9).
 */
import { test, expect } from "bun:test";
import { validateAdr } from "../scripts/validate-adr-template.ts";

const WELL_FORMED = `# ADR-001: Example

## Context

Some context.

## Alternatives considered

- **Option A (Use Postgres):** Body.
  Rejected because operational cost was too high — no in-house DBA, on-call burden +30%.

- **Option B (Use MongoDB):** Body.
  Rejected because schema drift over time would force a rewrite at year 2; team has no Mongo ops experience.

- **Option C (Use SQLite + Litestream):** Body.
  Accepted (lower ops cost, single-writer constraint acceptable for this workload).

## Decision

Option C.

## Consequences

Lower ops cost. Single-writer constraint.
`;

const SINGLE_OPTION = `# ADR-002: Minimal

## Context

## Alternatives considered

- **Option A (Add the allowlist entry):** Body.
  Rejected because the newer path ships first and makes it unnecessary.

## Decision

Do not add it.

## Consequences
`;

const TRIVIAL_REJECTIONS = `# ADR-003: Trivial

## Context

## Alternatives considered

- **Option A (A):** Body.
  Rejected. Too complex.

- **Option B (B):** Body.
  Rejected. Not preferred.

- **Option C (C):** Body.
  Accepted.

## Decision

Option C.
`;

const MISSING_REJECTION_REASONING = `# ADR-004: Missing

## Context

## Alternatives considered

- **Option A (First):** A description of the option with no explicit verdict word at all.

- **Option B (Second):** Body.
  Rejected because of vendor lock-in to AWS — multi-cloud SLA requires an escape hatch.

- **Option C (Third):** Body.
  Accepted.

## Decision

Option C.
`;

const NO_ALTERNATIVES_SECTION = `# ADR-005: Naive

## Context

## Decision

Just do it.

## Consequences
`;

test("validateAdr: well-formed ADR yields zero findings", () => {
  const findings = validateAdr("adr-001.md", WELL_FORMED);
  expect(findings.length, JSON.stringify(findings, null, 2)).toBe(0);
});

test("validateAdr: a single documented alternative is sufficient (real ADRs have as few as one)", () => {
  const findings = validateAdr("adr-002.md", SINGLE_OPTION);
  expect(findings.length, JSON.stringify(findings, null, 2)).toBe(0);
});

test("validateAdr: trivial rejection reasoning fires warnings on rejected options", () => {
  const findings = validateAdr("adr-003.md", TRIVIAL_REJECTIONS);
  const trivials = findings.filter((f) => f.rule === "trivial-rejection-reasoning");
  // Options A and B are rejected with vague one-line reasoning; C is accepted (no check).
  expect(
    trivials.length,
    `expected 2 trivial findings, got ${JSON.stringify(findings, null, 2)}`
  ).toBe(2);
  expect(trivials.every((t) => t.severity === "warn")).toBeTruthy();
});

test("validateAdr: a rejected option with no Rejected/Accepted marker errors", () => {
  const findings = validateAdr("adr-004.md", MISSING_REJECTION_REASONING);
  const miss = findings.find((f) => f.rule === "missing-rejection-reasoning");
  expect(
    miss,
    `must flag missing-rejection-reasoning, got ${JSON.stringify(findings, null, 2)}`
  ).toBeTruthy();
  if (!miss)
    throw new Error(
      `must flag missing-rejection-reasoning, got ${JSON.stringify(findings, null, 2)}`
    );
  expect(miss.severity).toBe("error");
  expect(miss.detail).toMatch(/Option 1/);
});

test("validateAdr: completely absent Alternatives considered section errors fast", () => {
  const findings = validateAdr("adr-005.md", NO_ALTERNATIVES_SECTION);
  expect(findings.length).toBe(1);
  expect(findings[0]?.rule).toBe("missing-alternatives-considered");
  expect(findings[0]?.severity).toBe("error");
});
