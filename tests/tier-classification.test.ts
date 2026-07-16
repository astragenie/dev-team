import { test, expect } from "bun:test";
import { isLightTier } from "../scripts/orchestrate-slice-classify.ts";

// Test 1: Docs-only files → light
test("isLightTier: docs-only (all .md/.txt) → light", () => {
  const result = isLightTier({
    changedLines: 100,
    filesChanged: ["README.md", "docs/guide.md", "CHANGELOG.txt"]
  });
  expect(result, "docs-only should be light tier").toBe(true);
});

// Test 2: Small code change in tests → light
test("isLightTier: 30-line code change in tests/ → light", () => {
  const result = isLightTier({
    changedLines: 30,
    filesChanged: ["tests/foo.test.ts", "tests/bar.test.ts"]
  });
  expect(result, "small test-only change should be light tier").toBe(true);
});

// Test 3: Small code change in src but touches hooks → full
test("isLightTier: 30-line change touching hooks/ → full", () => {
  const result = isLightTier({
    changedLines: 30,
    filesChanged: ["hooks/pre-commit", "src/foo.ts"]
  });
  expect(result, "any change touching hooks should be full tier").toBe(false);
});

// Test 4: Code change exceeding threshold → full
test("isLightTier: 80-line change → full", () => {
  const result = isLightTier({
    changedLines: 80,
    filesChanged: ["src/large.ts"]
  });
  expect(result, "change exceeding threshold should be full tier").toBe(false);
});

// Test 5: Code change touching package.json → full
test("isLightTier: code change touching package.json → full", () => {
  const result = isLightTier({
    changedLines: 20,
    filesChanged: ["src/foo.ts", "package.json"]
  });
  expect(result, "any change touching package.json should be full tier").toBe(false);
});

// Test 6: Code change touching tsconfig → full
test("isLightTier: code change touching tsconfig → full", () => {
  const result = isLightTier({
    changedLines: 10,
    filesChanged: ["tsconfig.json"]
  });
  expect(result, "any change touching tsconfig should be full tier").toBe(false);
});

// Test 7: Code change touching eslint.config → full
test("isLightTier: code change touching eslint.config → full", () => {
  const result = isLightTier({
    changedLines: 5,
    filesChanged: ["eslint.config.ts"]
  });
  expect(result, "any change touching eslint.config should be full tier").toBe(false);
});

// Test 8: Code change touching .claude-plugin/ → full
test("isLightTier: code change touching .claude-plugin/ → full", () => {
  const result = isLightTier({
    changedLines: 10,
    filesChanged: [".claude-plugin/manifest.json"]
  });
  expect(result, "any change touching .claude-plugin/ should be full tier").toBe(false);
});

// Test 9: Code change touching scripts/ (non-test) → full
test("isLightTier: code change touching scripts/ (non-test) → full", () => {
  const result = isLightTier({
    changedLines: 20,
    filesChanged: ["scripts/deploy.ts"]
  });
  expect(result, "any change touching scripts/ (non-test) should be full tier").toBe(false);
});

// Test 10: Code change in scripts/ excluded from light tier (even tests)
test("isLightTier: 30-line change in scripts/lib/some.test.ts → full", () => {
  const result = isLightTier({
    changedLines: 30,
    filesChanged: ["scripts/lib/some.test.ts"]
  });
  expect(result, "any change touching scripts/ should be full tier").toBe(false);
});

// Test 11: Empty files list → light (edge case)
test("isLightTier: empty files list → light (edge case)", () => {
  const result = isLightTier({
    changedLines: 0,
    filesChanged: []
  });
  expect(result, "empty file list is light tier").toBe(true);
});

// Test 12: loopJson override respected
test("isLightTier: loop.json override maxChangedLines respected", () => {
  // Set maxChangedLines to 100
  const result = isLightTier({
    changedLines: 80,
    filesChanged: ["src/foo.ts"],
    loopJson: {
      lightTier: {
        maxChangedLines: 100
      }
    }
  });
  expect(result, "loop.json override should allow up to 100 lines").toBe(true);

  // Verify it rejects at 101
  const resultOver = isLightTier({
    changedLines: 101,
    filesChanged: ["src/foo.ts"],
    loopJson: {
      lightTier: {
        maxChangedLines: 100
      }
    }
  });
  expect(resultOver, "loop.json override should reject > 100 lines").toBe(false);
});

// Test 13: Mixed docs and code, but under threshold → light
test("isLightTier: 20 lines code + 50 lines docs, under threshold → light", () => {
  const result = isLightTier({
    changedLines: 20,
    filesChanged: ["src/small.ts", "docs/api.md"]
  });
  expect(result, "mixed docs and code under threshold should be light tier").toBe(true);
});

// Test 14: Case-insensitive .MD/.TXT detection
test("isLightTier: case-insensitive .MD/.TXT detection", () => {
  const result = isLightTier({
    changedLines: 100,
    filesChanged: ["README.MD", "GUIDE.TXT"]
  });
  expect(result, "case-insensitive doc detection should work").toBe(true);
});
