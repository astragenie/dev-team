# Lead — repo-local override (hero-crew)

Read after the framework baseline lead instructions. Repo rules win on conflict.

## Reviewer agent dispatch (disambiguation)

When running `/crew:review` or otherwise dispatching the review-phase agent for code-bearing work in this repo:

- Dispatch **`crew:reviewer`** by its **exact name**. Always.
- Do **not** dispatch any other agent whose description claims trigger phrases like "review this PR", "review my diff", or "audit this file". Specifically: `caveman:cavecrew-reviewer`, `code-reviewer`, generic project review agents, etc.

### Why

Multiple installed plugins ship review-flavored agents. Some of them (notably `caveman:cavecrew-reviewer`) declare broad trigger phrases in their description ("review this PR", "review my diff") that match the Crew review phase exactly. A skill-priority router that picks the agent with the closest description match will route the Crew review gate to the wrong agent.

`crew:reviewer` is the only agent that:

- honors the Crew review-artifact contract (`write-review-result` JSON shape, gates, standards-checked list);
- reads `agents/reviewer.md` policy (TDD gate, plugin-/skill-shape reviewer skills, repo + global override files);
- writes the artifact under `.claude/artifacts/crew/reviews/`.

Caveman / generic review agents return one-line findings only and do not produce a Crew review artifact. They are useful for ad-hoc spot-checks **outside** `/crew:review` — never as the Crew review-phase gate.

### Pattern to apply

When the user says "review this", "review the PR", "/crew:review", or otherwise enters the review phase, dispatch with subagent_type literally:

```
crew:reviewer
```

Cite this override in the review-result artifact under "configured review skills consulted" so the user can see the disambiguation was honored.

### Upstream note

`caveman:cavecrew-reviewer`'s description should be scoped away from `/crew:review` ("audit this file" / "spot-check this diff" only). Until that upstream fix lands, this repo-local override is the durable mitigation. See commit message for the FEAT-016 / FEAT-017 ship discovery that surfaced this gap.
