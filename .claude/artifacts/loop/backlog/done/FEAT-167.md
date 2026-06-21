---
id: FEAT-167
status: done
started_at: 2026-06-19
completed_at: 2026-06-21
priority: P2
category: quality
target_release: null
created: 2026-06-19
updated: 2026-06-21
depends_on: [FEAT-162, FEAT-165]
slices: [SLICE-79]
slices_complete: [SLICE-79]
derived_from: null
tags: [prompt-versioning, agent-eval, langfuse, frontmatter, subscription-billed]
follow_up: FEAT-169
---

> **Scope-narrowed close (2026-06-21):** Only SLICE-A (frontmatter contract +
> validator extension + backfill) landed under this FEAT. The body's
> SLICE-B/C/D (eval runtime, Langfuse dataset emission, nightly CI) are
> superseded by **FEAT-169** which refines the design with a pluggable
> judge registry (Generic/Groq/claude-p/Ollama/Gemini + Azure/Bedrock
> validation tier). The subscription-only memory was loosened to permit
> free-tier APIs (Groq/Gemini/Cerebras) as judges — see
> `feedback_subscription_only_evals.md`.

# FEAT-167: Prompt ADR frontmatter + version tracking — trackable, observable, comparable agent + skill prompts

## Description

Agent + skill prompts change frequently. A v0.35.3 example: `## Integration
with Other Agents` block added to all 18 first-party agents. A v0.35.2
example: identity-anchor leak fixed in dispatched-subagent prompts. Each
of these is a prompt-version event with measurable behavioral implication,
but the repo today has:

- no `prompt_id` or `version` field on agent / skill prompts
- no way to query "which version of crew:inspector ran in run X?"
- no way to A/B compare two versions of the same prompt on the same
  fixture
- no way to detect a regression introduced by a prompt edit before it
  ships

This FEAT adds the *metadata* + *observability wiring* layer. Eval
*runtime* comes from FEAT-162 (`claude -p` + Bun fixtures), NOT
promptfoo / Inspect / DeepEval / Anthropic Evals SDK — per
[[feedback-subscription-only-evals]].

The eval *spec format* draws from promptfoo's mental model
(`prompts:`/`providers:`/`tests:`/`assert:`) so developers familiar
with it transfer cleanly. Comparison + diff UI comes free from
Langfuse datasets once FEAT-165 lands.

## Acceptance hints

### Frontmatter contract

Every `agents/**/*.md` and `skills/**/SKILL.md` gains:

```yaml
---
name: crew:inspector
version: 1.4.0
prompt_id: crew-inspector
model_pinned: claude-opus-4-7
evals: evals/agents/crew-inspector.yaml
changelog: docs/prompts/CHANGELOG-crew-inspector.md
---
```

- `version` follows semver-ish; minor for content addition, patch for
  wording polish.
- `prompt_id` is the stable identifier (used for OTel attr, dataset key).
- `evals` path is optional but **required when the prompt is
  user-visible behavior** (builder, reviewer, validator, deployer,
  lead). Enforced by `scripts/validate-agents.ts`.
- `changelog` is optional; if present must exist on disk.

### Eval spec format (per agent / skill)

`evals/agents/crew-inspector.yaml`:

```yaml
prompt_id: crew-inspector
versions_under_test:
  - file://agents/crew/inspector.md     # current
  - file://agents/crew/inspector.md@v1.3.0   # prior tag (optional)

provider: claude-pdash         # FEAT-162 runner
                                # = `claude -p` + Bun fixtures, subscription-billed

tests:
  - name: blocker-on-null-deref
    fixture: file://evals/fixtures/null-deref.diff
    assert:
      - type: contains
        value: "[BLOCKER]"
      - type: not-contains
        value: "[NIT]"
      - type: llm-rubric
        rubric: "Identifies the line-42 null-deref risk explicitly"

  - name: no-blocker-on-clean-rename
    fixture: file://evals/fixtures/clean-rename.diff
    assert:
      - type: not-contains
        value: "[BLOCKER]"
```

