# Agent Eval Harness

## Purpose

The repo today has **no behavioral test layer for agents**. Structural validators
catch line-cap drift, frontmatter shape, and routing-table staleness; `e2e-smoke.ts`
exercises script and CLI logic. Neither verifies that a prompt change produces the
intended agent behavior. When an agent prompt changes, regressions like the
`Agent`-tool-misroute pattern reach production and are observed one slice at a time,
costing ~150k tokens per recurrence. This harness closes that gap using the
subscription-billed `claude -p --output-format stream-json` path — zero API spend.

## Status

SLICE-A landed (this commit). Dry-run replay only. Live `claude -p` lands in SLICE-B;
nightly CI in SLICE-D. See `.claude/artifacts/loop/backlog/in-progress/FEAT-162.md`.

## Running locally

```
bun run test:agents
```

The `test:agents` script sets `CREW_AGENT_EVAL=1` automatically.

## Adding a fixture

1. Write a `.fixture.ts` file exporting `default: Fixture` (see `lib/types.ts`).
2. Record or hand-author a captured trace under `fixtures/captured-traces/`.
3. Add the import to `run.test.ts`'s fixture array.
4. Run `bun run test:agents` to verify.

## Rate-limit math

Max plan approximately 200-800 messages per 5h window depending on tier. A fixture
suite of 10 scenarios x ~30 tool calls/turns each fits comfortably nightly but would
burn ~half a Pro window — hence the nightly-only stance.

## Prerequisites (SLICE-B onward)

- `claude login` OAuth completed on the runner.
- `claude plugin link <repo>` so the crew plugin is discoverable.
- `CREW_AGENT_EVAL=1` env var set.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No fixtures ran | `CREW_AGENT_EVAL` unset | Use `bun run test:agents` or set the env var. |
| `runClaude not implemented` | Running SLICE-A stub directly | SLICE-B not landed yet; use dry-run replay mode. |
| OAuth error | SLICE-B+ concern | Run `claude login` to re-authenticate. |
