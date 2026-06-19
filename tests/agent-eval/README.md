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
nightly CI in SLICE-D. See `.claude/artifacts/loop/backlog/done/FEAT-162.md`.

## SLICE-B input contract — `claude -p --output-format stream-json` shape

Real-world reference: `fixtures/captured-traces/real-claude-p-stream.jsonl` (a real
30-event capture from `claude -p "say hello" --output-format stream-json --verbose`).

The raw stream is JSONL. Each event has a top-level `type` field:

| `type` | Notes |
|---|---|
| `system` (`subtype: hook_started` / `hook_response` / `hook_progress` / `init` / `notification`) | Session lifecycle; ignored by `CapturedTrace` parser |
| `user` | User messages; flatten `message.content` text into `events[]` as `{type: "text", ...}` |
| `assistant` | Assistant turns; `message.content[]` is an array of `{type: "text" \| "tool_use", ...}` blocks |
| `result` (`subtype: success` / `error`) | Terminator with `result` (`finalText`), `duration_ms`, `total_cost_usd`, `modelUsage` |
| `rate_limit_event` | Informational; not in `CapturedTrace` |

### nested → flat transform (SLICE-B parser contract)

The `CapturedTrace.events[]` abstraction is FLAT: top-level `{type: "tool_use", name, id, input}` and `{type: "text", text}` items. The real stream has those NESTED inside `assistant.message.content[]`. The SLICE-B `runClaude` parser MUST:

1. Read JSONL line-by-line.
2. For each `assistant` event, expand `message.content[]` — each entry becomes one item in `CapturedTrace.events[]` preserving the original `id` and `input` fields verbatim.
3. For each `user` event with a text body, append a `{type: "text"}` entry.
4. Drop `system/*` and `rate_limit_event` from the abstraction (preserve session_id + uuid only for traceability).
5. On `result/success`, set `CapturedTrace.exitCode = 0`, `finalText = result`, `usage = modelUsage[<model>]` (matches our cost-report schema fields verbatim — `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUSD`).
6. On `result/error`, set `exitCode = 1`, `finalText = result || ""`, preserve `is_error` + `api_error_status`.

The synthetic `00-builder-handoff.trace.json` represents the OUTPUT of this transform (the abstraction the assert helpers operate on), NOT the input. SLICE-B's job is to write the transformer that converts `real-claude-p-stream.jsonl` shape → `00-builder-handoff.trace.json` shape.

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
