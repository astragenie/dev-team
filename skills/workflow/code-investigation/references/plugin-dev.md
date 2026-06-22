# Claude Code plugin investigation first-checks

Read-only heuristics for investigating plugin repos (this one included):
manifests, agents, skills, commands, hooks, routing. Cite file:line.

## 1. Manifest & wiring

- `.claude-plugin/marketplace.json` — what consumers actually receive: pinned
  versions, plugin list. A "feature missing for users" investigation starts
  here, not in source. Version drift between `package.json` and
  `marketplace.json` is a known release-bug class.
- Component auto-discovery: does the file live where the loader looks
  (`agents/`, `skills/<tier>/<name>/SKILL.md`, `commands/`)? A "skill never
  triggers" report is often a placement or name-mismatch issue.

## 2. Agent prompt quality (when the question is "why does agent X misbehave")

- Frontmatter `description:` — is it trigger-shaped (when to dispatch) or just
  a label? Weak descriptions cause wrong/no routing by the dispatcher.
- `disallowedTools` vs the prompt's claimed constraints — a "read-only" agent
  with open Bash can still mutate; check both layers.
- `model:` / `maxTurns:` vs the work shape — exploration on an expensive model
  or 10-turn cap on a deep-trace job explains cost/quality anomalies.
- Line count vs governance cap (≤300, `scripts/validate-agents.ts`) — specifics
  belong in skills the agent loads on demand, not inlined.

## 3. Skill quality (when the question is "why doesn't this skill fire / help")

- Frontmatter: `name` matches directory, `tier` in enum, `description` contains
  the trigger phrases a user would actually type (`scripts/validate-skills.ts`
  enforces structure; triggering quality is judgment).
- Body ≤200 lines; overflow detail belongs in `references/*.md` loaded on
  demand — a bloated body is itself a finding.
- Tier placement: `universal` (always) / `workflow` (per phase) / `domain`
  (stack-matched) / `meta` (the OS). Wrong tier = wrong discoverability.

## 4. Routing consistency

- `docs/routing-table.md` is authoritative. For any "who handles X"
  investigation, diff the table row against the agent prompts that claim the
  duty — drift between table and prompt is a recurring defect class.
- External-plugin skill references (context7, microsoft-docs, plugin-dev:\*) —
  verify the referenced skill still exists in the installed plugin version.

## 5. Hooks & scripts

- Hooks must stay small and auditable; a hook embedding business logic is a
  shape violation worth flagging regardless of the original question.
- Hook exit behavior: in async hooks, `process.exit(0)` truncates pending I/O
  (see DEC-011 — use `stdin.resume()` + return).
- Validator scripts are hard CI gates; reproduce a CI failure locally with the
  exact gate command from `.github/workflows/test.yml` before theorizing.

## Citation pattern

`agents/reviewer.md:12 (verified-in-code): description lacks dispatch triggers — dispatcher routing relies on prose match; correlates with missed-dispatch reports in .claude/artifacts/crew/runs/.`
