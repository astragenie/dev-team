import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WorkflowStateSchema } from "../scripts/lib/schemas.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(here, "fixtures", name), "utf8"));

test("WorkflowStateSchema accepts a valid empty state", () => {
  const result = WorkflowStateSchema.safeParse(fixture("workflow-state-valid.json"));
  expect(result.success).toBe(true);
});

test("WorkflowStateSchema rejects malformed state and reports issues", () => {
  const result = WorkflowStateSchema.safeParse(fixture("workflow-state-invalid.json"));
  expect(result.success).toBe(false);
  if (!result.success) {
    const codes = result.error.issues.map((i) => i.path.join(".")).sort();
    // version, updatedAt, currentRun, recentRuns all flagged
    expect(
      codes.includes("version"),
      `expected 'version' in issues: ${codes.join(", ")}`
    ).toBeTruthy();
    expect(
      codes.includes("updatedAt"),
      `expected 'updatedAt' in issues: ${codes.join(", ")}`
    ).toBeTruthy();
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
  expect(
    result.success,
    result.success
      ? ""
      : `live workflow-state.json failed schema: ${JSON.stringify(result.error.issues, null, 2)}`
  ).toBe(true);
});
