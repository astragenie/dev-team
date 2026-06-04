// Verb-keyword classification for an AC text.
// Returns one of: "interaction", "visibility", "navigation", "input",
// or "non_ui_ac" when no verb set matches. Case-insensitive.

const SETS = [
  { name: "interaction", verbs: ["click", "tap", "press", "submit"] },
  { name: "visibility", verbs: ["see", "render", "renders", "display", "displays", "show", "shows"] },
  { name: "navigation", verbs: ["navigate", "go to", "route"] },
  { name: "input", verbs: ["type", "fill", "enter"] }
];

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
