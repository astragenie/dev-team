# Agent Stats — per-agent rolling metrics (FEAT-159 SLICE-A)

This document covers the `agent-stats` aggregator: artifact shape, CLI invocation,
telemetry sources, and the intentional deferral of lead-consumer wiring.

## Artifact shape

Written to `.claude/artifacts/crew/agent-stats/<ISO8601Z>-agent-stats-<window-slug>.json`.

```json
{
  "generated_at": "2026-06-20T08:30:00.000Z",
  "window": { "kind": "last_n_slices", "n": 10 },
  "rows": [
    {
      "agent": "crew:builder",
      "window": "last_n_slices_10",
      "sample_count": 10,
      "pass_rate": 0.9,
      "mean_wall_ms": 47600,
      "mean_tokens": 44200,
      "review_rework_rate": 0.1,
      "validation_fail_rate": 0.0,
      "median_dispatches_to_pass": 1
    }
  ]
}
```

### Field semantics

| Field | Type | Meaning |
|---|---|---|
| `agent` | string | Agent role name (e.g. `crew:builder`, `crew:inspector`) |
| `window` | string | Window slug, e.g. `last_n_slices_10` |
| `sample_count` | number | Dispatch rows matched inside the window |
| `pass_rate` | 0..1 | Fraction of agent's slices whose avg grade score ≥ 0.7 |
| `mean_wall_ms` | number | Mean wall-clock time across dispatches in the window |
| `mean_tokens` | number | Mean `tokenIn + tokenOut` per dispatch |
| `review_rework_rate` | 0..1 | Fraction of agent's slices with ≥1 `needs_fix` review artifact |
| `validation_fail_rate` | 0..1 | Fraction of agent's slices with ≥1 `failed` validation artifact |
| `median_dispatches_to_pass` | number | Median dispatch count per slice for this agent |

Window kind `last_n_slices` is the only implemented variant. The `WindowSpec` type
is an open discriminated union so `last_n_days` can be added non-breakingly later.

## CLI invocation

```sh
node scripts/crew.ts agent-stats [--agent <name>] [--window last_n_slices:<N>] [--repo <path>]
```

### Defaults

| Flag | Default |
|---|---|
| `--window` | `last_n_slices:${CREW_AGENT_STATS_WINDOW \|\| 10}` |
| `--repo` | `process.cwd()` |
| `--agent` | absent → all agents present in the window |

### Environment

- `CREW_AGENT_STATS_WINDOW` — override default window size (integer, number of slices).

### Examples

```sh
# All agents, last 10 slices (default)
node scripts/crew.ts agent-stats --repo .

# Specific agent, last 20 slices
node scripts/crew.ts agent-stats --agent crew:builder --window last_n_slices:20 --repo .

# Environment override
CREW_AGENT_STATS_WINDOW=5 node scripts/crew.ts agent-stats --repo .
```

The CLI always writes the artifact (even when the result set is empty) and prints a
human-readable table to stdout. It returns the artifact path as a JSON string so
callers can capture it.

## Telemetry sources

The aggregator reads from three existing Phase 1 sources:

| Source | Path | Content |
|---|---|---|
| Dispatch timing | `.claude/logs/dispatch-timing.jsonl` | Per-dispatch wall-clock, tokens, tool-call counts |
| Grade artifacts | `.claude/artifacts/loop/grades/*.md` | Per-slice YAML frontmatter with scores + `graded_at` |
| Review artifacts | `.claude/artifacts/crew/reviews/*.md` | YAML frontmatter `verdict:` or body `Decision:` line |
| Validation artifacts | `.claude/artifacts/crew/validations/*.md` | Body `Decision:` line |

Missing or empty sources degrade gracefully — the aggregator catches file-not-found
errors and returns empty data rather than throwing.

### Seeding local fixtures for tests

Unit tests under `tests/agent-stats-aggregator.test.ts` use fixture files at
`tests/fixtures/agent-stats/` plus in-memory grade overrides to avoid touching
real repo artifacts. To seed your own fixtures:

```sh
# Capture a 5-slice dispatch-timing window
tail -n 100 .claude/logs/dispatch-timing.jsonl > tests/fixtures/agent-stats/dispatch-timing-seed.jsonl
```

## Lead consumer — intentionally NOT wired in this slice

As of SLICE-84, the lead agent does **not** read `agent-stats` artifacts at
slice-start. The follow-up slice (`autonomous_safe: false`) will wire the
artifact into `agents/lead.md` Step 3 (model/agent picking) after human-in-loop
review. This deferral keeps SLICE-84 `autonomous_safe: true` and avoids editing
`agents/lead.md` (which is governed as `autonomous_safe: false` per `CLAUDE.md`).
