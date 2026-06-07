type ScenarioType = "interaction" | "visibility" | "navigation" | "input" | "non_ui_ac";

interface ScenarioSet {
  name: Exclude<ScenarioType, "non_ui_ac">;
  verbs: readonly string[];
}

const SETS: ReadonlyArray<ScenarioSet> = [
  {
    name: "interaction",
    verbs: ["click", "clicks", "clicked", "tap", "taps", "press", "presses", "submit", "submits"]
  },
  {
    name: "visibility",
    verbs: ["see", "render", "renders", "display", "displays", "show", "shows"]
  },
  { name: "navigation", verbs: ["navigate", "navigates", "go to", "goes to", "route", "routes"] },
  { name: "input", verbs: ["type", "types", "fill", "fills", "enter", "enters"] }
];

export function classifyScenario(acText: string): ScenarioType {
  if (!acText) return "non_ui_ac";
  const lower = acText.toLowerCase();
  for (const { name, verbs } of SETS) {
    for (const v of verbs) {
      const re = new RegExp(`\\b${v}\\b`, "i");
      if (re.test(lower)) return name;
    }
  }
  return "non_ui_ac";
}
