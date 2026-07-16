import { test, expect } from "bun:test";
import { extractACs } from "../scripts/lib/ux-validation/index.ts";

test("extractACs returns empty array on empty input", () => {
  expect(extractACs("")).toEqual([]);
});

test("extractACs returns empty array when no acceptance criteria header", () => {
  const content = "# Title\n\nNo ACs here.";
  expect(extractACs(content)).toEqual([]);
});

test("extractACs parses well-formed AC list", () => {
  const content = `# Slice
## Acceptance criteria

- [ ] AC-1: user can click submit
- [ ] AC-2: form validates email
`;
  expect(extractACs(content)).toEqual([
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
  expect(extractACs(content)).toEqual([
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
  expect(extractACs(content)).toEqual([{ id: "AC-1", text: "first" }]);
});

import { classifyScenario } from "../scripts/lib/ux-validation/index.ts";

test("classifyScenario detects interaction verbs", () => {
  expect(classifyScenario("user can click submit")).toBe("interaction");
  expect(classifyScenario("tap the button")).toBe("interaction");
  expect(classifyScenario("press enter to submit")).toBe("interaction");
  expect(classifyScenario("submit the form")).toBe("interaction");
});

test("classifyScenario detects visibility verbs", () => {
  expect(classifyScenario("see the welcome banner")).toBe("visibility");
  expect(classifyScenario("renders product list")).toBe("visibility");
  expect(classifyScenario("displays error message")).toBe("visibility");
  expect(classifyScenario("shows loading spinner")).toBe("visibility");
});

test("classifyScenario detects navigation verbs", () => {
  expect(classifyScenario("navigate to /dashboard")).toBe("navigation");
  expect(classifyScenario("go to settings page")).toBe("navigation");
  expect(classifyScenario("route to /profile")).toBe("navigation");
});

test("classifyScenario detects input verbs", () => {
  expect(classifyScenario("type email address")).toBe("input");
  expect(classifyScenario("fill username field")).toBe("input");
  expect(classifyScenario("enter password")).toBe("input");
});

test("classifyScenario falls back to non_ui_ac on no match", () => {
  expect(classifyScenario("total cost equals sum")).toBe("non_ui_ac");
  expect(classifyScenario("database row count is 3")).toBe("non_ui_ac");
  expect(classifyScenario("")).toBe("non_ui_ac");
});

test("classifyScenario matches inflected verb forms", () => {
  expect(classifyScenario("user navigates to /home")).toBe("navigation");
  expect(classifyScenario("user clicks the submit button")).toBe("interaction");
  expect(classifyScenario("user fills the username field")).toBe("input");
  expect(classifyScenario("form submits successfully")).toBe("interaction");
});

test("classifyScenario does not over-match compound words", () => {
  expect(classifyScenario("showcase the portfolio")).toBe("non_ui_ac");
  expect(classifyScenario("element is clickable")).toBe("non_ui_ac");
  expect(classifyScenario("pressing concern")).toBe("non_ui_ac");
});

test("classifyScenario does not over-match derived visibility words", () => {
  expect(classifyScenario("renderable content is available")).toBe("non_ui_ac");
  expect(classifyScenario("content was displayed successfully")).toBe("non_ui_ac");
});

test("classifyScenario does not over-match derived navigation words", () => {
  expect(classifyScenario("navigational menu is accessible")).toBe("non_ui_ac");
  expect(classifyScenario("router configuration loaded")).toBe("non_ui_ac");
});

test("classifyScenario does not over-match derived input words", () => {
  expect(classifyScenario("typecheck passes without errors")).toBe("non_ui_ac");
  expect(classifyScenario("fillable field is present")).toBe("non_ui_ac");
});

import { computeVerdict } from "../scripts/lib/ux-validation/index.ts";

const EMPTY_EVIDENCE = {
  ac_results: [],
  a11y: { violations: [], passes_count: 0 },
  console: { errors: [], warnings: [] },
  network: { failures: [] },
  visual: { diffs: [] }
};

test("computeVerdict returns passed on empty evidence", () => {
  expect(computeVerdict(EMPTY_EVIDENCE)).toBe("passed");
});

test("computeVerdict returns failed when any AC fails", () => {
  const ev = { ...EMPTY_EVIDENCE, ac_results: [{ id: "AC-1", status: "fail" }] };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns failed on serious a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "serious", rule: "x" }], passes_count: 0 }
  };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns failed on critical a11y violation", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "critical", rule: "x" }], passes_count: 0 }
  };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns failed on console errors", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: ["TypeError"], warnings: [] }
  };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns failed on visual diff over tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 5.0, tolerance: 0.5 }] }
  };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns passed_with_notes on minor a11y", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    a11y: { violations: [{ severity: "minor", rule: "x" }], passes_count: 0 }
  };
  expect(computeVerdict(ev)).toBe("passed_with_notes");
});

