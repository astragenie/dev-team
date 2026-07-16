import { test, expect } from "bun:test";
// tests/orchestrate-slice.test.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifySlice,
  classifyChangedFiles,
  isShortSlice
} from "../scripts/orchestrate-slice-classify.ts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMAND_PATH = path.join(repoRoot, "commands", "orchestrate-slice.md");
const ARCHITECT_PATH = path.join(repoRoot, "agents", "architect.md");

test("commands/orchestrate-slice.md exists", async () => {
  await fs.access(COMMAND_PATH);
});

test("orchestrate-slice command has description frontmatter", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  expect(match, "file must start with a YAML frontmatter block").toBeTruthy();
  expect(match![1]!, "frontmatter must include non-empty description:").toMatch(
    /^description:\s*.+/m
  );
});

test("orchestrate-slice command body contains Steps 0 through 8", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  for (let i = 0; i <= 8; i++) {
    expect(text, `command body must contain "Step ${i}"`).toMatch(new RegExp(`Step ${i}`));
  }
});

test("orchestrate-slice command references all required specialist agents", async () => {
  const text = await fs.readFile(COMMAND_PATH, "utf8");
  const required = [
    "crew:architect",
    "crew:uxdesigner",
    "crew:fullstack-dev",
    "crew:reviewer",
    "crew:verifier"
  ];
  for (const agent of required) {
    expect(text, `command must reference ${agent}`).toMatch(new RegExp(agent));
  }
});

test("architect.md documents the three-file OpenAPI contract shape", async () => {
  // The dedicated `## Contract artifact schema` section was folded into the
  // Output contract section in commit bc96c8f; the three filenames stay
  // load-bearing for downstream consumers (builder-fe / builder-be).
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  const required = [
    "<FEAT-ID>-contracts.openapi.yaml",
    "<FEAT-ID>-contracts.md",
    "<FEAT-ID>-contracts.ts"
  ];
  for (const section of required) {
    expect(text.includes(section), `architect.md must mention "${section}"`).toBeTruthy();
  }
});

test("architect.md mentions the validate-contracts regeneration step", async () => {
  const text = await fs.readFile(ARCHITECT_PATH, "utf8");
  expect(
    text,
    "architect.md must document the validate-contracts regeneration step for derived TS"
  ).toMatch(/validate-contracts\.(?:mjs|ts)/);
});

test("classifySlice: SPLIT_BUILD true when both surface:ui and surface:api present", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/split-build-demo.md"
  });
  expect(result.SPLIT_BUILD).toBe(true);
  expect(result.NEEDS_CONTRACT).toBe(true);
  expect(result.NEEDS_UX).toBe(true);
});

test("classifySlice: SPLIT_BUILD false when only backend stack tag", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/single-stack-demo.md"
  });
  expect(result.SPLIT_BUILD).toBe(false);
  expect(result.NEEDS_CONTRACT).toBe(true);
  expect(result.NEEDS_UX).toBe(false);
});

test('classifySlice: SPLIT_BUILD false when slice has skip: ["split-build"]', async () => {
  const tmp = `tests/fixtures/slices/skip-split-demo-${process.pid}-${Date.now()}.md`;
  const { writeFile, unlink } = await import("node:fs/promises");
  await writeFile(
    tmp,
    '---\nslice: SLICE-903\ntags: [surface:ui, surface:api, stack:react, stack:csharp]\nskip: ["split-build"]\n---\n\n# SLICE-903\n\n## Acceptance Criteria\n- demo\n',
    "utf8"
  );
  try {
    const result = await classifySlice({ slicePath: tmp });
    expect(result.SPLIT_BUILD).toBe(false);
  } finally {
    await unlink(tmp).catch(() => {
      /* ignore cleanup errors */
    });
  }
});

// FEAT-170 SLICE-C — single-stack routing signals
test("classifySlice: BE_ONLY true when only backend tags present", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/single-stack-demo.md"
  });
  expect(result.SPLIT_BUILD).toBe(false);
  expect(result.BE_ONLY).toBe(true);
  expect(result.FE_ONLY).toBe(false);
});

test("classifySlice: FE_ONLY true when only frontend tags present", async () => {
  const tmp = `tests/fixtures/slices/fe-only-demo-${process.pid}-${Date.now()}.md`;
  const { writeFile, unlink } = await import("node:fs/promises");
  await writeFile(
    tmp,
    "---\nslice: SLICE-904\ntags: [surface:ui, stack:react]\n---\n\n# SLICE-904\n\n## Acceptance Criteria\n- demo\n",
    "utf8"
  );
  try {
    const result = await classifySlice({ slicePath: tmp });
    expect(result.SPLIT_BUILD).toBe(false);
    expect(result.FE_ONLY).toBe(true);
    expect(result.BE_ONLY).toBe(false);
  } finally {
    await unlink(tmp).catch(() => {
      /* ignore cleanup errors */
    });
  }
});

