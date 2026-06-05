import { classifyScenario } from "./classify-scenario.mjs";

/** @typedef {{ step: number, verb: string, target: string, expect: string, ac_id: string | null }} ScenarioStep */

const JOURNEY_HEADER_RE = /^##\s+User Journey\s*$/i;
const NEXT_HEADER_RE = /^##\s+/;
const STEP_LINE_RE = /^\d+\.\s+(.+)$/;
const EXPECT_SPLIT_RE = /\s*→\s*expect:\s*/i;

/** @type {Record<string, number>} */
const CATEGORY_ORDER = { navigation: 0, input: 1, interaction: 2, visibility: 3 };

/**
 * @param {string} sliceContent
 * @returns {ScenarioStep[] | null}
 */
function parseUserJourney(sliceContent) {
  if (!sliceContent) return null;
  const lines = sliceContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => JOURNEY_HEADER_RE.test(l));
  if (startIdx === -1) return null;
  const steps = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (NEXT_HEADER_RE.test(line)) break;
    const m = STEP_LINE_RE.exec(line);
    if (!m) continue;
    const [actionPart, expectPart] = m[1].split(EXPECT_SPLIT_RE);
    const firstSpace = actionPart.indexOf(" ");
    const verb = (firstSpace === -1 ? actionPart : actionPart.slice(0, firstSpace)).toLowerCase();
    const target = firstSpace === -1 ? "" : actionPart.slice(firstSpace + 1).trim();
    const expect = expectPart ? expectPart.trim() : "no error / visible";
    steps.push({ step: steps.length + 1, verb, target, expect, ac_id: null });
  }
  return steps;
}

/**
 * @param {Array<{id: string, text: string}>} _acs
 * @returns {ScenarioStep[]}
 */
function deriveFromACs(_acs) {
  return []; // implemented in Task 2
}

/**
 * @param {Array<{id: string, text: string}>} acs
 * @param {string} sliceContent
 * @returns {ScenarioStep[]}
 */
export function buildJourney(acs, sliceContent) {
  const override = parseUserJourney(sliceContent);
  if (override !== null) return override;
  const derived = deriveFromACs(acs);
  return derived.length >= 2 ? derived : [];
}
