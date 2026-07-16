import { test, expect } from "bun:test";
/**
 * Tests for scripts/lib/telemetry/span.ts
 * AC-2: Zod span schema validates real spans end-to-end.
 */
import { SpanRecordSchema, newTraceId, newSpanId } from "../scripts/lib/telemetry/span.ts";

// ---------------------------------------------------------------------------
// Case 1: Valid span passes SpanRecordSchema.parse
// ---------------------------------------------------------------------------

test("SpanRecordSchema: valid span passes parse", () => {
  const span = SpanRecordSchema.parse({
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    name: "slice.run",
    kind: "INTERNAL",
    startTimeUnixNano: "1717754000000000000",
    endTimeUnixNano: "1717754100000000000",
    attributes: { run_id: "20260607T122544Z", cost: 1.99 },
    events: [],
    status: { code: "OK" }
  });
  expect(span.traceId).toBe("a".repeat(32));
  expect(span.spanId).toBe("b".repeat(16));
  expect(span.name).toBe("slice.run");
  expect(span.kind).toBe("INTERNAL");
  expect(span.status.code).toBe("OK");
});

// ---------------------------------------------------------------------------
// Case 2: Invalid traceId (31 hex chars) is rejected with a Zod error
// ---------------------------------------------------------------------------

test("SpanRecordSchema: invalid traceId (31 chars) is rejected", () => {
  let caught: unknown;
  try {
    SpanRecordSchema.parse({
      traceId: "a".repeat(31), // one short
      spanId: "b".repeat(16),
      name: "slice.run",
      kind: "INTERNAL",
      startTimeUnixNano: "1717754000000000000",
      endTimeUnixNano: "1717754100000000000",
      attributes: {},
      events: [],
      status: { code: "UNSET" }
    });
  } catch (err) {
    caught = err;
  }
  expect(caught instanceof Error, "expected Error").toBeTruthy();
  expect(
    (caught as Error)?.message.includes("traceId"),
    `error message should mention traceId: ${(caught as Error)?.message}`
  ).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Case 3 (SLICE-81): passthrough — extra SDK attrs survive SpanRecordSchema.parse
// ---------------------------------------------------------------------------

test("SpanRecordSchema: passthrough keeps unknown fields like traceState", () => {
  const span = SpanRecordSchema.parse({
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    name: "tool_call",
    kind: "INTERNAL",
    startTimeUnixNano: "1717754000000000000",
    endTimeUnixNano: "1717754000000000001",
    attributes: {},
    events: [],
    status: { code: "OK" },
    traceState: "vendor=x",
    droppedAttributesCount: 0
  }) as Record<string, unknown>;
  expect(span["traceState"], "traceState must survive passthrough").toBe("vendor=x");
  expect(span["droppedAttributesCount"], "droppedAttributesCount must survive passthrough").toBe(0);
});

test("newTraceId and newSpanId are deterministic", () => {
  const t1 = newTraceId("run-x");
  const t2 = newTraceId("run-x");
  expect(t1, "newTraceId must return same value for same seed").toBe(t2);
  expect(t1, "newTraceId must return 32-hex string").toMatch(/^[0-9a-f]{32}$/);

  const s1 = newSpanId("run-x.root");
  const s2 = newSpanId("run-x.root");
  expect(s1, "newSpanId must return same value for same seed").toBe(s2);
  expect(s1, "newSpanId must return 16-hex string").toMatch(/^[0-9a-f]{16}$/);
});