Vocab (`contains`/`not-contains`/`regex`/`llm-rubric`/`artifact-exists`)
mirrors promptfoo. `llm-rubric` is implemented as a second `claude -p`
call asking "did the response satisfy: <rubric>" with binary answer
parsing — still subscription-billed.

### Components

- `evals/` tree mirroring `agents/` + `skills/{universal,workflow,domain,meta}/`.
- `evals/lib/run-eval.ts` — loads YAML eval spec, invokes FEAT-162
  `run-claude.ts`, runs asserts, writes Langfuse dataset run.
- `evals/lib/llm-rubric.ts` — subscription self-judge helper.
- `evals/fixtures/*.diff` and `*.fixture.ts` — input artifacts.
- `scripts/validate-agents.ts` — extend with `prompt_id` + `version`
  + (when agent role is build/review/validate/deploy/lead) `evals:`
  presence check. Existing line-cap + frontmatter checks preserved.
- `scripts/validate-skills.ts` — same extension for SKILL.md files.
- OTel attr injection: dispatcher reads `prompt_id` + `version` from
  frontmatter when emitting agent-dispatch spans (FEAT-165). Attrs
  become Langfuse-searchable.
- New CI gate (advisory first):
  `bun run evals --filter-changed-prompts` — runs evals only for
  agents/skills whose `version` field changed in the diff. Promoted
  to blocking after 2-week stability baseline.
- `docs/prompts/README.md` — versioning policy + changelog convention.

### Design constraints

- **Subscription only.** Every eval invocation goes through FEAT-162
  `claude -p` substrate. Zero per-token API spend.
- **Default off in CI** — `evals` job runs on label `run-evals` and
  nightly; not on every PR (rate-limit budget per [[feedback-subscription-only-evals]]).
- **Fuzzy asserts only.** Real LLM output = nondeterministic. No
  exact-string asserts on free text. Exact only for structured
  artifact fields.
- **Dataset key stability.** Langfuse dataset uses `prompt_id` as
  key, not file path. Renames preserve history.
- **`evals:` field optional for non-behavioral prompts** (e.g. doc-
  writer that emits Markdown only). Validator gates by agent role.

### Per-slice decomposition suggestion

- **SLICE-A** (autonomous_safe=false — prompt authorship):
  frontmatter contract + validator extension + `prompt_id` +
  `version: 1.0.0` backfilled on all 18 first-party agents + every
  SKILL.md. Pure metadata. No eval runtime.
- **SLICE-B** (autonomous_safe=false — depends_on FEAT-162 SLICE-A):
  `evals/` tree scaffold + dry-run eval (replay captured trace) +
  3 reference eval specs (crew:builder, crew:inspector, crew:verifier).
- **SLICE-C** (autonomous_safe=false — depends_on FEAT-165 SLICE-B):
  Langfuse dataset emission + diff UI walkthrough doc + OTel attr
  injection. CI gate advisory.
- **SLICE-D** (autonomous_safe=false): nightly eval job + CI gate
  promotion to blocking. Depends on FEAT-162 SLICE-D (OAuth in CI).

### Out of scope

- API-billed eval providers (promptfoo / Inspect / DeepEval /
  Anthropic Evals SDK) — explicitly rejected, see
  [[feedback-subscription-only-evals]].
- `agents/3rdparty/` — upstream imports.
- Multi-turn eval scenarios — single-prompt-to-completion only.
- Prompt migration tooling for breaking changes — deferred.

## Notes

- Sister FEATs: 165 (Langfuse+OTel — provides UI + OTel attrs) +
  166 (Workflow YAML — independent). See
  [[project-obs-evals-workflow-plan]].
- SLICE-A is parallel-implementable now. SLICE-B onwards blocks on
  FEAT-162 SLICE-A landing first.
- Promptfoo influence: spec shape + assertion vocab + comparison UX
  expectation. Promptfoo runtime explicitly out.
- Versioning policy: edit a prompt = bump `version`. Validator
  enforces. CI annotates which prompts changed in PR description.
