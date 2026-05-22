// Post-install welcome message shape consumed by the CLI as the human-facing
// outro of bootstrap / init / install-global. Pure data — no I/O, no
// templates beyond the strings below.

export function buildWelcome({ mode, repoScoped = false }) {
  const commands = repoScoped
    ? ["/crew:brief-me", "/crew:build", "/crew:fix", "/crew:ship"]
    : ["/crew:init", "/crew:adopt", "/crew:brief-me"];

  const headlineByMode = {
    init: "Crew is now wired into this repo. Excellent judgment.",
    bootstrap: "This repo is now on Crew. Tasteful choice.",
    "install-global": "Crew global memory is installed. Bold and correct."
  };

  const optional = repoScoped
    ? [
        "Optional: /crew:install-commit-bridge to mint Crew artifacts from matching commits (installs a PostToolUse hook; skip if you don't want that)."
      ]
    : [];

  return {
    headline: headlineByMode[mode] || "Crew is ready.",
    commands,
    guidance: repoScoped
      ? "Start with /crew:brief-me for a quick situational report, then /crew:build or /crew:fix for real work."
      : "Use /crew:init for a new repo, /crew:adopt for an existing repo, and /crew:brief-me once a repo is wired in.",
    optional
  };
}
