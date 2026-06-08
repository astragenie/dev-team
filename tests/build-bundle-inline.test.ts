import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { inlineLatestBundle } from "../scripts/lib/build-bundle/inline.ts";
import { INLINE_HEADER, INLINE_TRUNCATION_WARNING } from "../scripts/lib/build-bundle/types.ts";

const MINIMAL_BUNDLE = `---
slice: SLICE-99
builder: builder-be
run_id: 20260608T223000Z
files_touched: ["a.ts"]
files_read: []
diff_stat: { files: 1, additions: 1, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

body

## Diff

\`\`\`diff
diff --git a/a.ts b/a.ts
\`\`\`

## Files touched

### a.ts
content
`;

async function makeBundleRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "inline-test-"));
}

async function writeBundle(
  root: string,
  slice: string,
  filename: string,
  body: string
): Promise<string> {
  const dir = path.join(root, slice);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, filename);
  await fs.writeFile(file, body, "utf8");
  return file;
}

test("inlineLatestBundle: returns header + body when bundle present", async () => {
  const root = await makeBundleRoot();
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", MINIMAL_BUNDLE);

  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.startsWith(INLINE_HEADER));
  assert.ok(result.includes("body"));
});

test("inlineLatestBundle: empty string when no bundle present", async () => {
  const root = await makeBundleRoot();
  await fs.mkdir(path.join(root, "SLICE-99"), { recursive: true });
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: empty when frontmatter unparseable", async () => {
  const root = await makeBundleRoot();
  await writeBundle(
    root,
    "SLICE-99",
    "builder-20260608T223000Z-build-bundle.md",
    "no-frontmatter-just-text\n"
  );
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: empty when schema_version too high", async () => {
  const root = await makeBundleRoot();
  const body = MINIMAL_BUNDLE.replace("schema_version: 1", "schema_version: 999");
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", body);
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root,
    supportedSchemaVersion: 1
  });
  assert.equal(result, "");
});

test("inlineLatestBundle: alphabetically-last filename wins on identical mtime tiebreak", async () => {
  const root = await makeBundleRoot();
  const aPath = await writeBundle(
    root,
    "SLICE-99",
    "builder-a-build-bundle.md",
    MINIMAL_BUNDLE.replace("body", "first")
  );
  const bPath = await writeBundle(
    root,
    "SLICE-99",
    "builder-b-build-bundle.md",
    MINIMAL_BUNDLE.replace("body", "second")
  );
  // Force identical mtime within the 1-second window.
  const now = new Date();
  await fs.utimes(aPath, now, now);
  await fs.utimes(bPath, now, now);

  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.includes("second"));
  assert.ok(!result.includes("first"));
});

test("inlineLatestBundle: truncation warning appended when bundle is size-capped", async () => {
  const root = await makeBundleRoot();
  const body = MINIMAL_BUNDLE.replace("truncated: false", "truncated: true").replace(
    "truncation_reason: null",
    "truncation_reason: size-cap"
  );
  await writeBundle(root, "SLICE-99", "builder-20260608T223000Z-build-bundle.md", body);
  const result = await inlineLatestBundle({
    sliceId: "SLICE-99",
    bundlesRoot: root
  });
  assert.ok(result.includes(INLINE_TRUNCATION_WARNING));
});
