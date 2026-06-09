import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { collectOutcomeLinkage } from "../scripts/lib/outcome-linkage.ts";

const MINIMAL_GRADE = `---
slice: SLICE-99
review_rebound_count: 3
scores: null
---

# Grade for SLICE-99

## Scores

- architecture_quality: 0.8
- reliability: 0.7
- observability: 0.6
- production_readiness: 0.75
- security: 0.9
- test_confidence: 0.85
- product_completeness: 0.9
`;

const GRADE_NO_REBOUND = `---
slice: SLICE-99
---

# Grade for SLICE-99

## Scores

- architecture_quality: 0.5
`;

async function makeRepoWithGrade(gradeBody: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "outcome-linkage-"));
  await fs.mkdir(path.join(root, "docs", "grades"), { recursive: true });
  await fs.writeFile(path.join(root, "docs", "grades", "SLICE-99-grade.md"), gradeBody, "utf8");
  return root;
}

test("collectOutcomeLinkage: surfaces review_rebound_count when present", async () => {
  const repo = await makeRepoWithGrade(MINIMAL_GRADE);
  const result = await collectOutcomeLinkage(repo, "FEAT-999 SLICE-99");
  assert.equal(result.sliceId, "SLICE-99");
  assert.equal(result.reviewReboundCount, 3);
});

test("collectOutcomeLinkage: review_rebound_count null when absent from grade frontmatter", async () => {
  const repo = await makeRepoWithGrade(GRADE_NO_REBOUND);
  const result = await collectOutcomeLinkage(repo, "FEAT-999 SLICE-99");
  assert.equal(result.reviewReboundCount, null);
});

test("collectOutcomeLinkage: review_rebound_count is zero on first-try pass", async () => {
  const repo = await makeRepoWithGrade(
    MINIMAL_GRADE.replace("review_rebound_count: 3", "review_rebound_count: 0")
  );
  const result = await collectOutcomeLinkage(repo, "FEAT-999 SLICE-99");
  assert.equal(result.reviewReboundCount, 0);
});

test("collectOutcomeLinkage: rejects negative or non-numeric rebound counts", async () => {
  const repo = await makeRepoWithGrade(
    MINIMAL_GRADE.replace("review_rebound_count: 3", "review_rebound_count: notanumber")
  );
  const result = await collectOutcomeLinkage(repo, "FEAT-999 SLICE-99");
  assert.equal(result.reviewReboundCount, null);
});
