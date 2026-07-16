import { test, expect } from "bun:test";
import { ok, err, map, flatMap, type Result } from "../scripts/lib/result.ts";

test("ok wraps a value", () => {
  const r = ok(42);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value).toBe(42);
});

test("err wraps an error", () => {
  const r = err({ code: "oops" as const });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toEqual({ code: "oops" });
});

test("map transforms ok value, leaves err unchanged", () => {
  const okIn: Result<number, { code: "x" }> = ok(2);
  const mapped = map(okIn, (n) => n * 5);
  expect(mapped.ok).toBe(true);
  if (mapped.ok) expect(mapped.value).toBe(10);

  const errIn: Result<number, { code: "x" }> = err({ code: "x" });
  const mappedErr = map(errIn, (n) => n * 5);
  expect(mappedErr.ok).toBe(false);
  if (!mappedErr.ok) expect(mappedErr.error).toEqual({ code: "x" });
});

test("flatMap chains Result-returning functions", () => {
  const parse = (s: string): Result<number, { code: "parse"; raw: string }> => {
    const n = Number(s);
    return Number.isFinite(n) ? ok(n) : err({ code: "parse", raw: s });
  };
  const startOk = ok("7") as Result<string, { code: "parse"; raw: string }>;
  const chained = flatMap(startOk, parse);
  expect(chained.ok).toBe(true);
  if (chained.ok) expect(chained.value).toBe(7);

  const startBad = ok("not-a-number") as Result<string, { code: "parse"; raw: string }>;
  const chainedBad = flatMap(startBad, parse);
  expect(chainedBad.ok).toBe(false);
  if (!chainedBad.ok) expect(chainedBad.error).toEqual({ code: "parse", raw: "not-a-number" });
});
