---
id: FEAT-006
status: pending
priority: null
category: null
target_release: null
created: 2026-06-05
updated: 2026-06-05
depends_on: []
slices: []
derived_from: null
---
# FEAT-006: Tag-aware skill loading in builder, reviewer, and validator

When loop:pm-triage emits tags: frontmatter on a FEAT, lead maps tags to skills via the Tag-to-agent mapping table and instructs subagents in the dispatch handoff. If lead omits the instruction, subagents skip the domain skill silently. Fix: add a brief tag-to-skill cross-reference note to builder, reviewer, and validator agents so they can self-apply skill loading from feat-tag-schema.md even when the dispatch handoff omits it. Also make validator's qa/benchmark routing tag-explicit (surface:ui -> /qa; concern:performance -> /benchmark).