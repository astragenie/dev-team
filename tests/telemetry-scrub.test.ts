/**
 * Tests for scripts/lib/telemetry/scrub.ts
 * AC-4: deny-list keys, long strings, path globs, scrub_pii=false passthrough.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { scrubAttrs, matchesRedactPath } from "../scripts/lib/telemetry/scrub.ts";

// ---------------------------------------------------------------------------
// Case 1: Deny-list keys redacted regardless of length
// ---------------------------------------------------------------------------

test("scrubAttrs: deny-list key redacted regardless of length", () => {
  const result = scrubAttrs(
    {
      "tool_input.content": "x",
      count: 42,
      flag: true
    },
    { scrub_pii: true, redact_paths: [], redact_attr_max_chars: 10000 }
  );
  assert.equal(result["tool_input.content"], "<redacted:key>");
  // Numeric attrs unchanged
  assert.equal(result["count"], 42);
  // Boolean attrs unchanged
  assert.equal(result["flag"], true);
});

test("scrubAttrs: all deny-list keys are redacted", () => {
  const denyListKeys = [
    "input.prompt",
    "input.diff",
    "input.content",
    "input.code",
    "input.text",
    "tool_input.content",
    "tool_input.code",
    "tool_input.text",
    "tool_input.prompt",
    "tool_input.file_text",
    "tool_input.new_string",
    "tool_input.old_string",
    "tool_response",
    "last_assistant_message"
  ];
  const attrs: Record<string, string | number | boolean> = {};
  for (const k of denyListKeys) attrs[k] = "some value";

  const result = scrubAttrs(attrs, {
    scrub_pii: true,
    redact_paths: [],
    redact_attr_max_chars: 10000
  });
  for (const k of denyListKeys) {
    assert.equal(result[k], "<redacted:key>", `${k} should be redacted`);
  }
});

// ---------------------------------------------------------------------------
// Case 2: Long string redacted with length preserved
// ---------------------------------------------------------------------------

test("scrubAttrs: string longer than max chars redacted with length", () => {
  const longStr = "a".repeat(3000);
  const result = scrubAttrs(
    { message: longStr },
    { scrub_pii: true, redact_paths: [], redact_attr_max_chars: 2048 }
  );
  assert.equal(result["message"], "<redacted:length=3000>");
});

// ---------------------------------------------------------------------------
// Case 3: Path glob match redacts value
// ---------------------------------------------------------------------------

test("scrubAttrs: value matching redact_paths glob is redacted", () => {
  const result = scrubAttrs(
    { file_path: "/home/u/.env.local" },
    { scrub_pii: true, redact_paths: ["**/.env.*"], redact_attr_max_chars: 10000 }
  );
  assert.equal(result["file_path"], "<redacted:path>");
});

test("matchesRedactPath: ** glob matches nested paths", () => {
  assert.equal(matchesRedactPath("/home/u/.env.local", ["**/.env.*"]), true);
  assert.equal(matchesRedactPath("/secrets/key.pem", ["**/*.pem"]), true);
  assert.equal(matchesRedactPath("/home/u/safe.txt", ["**/.env.*"]), false);
});

// ---------------------------------------------------------------------------
// Case 4: scrub_pii=false passes through unchanged
// ---------------------------------------------------------------------------

test("scrubAttrs: scrub_pii=false passes through unchanged", () => {
  const input = {
    "tool_input.content": "secret-data",
    message: "a".repeat(3000),
    count: 99
  };
  const result = scrubAttrs(input, {
    scrub_pii: false,
    redact_paths: [],
    redact_attr_max_chars: 10
  });
  assert.deepEqual(result, input);
});
