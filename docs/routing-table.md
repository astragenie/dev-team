# Routing Table

Prescriptive heuristic map that the lead consults at session start to classify incoming work and dispatch to the right role(s). Each row maps an observed signal (task type, pattern, or condition) to a destination role and workflow guidance.

Anything ambiguous, blocked, or spanning multiple tiers routes to **lead** for re-scoping.

---

| Signal | Route to | Notes |
|---|---|---|
| **New feature request** (FEAT-*, `feat:` in title) | lead + builder | Lead refines scope, sketches acceptance; builder picks up bounded implementation. Pair with `/crew:build` to auto-select bounded skills. |
| **Urgent bug fix** (`fix:` commits, production-impacting) | lead + validator | Lead triages and scopes; builder fixes in isolation; validator confirms behavior before merge. May skip reviewer if fix is trivial, but document the decision. |
| **Code quality / simplification** (refactor, lint, complexity cuts) | reviewer + builder | Builder owns refactor; reviewer gates the changes. Tests must stay green. No behavioral change expected. |
| **Documentation-only change** (docs, README, guides) | lead (optional review) | No behavioral change; minimal quality gate needed. Helpful to spot gaps but not blocking. |
| **Dependency updates / chore** (chore:, version bump, marketplace sync) | deployer + reviewer | Deployer or lead owns the change; reviewer validates no silent breakage. Post-merge, deployer confirms artifact/plugin registration is live. |
| **Ambiguous scope** (unclear where to start, spans multiple modules) | lead | Re-scope task, define boundaries, then dispatch to builder. Use `/crew:using-crew` to frame the work. |
| **Cross-module / architectural refactor** (touches 5+ files, changes public API) | lead | Too large for single builder. Lead shapes the plan; consider splitting into smaller FEATs or slices. |
| **Validation or behavior verification needed** (user-facing behavior changed, or tests added) | validator | Run the app, verify user-visible behavior, document evidence. Pair with `/verify` skill. |
| **Ship or release** (merge, promote to production, tag release) | deployer + lead approval | Deployer owns the push; lead explicitly approves production-bound changes. Validation must be complete. |
| **Production promotion** (any deployment to prod, customer environments, live traffic) | lead (explicit human approval required) | **Always** require explicit human sign-off before production-bound work merges or ships. No automation here. |
| **Reviewer feedback / code quality gate** (PR review needed, lint check, "review this PR", "review my diff") | **`crew:reviewer` agent** (exact name) | Reviewer gates all code-bearing changes before merge. Feedback written as inline PR comments when possible. **Do not dispatch `caveman:cavecrew-reviewer`, `code-reviewer`, or other generically-named review agents for crew review phase** — they have overlapping trigger phrases ("review this PR") but do not honor the Crew review-artifact contract or `agents/reviewer.md` policy. Use them only for ad-hoc spot-checks outside `/crew:review`. |
| **Session start / work planning** (new task, unclear next steps) | lead | Retrieve bounded context with `/crew:brief-me`. Define scope, assign to role, set pace. Avoid ambiguity at start. |
| **Cost analysis or optimization** (expensive operations, token burn investigation) | researcher (read-only) + lead decision | Researcher investigates and reports; lead decides on action (optimize, accept, defer). |
| **Blocked work or escalation** (dependency unmet, config broken, ambiguous requirements) | lead | Unblock by re-scoping, deferring, or escalating to stakeholder. Document the blocker in repo memory. |
| **Library / API uncertainty** ("is method X still supported?", "current docs for Y", touching unfamiliar npm package, unsure of signature) | researcher / builder via **context7 MCP** | Call `context7.resolve-library-id` then `context7.get-library-docs` before recommending or editing. If context7 has no coverage for the library, fall back to general web docs rather than retrying. Pairs with `microsoft-docs:microsoft-code-reference` for MS-tech. Server pinned in `.mcp.json`. |
| **Plugin shape change** (diff touches `.claude-plugin/marketplace.json`, `plugin.json`, `agents/`, `commands/`, `hooks/`, or `.mcp.json`) | reviewer via **`plugin-dev:plugin-validator`** | Reviewer invokes `plugin-dev:plugin-validator` for manifest + structure review *alongside* the local CI gate `node ./scripts/validate-manifests.mjs` (the latter is hard-fail). Cite both in the review-result artifact. |
| **Skill shape change** (diff touches any `skills/**/SKILL.md`) | reviewer via **`plugin-dev:skill-reviewer`** | Reviewer invokes `plugin-dev:skill-reviewer` for triggering-effectiveness + best-practice feedback, plus `node ./scripts/validate-skills.mjs` for the structural quality bar (tier, ≤200 lines, required headings). Both required when skills change. |

---

## Usage

1. **At session start**: Lead or validator retrieves bounded context with `crew:brief-me`.
2. **Incoming work**: Classify the signal using the table above.
3. **Route to role**: Dispatch with clear scope boundary; cite this table in the handoff.
4. **Ambiguous or cross-cutting**: Route to **lead** for re-scoping instead of improvising scope.
5. **Production-bound**: Always escalate to explicit human approval (lead) before promoting.

## Design principles

- **One role per task** except for brief handoffs (lead + builder, reviewer + deployer).
- **Explicit is better than implicit** — ambiguous signal always goes to lead.
- **No LLM router** — use heuristics + human judgment.
- **Humans stay in control of production** — no automation for live-customer promotions.
