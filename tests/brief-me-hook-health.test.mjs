// tests/brief-me-hook-health.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatHookHealthSection } from "../scripts/lib/briefing.ts";

test("formatHookHealthSection returns green header when all hooks clean", () => {
  const health = {
    hooks: [
      { name: "check-redundant-read", errorCount24h: 0, status: "green" },
      { name: "record-read-content", errorCount24h: 0, status: "green" },
      { name: "preflight-shell", errorCount24h: 0, status: "green" },
      { name: "check-subagent-return", errorCount24h: 0, status: "green" }
    ]
  };
  const section = formatHookHealthSection(health);
  assert.match(section, /##\s+Hook health/);
  assert.match(section, /all hooks clean/i);
  assert.doesNotMatch(section, /yellow/i);
});

test("formatHookHealthSection shows error count for yellow hooks", () => {
  const health = {
    hooks: [
      { name: "preflight-shell", errorCount24h: 3, status: "yellow" },
      { name: "check-redundant-read", errorCount24h: 0, status: "green" }
    ]
  };
  const section = formatHookHealthSection(health);
  assert.match(section, /preflight-shell/);
  assert.match(section, /3/);
});
