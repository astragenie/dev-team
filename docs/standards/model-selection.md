# Model selection — Sonnet by default for slice work (FEAT-031)

## Rule

For SLICE work dispatched to a teammate (`crew:builder`,
`crew:reviewer`, `crew:validator`, `crew:deployer`, `crew:researcher`),
recommend **Sonnet** unless one of three conditions holds:

1. **Ambiguous architecture** — design is open in the spec.
2. **Hard refactor** — change spans ≥3 files with cross-cutting concerns
   or touches load-bearing abstractions.
3. **Design choice required** — agent must pick between plausible
   approaches with non-obvious trade-offs.

The rule does NOT govern the lead's own model. Lead stays on Opus
(framing, synthesis, user communication, judgment calls).

## Why

Recent cost reports across this repo:

| Model | Slices | Messages | USD | $ per slice |
|---|---|---|---|---|
| `claude-opus-4-7` | 3 | 3,458 | $1,821 | ~$607 |
| `claude-sonnet-4-6` | 5 | 4,911 | $277 | ~$55 |

Sonnet is ~10x cheaper per slice for work that, by post-hoc inspection,
was mechanical. The default-on-whatever-model-opened-the-session
pattern was wasting that lever.

## 5-dimension slice-shape scoring

A slice is **mechanical** (Sonnet) when at least 4 of the 5 dimensions
below are concrete in the spec:

| Dimension | Mechanical (Sonnet) | Ambiguous (Opus) |
|---|---|---|
| 1. Files | Named in the spec | "Touch what needs touching" |
| 2. Test signatures | Listed or derivable | Open ended |
| 3. Acceptance criteria | Numbered, testable | Vague "improve X" |
| 4. Architecture | Pattern stated, module chosen | Decision pending |
| 5. Scope discipline | "Out of scope" enumerated | Implicit |

If 4 of 5 are concrete, the agent is executing a plan, not authoring
one. Sonnet handles it. Opus is reserved for the cases where the agent
has to make architectural decisions on the fly.

## How to surface the recommendation

The lead writes the run-brief at slice start. Include the recommendation
in the run-brief body — either via a `Recommended Model: <sonnet|opus>`
line in the summary, or via `--next "Dispatch crew:builder with
model: <sonnet|opus>"`.

When dispatching the subagent, pass `model: "sonnet"` or `model: "opus"`
on the Agent tool call. The default falls through to the agent's
frontmatter, which is `sonnet` for builder / reviewer / validator /
researcher / deployer — so an empty `model` field is implicitly
Sonnet-default already. The explicit recommendation matters because:

- It lets the user override before the dispatch fires.
- It documents the choice for `cost-report.modelMix` review later.
- It surfaces ambiguous specs early — if you can't decide which model,
  the spec needs more framing first.

## How to override

User can override the recommendation by typing the preferred model in
the conversation before the lead dispatches, or by editing the
run-brief artifact. Lead respects the override silently.

## Measurement

`cost-report.modelMix` slice-over-slice. After FEAT-031 ships, track:

- Opus share of slice messages: target ≤30% across the trailing 5
  mechanical slices.
- Opus USD share: target ≤50% (Opus is dearer per token, so the USD
  share lags the message share).

If Opus share creeps back above target across 5+ slices, the rule is
being ignored. Revisit the dimension scoring — the spec criteria may
be too lax.

## Related

- `feedback_cost_discipline.md` — original rule statement.
- `agents/lead.md` `### Model-selection gate at slice start (FEAT-031)`
  subsection — the operational rule.
- `docs/routing-table.md` — slice-open signal routes to this rule.
