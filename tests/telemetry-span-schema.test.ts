/**
 * Tests for scripts/lib/telemetry/span.ts
 * AC-2: Zod span schema validates real spans end-to-end.
 */
import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(span.traceId, "a".repeat(32));
  assert.equal(span.spanId, "b".repeat(16));
  assert.equal(span.name, "slice.run");
  assert.equal(span.kind, "INTERNAL");
  assert.equal(span.status.code, "OK");
});

// ---------------------------------------------------------------------------
// Case 2: Invalid traceId (31 hex chars) is rejected with a Zod error
// ---------------------------------------------------------------------------

test("SpanRecordSchema: invalid traceId (31 chars) is rejected", () => {
  assert.throws(
    () =>
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
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "expected Error");
      assert.ok(
        err.message.includes("traceId"),
        `error message should mention traceId: ${err.message}`
      );
      return true;
    }
  );
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
  assert.equal(span["traceState"], "vendor=x", "traceState must survive passthrough");
  assert.equal(
    span["droppedAttributesCount"],
    0,
    "droppedAttributesCount must survive passthrough"
  );
});

test("newTraceId and newSpanId are deterministic", () => {
  const t1 = newTraceId("run-x");
  const t2 = newTraceId("run-x");
  assert.equal(t1, t2, "newTraceId must return same value for same seed");
  assert.match(t1, /^[0-9a-f]{32}$/, "newTraceId must return 32-hex string");

  const s1 = newSpanId("run-x.root");
  const s2 = newSpanId("run-x.root");
  assert.equal(s1, s2, "newSpanId must return same value for same seed");
  assert.match(s1, /^[0-9a-f]{16}$/, "newSpanId must return 16-hex string");
});
