import test from "node:test";
import assert from "node:assert/strict";
import { extractACs } from "../scripts/lib/ux-validation/index.mjs";

test("extractACs returns empty array on empty input", () => {
  assert.deepEqual(extractACs(""), []);
});

test("extractACs returns empty array when no acceptance criteria header", () => {
  const content = "# Title\n\nNo ACs here.";
  assert.deepEqual(extractACs(content), []);
});

test("extractACs parses well-formed AC list", () => {
  const content = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: form validates email
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "user can click submit" },
    { id: "AC-2", text: "form validates email" }
  ]);
});

test("extractACs ignores nested checkboxes", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: parent criterion
  - [ ] sub-bullet should be ignored
- [ ] AC-2: another criterion
`;
  assert.deepEqual(extractACs(content), [
    { id: "AC-1", text: "parent criterion" },
    { id: "AC-2", text: "another criterion" }
  ]);
});

test("extractACs stops at next ## header", () => {
  const content = `## Acceptance criteria

- [ ] AC-1: first

## Out of scope

- [ ] not-an-ac: ignored
`;
  assert.deepEqual(extractACs(content), [{ id: "AC-1", text: "first" }]);
});

import { classifyScenario } from "../scripts/lib/ux-validation/index.mjs";

test("classifyScenario detects interaction verbs", () => {
  assert.equal(classifyScenario("user can click submit"), "interaction");
  assert.equal(classifyScenario("tap the button"), "interaction");
  assert.equal(classifyScenario("press enter to submit"), "interaction");
  assert.equal(classifyScenario("submit the form"), "interaction");
});

test("classifyScenario detects visibility verbs", () => {
  assert.equal(classifyScenario("see the welcome banner"), "visibility");
  assert.equal(classifyScenario("renders product list"), "visibility");
  assert.equal(classifyScenario("displays error message"), "visibility");
  assert.equal(classifyScenario("shows loading spinner"), "visibility");
});

test("classifyScenario detects navigation verbs", () => {
  assert.equal(classifyScenario("navigate to /dashboard"), "navigation");
  assert.equal(classifyScenario("go to settings page"), "navigation");
  assert.equal(classifyScenario("route to /profile"), "navigation");
});

test("classifyScenario detects input verbs", () => {
  assert.equal(classifyScenario("type email address"), "input");
  assert.equal(classifyScenario("fill username field"), "input");
  assert.equal(classifyScenario("enter password"), "input");
});

test("classifyScenario falls back to non_ui_ac on no match", () => {
  assert.equal(classifyScenario("total cost equals sum"), "non_ui_ac");
  assert.equal(classifyScenario("database row count is 3"), "non_ui_ac");
  assert.equal(classifyScenario(""), "non_ui_ac");
});

test("classifyScenario matches inflected verb forms", () => {
  assert.equal(classifyScenario("user navigates to /home"), "navigation");
  assert.equal(classifyScenario("user clicks the submit button"), "interaction");
  assert.equal(classifyScenario("user fills the username field"), "input");
  assert.equal(classifyScenario("form submits successfully"), "interaction");
});

test("classifyScenario does not over-match compound words", () => {
  assert.equal(classifyScenario("showcase the portfolio"), "non_ui_ac");
  assert.equal(classifyScenario("element is clickable"), "non_ui_ac");
  assert.equal(classifyScenario("pressing concern"), "non_ui_ac");
});

test("classifyScenario does not over-match derived visibility words", () => {
  assert.equal(classifyScenario("renderable content is available"), "non_ui_ac");
  assert.equal(classifyScenario("content was displayed successfully"), "non_ui_ac");
});

test("classifyScenario does not over-match derived navigation words", () => {
  assert.equal(classifyScenario("navigational menu is accessible"), "non_ui_ac");
  assert.equal(classifyScenario("router configuration loaded"), "non_ui_ac");
});

test("classifyScenario does not over-match derived input words", () => {
  assert.equal(classifyScenario("typecheck passes without errors"), "non_ui_ac");
  assert.equal(classifyScenario("fillable field is present"), "non_ui_ac");
});

import { computeVerdict } from "../scripts/lib/ux-validation/index.mjs";

const EMPTY_EVIDENCE = {
  ac_results: [],
  a11y: { violations: [], passes_count: 0 },
  console: { errors: [], warnings: [] },
  network: { failures: [] },
  visual: { diffs: [] }
};

test("computeVerdict returns passed on empty evidence", () => {
  assert.equal(computeVerdict(EMPTY_EVIDENCE), "passed");
});

test("computeVerdict returns failed when any AC fails", () => {
  const ev = { ...EMPTY_EVIDENCE, ac_results: [{ id: "AC-1", status: "fail" }] };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on serious a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "serious", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on critical a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "critical", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on console errors", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: ["TypeError"], warnings: [] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns failed on visual diff over tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 5.0, tolerance: 0.5 }] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns passed_with_notes on minor a11y", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "minor", rule: "x" }], passes_count: 0 }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns passed_with_notes on console warnings", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: [], warnings: ["React: ..."] }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns passed_with_notes on network failures", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    network: { failures: [{ url: "/x.png", status: 404 }] }
  };
  assert.equal(computeVerdict(ev), "passed_with_notes");
});

test("computeVerdict returns failed when both fail and warn signals present", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    ac_results: [{ id: "AC-1", status: "fail" }],
    console: { errors: [], warnings: ["minor"] }
  };
  assert.equal(computeVerdict(ev), "failed");
});

test("computeVerdict returns passed when visual diff under tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 0.2, tolerance: 0.5 }] }
  };
  assert.equal(computeVerdict(ev), "passed");
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPlaywrightConfig } from "../scripts/lib/ux-validation/index.mjs";

async function tmpRepo(prefix) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("discoverPlaywrightConfig returns null when no config present", async () => {
  const repo = await tmpRepo("ux-disc-none-");
  assert.equal(await discoverPlaywrightConfig(repo), null);
});

test("discoverPlaywrightConfig reads URL from playwright.config.ts", async () => {
  const repo = await tmpRepo("ux-disc-ts-");
  await fs.writeFile(
    path.join(repo, "playwright.config.ts"),
    `export default { use: { baseURL: "http://localhost:4321" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:4321");
});

test("discoverPlaywrightConfig reads URL from playwright.config.js", async () => {
  const repo = await tmpRepo("ux-disc-js-");
  await fs.writeFile(
    path.join(repo, "playwright.config.js"),
    `module.exports = { use: { baseURL: "http://localhost:5555" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:5555");
});

test("discoverPlaywrightConfig falls back to package.json scripts when no config file", async () => {
  const repo = await tmpRepo("ux-disc-pkg-");
  await fs.writeFile(
    path.join(repo, "package.json"),
    JSON.stringify({
      name: "x",
      scripts: { dev: "next dev -p 3000", playwright: "playwright test" }
    })
  );
  const result = await discoverPlaywrightConfig(repo);
  assert.equal(result.url, "http://localhost:3000");
});

test("discoverPlaywrightConfig returns null when config file lacks baseURL", async () => {
  const repo = await tmpRepo("ux-disc-no-url-");
  await fs.writeFile(path.join(repo, "playwright.config.ts"), `export default { use: {} };`);
  assert.equal(await discoverPlaywrightConfig(repo), null);
});

import { buildQaInvocation } from "../scripts/lib/ux-validation/index.mjs";

test("buildQaInvocation emits all 4 check flags", () => {
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [{ id: "AC-1", verb: "click", target: "button", expect: "ok" }],
    baselineDir: "tests/playwright/baselines/",
    outputPath: ".claude/artifacts/crew/validations/ux.json"
  });
  assert.match(cmd, /gstack:\/qa/);
  assert.match(cmd, /--url http:\/\/localhost:3000/);
  assert.match(cmd, /--scenarios /);
  assert.match(cmd, /--accessibility-scan/);
  assert.match(cmd, /--capture-console/);
  assert.match(cmd, /--capture-network/);
  assert.match(cmd, /--visual-baseline tests\/playwright\/baselines\//);
  assert.match(cmd, /--output \.claude\/artifacts\/crew\/validations\/ux\.json/);
});

test("buildQaInvocation embeds scenarios as JSON", () => {
  const cmd = buildQaInvocation({
    url: "http://x",
    scenarios: [{ id: "AC-1" }, { id: "AC-2" }],
    baselineDir: "b/",
    outputPath: "o.json"
  });
  assert.match(cmd, /"AC-1"/);
  assert.match(cmd, /"AC-2"/);
});
