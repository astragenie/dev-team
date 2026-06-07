import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WorkflowStateSchema } from "../scripts/lib/schemas.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(here, "fixtures", name), "utf8"));

test("WorkflowStateSchema accepts a valid empty state", () => {
  const result = WorkflowStateSchema.safeParse(fixture("workflow-state-valid.json"));
  assert.equal(result.success, true);
});

test("WorkflowStateSchema rejects malformed state and reports issues", () => {
  const result = WorkflowStateSchema.safeParse(fixture("workflow-state-invalid.json"));
  assert.equal(result.success, false);
  if (!result.success) {
    const codes = result.error.issues.map((i) => i.path.join(".")).sort();
    // version, updatedAt, currentRun, recentRuns all flagged
    assert.ok(codes.includes("version"), `expected 'version' in issues: ${codes.join(", ")}`);
    assert.ok(codes.includes("updatedAt"), `expected 'updatedAt' in issues: ${codes.join(", ")}`);
  }
});

test("WorkflowStateSchema accepts the live repo workflow-state.json", () => {
  const liveStatePath = path.join(here, "..", ".claude", "state", "crew", "workflow-state.json");
  let raw: string;
  try {
    raw = readFileSync(liveStatePath, "utf8");
  } catch {
    // OK to skip if the file does not exist in a fresh clone
    return;
  }
  const result = WorkflowStateSchema.safeParse(JSON.parse(raw));
  assert.equal(
    result.success,
    true,
    result.success
      ? ""
      : `live workflow-state.json failed schema: ${JSON.stringify(result.error.issues, null, 2)}`
  );
});
