import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err, map, flatMap, type Result } from "../scripts/lib/result.ts";

test("ok wraps a value", () => {
  const r = ok(42);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 42);
});

test("err wraps an error", () => {
  const r = err({ code: "oops" as const });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.error, { code: "oops" });
});

test("map transforms ok value, leaves err unchanged", () => {
  const okIn: Result<number, { code: "x" }> = ok(2);
  const mapped = map(okIn, (n) => n * 5);
  assert.equal(mapped.ok, true);
  if (mapped.ok) assert.equal(mapped.value, 10);

  const errIn: Result<number, { code: "x" }> = err({ code: "x" });
  const mappedErr = map(errIn, (n) => n * 5);
  assert.equal(mappedErr.ok, false);
  if (!mappedErr.ok) assert.deepEqual(mappedErr.error, { code: "x" });
});

test("flatMap chains Result-returning functions", () => {
  const parse = (s: string): Result<number, { code: "parse"; raw: string }> => {
    const n = Number(s);
    return Number.isFinite(n) ? ok(n) : err({ code: "parse", raw: s });
  };
  const startOk = ok("7") as Result<string, { code: "parse"; raw: string }>;
  const chained = flatMap(startOk, parse);
  assert.equal(chained.ok, true);
  if (chained.ok) assert.equal(chained.value, 7);

  const startBad = ok("not-a-number") as Result<string, { code: "parse"; raw: string }>;
  const chainedBad = flatMap(startBad, parse);
  assert.equal(chainedBad.ok, false);
  if (!chainedBad.ok) assert.deepEqual(chainedBad.error, { code: "parse", raw: "not-a-number" });
});
