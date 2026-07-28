import { test, expect } from "bun:test";
import { estimateScope } from "../scripts/lib/scope-estimate.ts";

// Tier rules:
//   light:    totalLines < 300 AND fileCount <= 2 AND no eslintDisable
//   heavy:    totalLines > 800 OR fileCount >= 6 OR any file has eslintDisable
//   standard: everything else

test("estimateScope returns light for 1 file under 300 lines", () => {
  const result = estimateScope({ files: [{ path: "src/foo.mjs", lines: 150 }] });
  expect(result.tier).toBe("light");
  expect(result.reason.length > 0, "must include reason").toBeTruthy();
});

test("estimateScope returns light for 2 files, combined < 300", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 100 },
      { path: "b.mjs", lines: 150 }
    ]
  });
  expect(result.tier).toBe("light");
});

test("estimateScope returns standard for 3 files in 300-800 line range", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 200 },
      { path: "b.mjs", lines: 200 },
      { path: "c.mjs", lines: 100 }
    ]
  });
  expect(result.tier).toBe("standard");
});

test("estimateScope returns heavy for total lines > 800", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 500 },
      { path: "b.mjs", lines: 400 }
    ]
  });
  expect(result.tier).toBe("heavy");
  expect(result.reason).toMatch(/lines/i);
});

test("estimateScope returns heavy for fileCount >= 6", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ path: `f${i}.mjs`, lines: 50 }));
  const result = estimateScope({ files });
  expect(result.tier).toBe("heavy");
  expect(result.reason).toMatch(/file/i);
});

test("estimateScope escalates to heavy when any file has eslintDisable flag", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 100, eslintDisable: true },
      { path: "b.mjs", lines: 80 }
    ]
  });
  expect(result.tier).toBe("heavy");
  expect(result.reason).toMatch(/eslint/i);
});

test("estimateScope returns standard for 2 files just over 300 lines", () => {
  const result = estimateScope({
    files: [
      { path: "a.mjs", lines: 200 },
      { path: "b.mjs", lines: 120 }
    ]
  });
  expect(result.tier).toBe("standard");
});

test("estimateScope returns { tier, reason } shape on empty files", () => {
  const result = estimateScope({ files: [] });
  expect("tier" in result, "must have tier").toBeTruthy();
  expect("reason" in result, "must have reason").toBeTruthy();
  expect(["light", "standard", "heavy"].includes(result.tier)).toBeTruthy();
});
