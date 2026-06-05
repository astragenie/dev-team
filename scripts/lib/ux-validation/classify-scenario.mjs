// Verb-keyword classification for an AC text.
// Returns one of: "interaction", "visibility", "navigation", "input",
// or "non_ui_ac" when no verb set matches. Case-insensitive.

/** @type {ReadonlyArray<{name: "interaction" | "visibility" | "navigation" | "input", verbs: readonly string[]}>} */
const SETS = [
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

/**
 * @param {string} acText
 * @returns {"interaction" | "visibility" | "navigation" | "input" | "non_ui_ac"}
 */
export function classifyScenario(acText) {
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