test("computeVerdict returns passed_with_notes on console warnings", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    console: { errors: [], warnings: ["React: ..."] }
  };
  expect(computeVerdict(ev)).toBe("passed_with_notes");
});

test("computeVerdict returns passed_with_notes on network failures", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    network: { failures: [{ url: "/x.png", status: 404 }] }
  };
  expect(computeVerdict(ev)).toBe("passed_with_notes");
});

test("computeVerdict returns failed when both fail and warn signals present", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    ac_results: [{ id: "AC-1", status: "fail" }],
    console: { errors: [], warnings: ["minor"] }
  };
  expect(computeVerdict(ev)).toBe("failed");
});

test("computeVerdict returns passed when visual diff under tolerance", () => {
  const ev = {
    ...EMPTY_EVIDENCE,
    visual: { diffs: [{ route: "/", pct: 0.2, tolerance: 0.5 }] }
  };
  expect(computeVerdict(ev)).toBe("passed");
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPlaywrightConfig } from "../scripts/lib/ux-validation/index.ts";

async function tmpRepo(prefix: string) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("discoverPlaywrightConfig returns null when no config present", async () => {
  const repo = await tmpRepo("ux-disc-none-");
  expect(await discoverPlaywrightConfig(repo)).toBe(null);
});

test("discoverPlaywrightConfig reads URL from playwright.config.ts", async () => {
  const repo = await tmpRepo("ux-disc-ts-");
  await fs.writeFile(
    path.join(repo, "playwright.config.ts"),
    `export default { use: { baseURL: "http://localhost:4321" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  expect(result!.url).toBe("http://localhost:4321");
});

test("discoverPlaywrightConfig reads URL from playwright.config.js", async () => {
  const repo = await tmpRepo("ux-disc-js-");
  await fs.writeFile(
    path.join(repo, "playwright.config.js"),
    `module.exports = { use: { baseURL: "http://localhost:5555" } };`
  );
  const result = await discoverPlaywrightConfig(repo);
  expect(result!.url).toBe("http://localhost:5555");
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
  expect(result!.url).toBe("http://localhost:3000");
});

test("discoverPlaywrightConfig returns null when config file lacks baseURL", async () => {
  const repo = await tmpRepo("ux-disc-no-url-");
  await fs.writeFile(path.join(repo, "playwright.config.ts"), `export default { use: {} };`);
  expect(await discoverPlaywrightConfig(repo)).toBe(null);
});

import { buildQaInvocation } from "../scripts/lib/ux-validation/index.ts";

test("buildQaInvocation emits all 4 check flags", () => {
  const cmd = buildQaInvocation({
    url: "http://localhost:3000",
    scenarios: [{ id: "AC-1", verb: "click", target: "button", expect: "ok" }],
    baselineDir: "tests/playwright/baselines/",
    outputPath: ".claude/artifacts/crew/validations/ux.json"
  });
  expect(cmd).toMatch(/gstack:\/qa/);
  expect(cmd).toMatch(/--url http:\/\/localhost:3000/);
  expect(cmd).toMatch(/--scenarios /);
  expect(cmd).toMatch(/--accessibility-scan/);
  expect(cmd).toMatch(/--capture-console/);
  expect(cmd).toMatch(/--capture-network/);
  expect(cmd).toMatch(/--visual-baseline tests\/playwright\/baselines\//);
  expect(cmd).toMatch(/--output \.claude\/artifacts\/crew\/validations\/ux\.json/);
});

test("buildQaInvocation embeds scenarios as JSON", () => {
  const cmd = buildQaInvocation({
    url: "http://x",
    scenarios: [{ id: "AC-1" }, { id: "AC-2" }],
    baselineDir: "b/",
    outputPath: "o.json"
  });
  expect(cmd).toMatch(/"AC-1"/);
  expect(cmd).toMatch(/"AC-2"/);
});
