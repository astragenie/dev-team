---
id: FEAT-039
title: "Tag-aware skill loading in builder, reviewer, and validator"
priority: P2
status: done
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: null
related: [FEAT-038]
phase: null
tags: ["stack:llm", "surface:docs", "concern:governance"]
github_issue: 55
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/55"
---
# FEAT-039 — Tag-aware skill loading in builder, reviewer, and validator

## Why

When `loop:pm-triage` emits `tags:` frontmatter on a FEAT, `crew:lead` maps those tags to
domain skills via the Tag-to-agent mapping table in `agents/lead.md` and instructs subagents
in the dispatch handoff. If the lead omits the instruction (or the handoff is hand-crafted),
the subagent silently skips the domain skill — there is no self-correction path.

Two specific gaps:
1. Builder and reviewer have no way to independently cross-check `docs/standards/feat-tag-schema.md`
   to confirm which domain skill to load from a `tags:` field in their dispatch.
2. Validator's references to `gstack /qa` and `gstack /benchmark` are not tag-explicit — an agent
   reading the prompt without the full routing-table context won't connect `surface:ui → /qa` or
   `concern:performance → /benchmark`.

## Approach

- Add a brief "Tag-driven skill loading" note to `agents/builder.md` and `agents/reviewer.md`:
  when the dispatch handoff cites `tags:`, cross-check `docs/standards/feat-tag-schema.md` to
  confirm the `stack:*` domain skill and any `concern:*` co-load skill.
- Update `agents/validator.md` `## Web UI scenarios` and `## Validation depth control` to make
  the tag→tool routing explicit: `surface:ui → /qa`, `concern:performance → /benchmark`.

No new CLI or schema — purely prompt edits.

## Acceptance criteria

- [ ] AC-1: `agents/builder.md` "Skills you consult" section includes a note linking `tags:` in dispatch → `feat-tag-schema.md` for domain-skill confirmation
- [ ] AC-2: `agents/reviewer.md` "Skills you consult" section includes the same cross-reference note
- [ ] AC-3: `agents/validator.md` `/qa` reference is tagged with `surface:ui` signal explicitly
- [ ] AC-4: `agents/validator.md` `/benchmark` reference is tagged with `concern:performance` signal explicitly
- [ ] AC-5: `node ./scripts/validate-agents.mjs` passes (≤300 lines per agent)
- [ ] AC-6: `npm run lint && npm run format:check` clean