test("classifySlice: both BE_ONLY and FE_ONLY false when no surface tags", async () => {
  const tmp = `tests/fixtures/slices/untagged-demo-${process.pid}-${Date.now()}.md`;
  const { writeFile, unlink } = await import("node:fs/promises");
  await writeFile(
    tmp,
    "---\nslice: SLICE-905\ntags: [doc]\n---\n\n# SLICE-905\n\n## Acceptance Criteria\n- demo\n",
    "utf8"
  );
  try {
    const result = await classifySlice({ slicePath: tmp });
    expect(result.SPLIT_BUILD).toBe(false);
    expect(result.FE_ONLY).toBe(false);
    expect(result.BE_ONLY).toBe(false);
  } finally {
    await unlink(tmp).catch(() => {
      /* ignore cleanup errors */
    });
  }
});

test("classifySlice: BE_ONLY and FE_ONLY both false when SPLIT_BUILD true", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/split-build-demo.md"
  });
  expect(result.SPLIT_BUILD).toBe(true);
  expect(result.FE_ONLY).toBe(false);
  expect(result.BE_ONLY).toBe(false);
});

// isShortSlice tests
test("isShortSlice: acCount ≤ 6, changedFilesCount > 10 → true (AC count alone qualifies)", () => {
  expect(isShortSlice({ acCount: 4, changedFilesCount: 15 })).toBe(true);
});

test("isShortSlice: acCount > 6, changedFilesCount ≤ 10 → true (file count alone qualifies)", () => {
  expect(isShortSlice({ acCount: 8, changedFilesCount: 7 })).toBe(true);
});

test("isShortSlice: acCount ≤ 6, changedFilesCount ≤ 10 → true (both qualify)", () => {
  expect(isShortSlice({ acCount: 3, changedFilesCount: 5 })).toBe(true);
});

test("isShortSlice: acCount > 6, changedFilesCount > 10 → false (neither qualifies)", () => {
  expect(isShortSlice({ acCount: 9, changedFilesCount: 12 })).toBe(false);
});

test("isShortSlice: acCount = 6, changedFilesCount = 10 → true (boundary: both at limit)", () => {
  expect(isShortSlice({ acCount: 6, changedFilesCount: 10 })).toBe(true);
});

test("isShortSlice: acCount = 7, changedFilesCount = 11 → false (boundary: both just over)", () => {
  expect(isShortSlice({ acCount: 7, changedFilesCount: 11 })).toBe(false);
});

test("isShortSlice: acCount = 4, changedFilesCount = 5, crossPlugin: true → false (cross-plugin override)", () => {
  expect(isShortSlice({ acCount: 4, changedFilesCount: 5, crossPlugin: true })).toBe(false);
});

// FEAT-170 SLICE-C — pure-TS-tooling routing (BE-default for untagged tooling slices)
test("classifyChangedFiles: TS_TOOLING_ONLY true for pure .ts script/test files", () => {
  const result = classifyChangedFiles([
    "scripts/orchestrate-slice-classify.ts",
    "tests/orchestrate-slice.test.ts",
    "evals/agents/crew-fullstack-dev.yaml"
  ]);
  expect(result.TS_TOOLING_ONLY).toBe(true);
});

test("classifyChangedFiles: TS_TOOLING_ONLY false when any .tsx file present", () => {
  const result = classifyChangedFiles(["scripts/lib/foo.ts", "src/components/Button.tsx"]);
  expect(result.TS_TOOLING_ONLY).toBe(false);
});

test("classifyChangedFiles: TS_TOOLING_ONLY false when any .css file present", () => {
  const result = classifyChangedFiles(["tests/foo.test.ts", "src/styles/theme.css"]);
  expect(result.TS_TOOLING_ONLY).toBe(false);
});

test("classifyChangedFiles: TS_TOOLING_ONLY false for empty file list", () => {
  const result = classifyChangedFiles([]);
  expect(result.TS_TOOLING_ONLY).toBe(false);
});

test("classifySlice: TS_TOOLING_ONLY true when changedFiles are all TS tooling", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/single-stack-demo.md",
    changedFiles: ["scripts/orchestrate-slice-classify.ts", "tests/orchestrate-slice.test.ts"]
  });
  expect(result.TS_TOOLING_ONLY).toBe(true);
});

test("classifySlice: TS_TOOLING_ONLY false when changedFiles include .tsx (mixed BE+FE)", async () => {
  const result = await classifySlice({
    slicePath: "tests/fixtures/slices/split-build-demo.md",
    changedFiles: ["src/api/things.ts", "src/components/ThingList.tsx"]
  });
  expect(result.TS_TOOLING_ONLY).toBe(false);
});
