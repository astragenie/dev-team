// tests/bun-preflight.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertBunPresent } from "../scripts/lib/installer/bun-preflight.ts";

test("assertBunPresent: returns the detected bun version when bun is on PATH", () => {
  const got = assertBunPresent({ env: process.env });
  assert.match(got.version, /^\d+\.\d+\.\d+/);
});

test("assertBunPresent: throws with an install URL when bun is missing", () => {
  const empty: NodeJS.ProcessEnv = { PATH: "" };
  let err: unknown;
  try {
    assertBunPresent({ env: empty });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof Error, "expected an Error to be thrown");
  assert.ok(
    String(err).includes("https://bun.sh"),
    `error message should reference bun.sh: ${String(err)}`
  );
});
