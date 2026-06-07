import { classifyScenario } from "./classify-scenario.ts";

type ScenarioStep = { step: number; verb: string; target: string; expect: string; ac_id: string | null };

const JOURNEY_HEADER_RE = /^##\s+User Journey\s*$/i;
const NEXT_HEADER_RE = /^##\s+/;
const STEP_LINE_RE = /^\d+\.\s+(.+)$/;
const EXPECT_SPLIT_RE = /\s*→\s*expect:\s*/i;

const CATEGORY_ORDER: Record<string, number> = { navigation: 0, input: 1, interaction: 2, visibility: 3 };

function parseUserJourney(sliceContent: string): ScenarioStep[] | null {
  if (!sliceContent) return null;
  const lines = sliceContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => JOURNEY_HEADER_RE.test(l));
  if (startIdx === -1) return null;
  const steps: ScenarioStep[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (NEXT_HEADER_RE.test(line)) break;
    const m = STEP_LINE_RE.exec(line);
    if (!m) continue;
    const [actionPart, expectPart] = m[1]!.split(EXPECT_SPLIT_RE);
    const firstSpace = actionPart!.indexOf(" ");
    const verb = (firstSpace === -1 ? actionPart! : actionPart!.slice(0, firstSpace)).toLowerCase();
    const target = firstSpace === -1 ? "" : actionPart!.slice(firstSpace + 1).trim();
    const expect = expectPart ? expectPart.trim() : "no error / visible";
    steps.push({ step: steps.length + 1, verb, target, expect, ac_id: null });
  }
  return steps;
}

function deriveFromACs(acs: Array<{ id: string; text: string }>): ScenarioStep[] {
  const uiACs = acs.filter((ac) => classifyScenario(ac.text) !== "non_ui_ac");
  if (uiACs.length === 0) return [];
  const sorted = [...uiACs].sort((a, b) => {
    const orderA = CATEGORY_ORDER[classifyScenario(a.text)] ?? 99;
    const orderB = CATEGORY_ORDER[classifyScenario(b.text)] ?? 99;
    return orderA - orderB;
  });
  return sorted.map((ac, i) => {
    const text = ac.text.trim();
    const firstSpace = text.indexOf(" ");
    const verb = (firstSpace === -1 ? text : text.slice(0, firstSpace)).toLowerCase();
    const target = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
    return { step: i + 1, verb, target, expect: "no error / visible", ac_id: ac.id };
  });
}

export function buildJourney(
  acs: Array<{ id: string; text: string }>,
  sliceContent: string
): ScenarioStep[] {
  const override = parseUserJourney(sliceContent);
  if (override !== null) return override;
  const derived = deriveFromACs(acs);
  return derived.length >= 2 ? derived : [];
}
