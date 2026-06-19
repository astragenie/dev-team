---
id: FEAT-165
status: done
started_at: 2026-06-19
priority: P2
category: observability
target_release: null
created: 2026-06-19
depends_on: []
slices: [SLICE-77]
derived_from: null
tags: [observability, otel, langfuse, hooks, telemetry, subscription-billed]
slices_complete: [SLICE-77, SLICE-81]
completed_at: 2026-06-19
updated: 2026-06-19
---
# FEAT-165: Langfuse + OpenTelemetry trace bridge — production-grade observability for slice runs

## Description

Today the plugin emits cost reports under `.claude/artifacts/crew/cost/`,
handoffs under `handoffs/`, and JSONL streams (`dispatch-timing.jsonl`,
`bash-gates.jsonl`) added by FEAT-149/150/151. Useful per-slice; opaque
across slices.

There is no unified trace view that lets a maintainer answer:
- "Why did this slice take 14 minutes when the last one took 6?"
- "Which agent regressed on review_rework_rate over the last 20 runs?"
- "Did the new reviewer prompt cause more tool calls or fewer?"
- "Which slice cost the most tokens this week and where did they go?"

OpenTelemetry traces emitted from Claude Code hooks give the timeline +
parent-child structure for free. Langfuse ingests OTLP natively
(`/api/public/otel/v1/traces`) — one SDK, one exporter, **Langfuse +
any OTel backend** (Tempo, Jaeger, SigNoz, Honeycomb) at once.

Langfuse is the chosen primary backend because:

- self-hostable (Docker compose) → no PII to a third party
- native LLM-trace schema (`generation` spans with `usage.input_tokens`,
  `usage.cache_read`, `usage.cache_creation`, `cost.usd`)
- prompt-version diff UI (used by FEAT-167)
- dataset/eval-result ingestion (used by FEAT-167)
- free tier exists for early validation; production self-host later

## Acceptance hints

### Trace structure

- **Root span** = slice run, attrs: `feat_id`, `slice_id`, `run_id`,
  `branch`, `started_at`
- **Phase spans** = `build` / `review` / `validate` / `deploy`,
  attrs: `gate`, `outcome`
- **Agent dispatch spans** = `crew:builder` / `crew:inspector` /
  `crew:verifier` etc., attrs: `agent`, `model`, `prompt_id`,
  `prompt_version` (filled by FEAT-167), `usage.input_tokens`,
  `usage.output_tokens`, `usage.cache_read_tokens`,
  `usage.cache_creation_tokens`, `cost.usd`
- **Events on agent span**: `handoff_written`, `tool_call` (name + ms),
  `bash_gate` (cmd + exit_code + ms)

### Components

- `scripts/lib/telemetry/otel-bridge.ts` — reads hook stdin
  (PreToolUse / PostToolUse / Stop / SubagentStop), emits OTLP spans
  via `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`.
- `scripts/lib/telemetry/cost-report-to-spans.ts` — converts existing
  cost-report fields into `generation` spans for slices that ran
  before the bridge was enabled (backfill).
- `.claude/crew/telemetry.yaml` — config: `enabled`, `endpoint`,
  `auth`, `sample_rate`, `scrub_pii`, `redact_paths`.
- `.claude/hooks/*` — wire bridge entry into PostToolUse + Stop +
  SubagentStop hooks. **Default disabled** — opt-in via env var
  `CREW_OTEL_ENABLED=1`.
- `scripts/setup-langfuse-self-host.ts` — optional helper that
  prints docker-compose snippet for local Langfuse + first-run keys.
- `docs/observability/langfuse-bridge.md` — usage, schema, opt-in flow.

### Design constraints

- **Default OFF.** No traces emitted unless `CREW_OTEL_ENABLED=1`. Plugin
  has no runtime → no surprise network calls.
- **PII scrub.** Tool-call inputs (prompts, diffs) often carry repo
  contents. `scrub_pii: true` (default) runs a redaction pass on
  span attributes that exceed N chars OR match a `redact_paths` glob.
- **Subscription only.** Bridge never calls `api.anthropic.com`. Token
  + cost numbers come from existing cost reports; bridge only
  reshapes for export.
- **Hook latency budget.** Bridge must add ≤50ms p95 to each hook
  (measured). Use BatchSpanProcessor with `maxQueueSize: 2048`.
- **Plugin obs ceiling** (`project_plugin_observability_ceiling`): this
  FEAT is *about* observability infrastructure, so the heavyweight
  shape is the deliverable — the ceiling rule does not apply here.

### Per-slice decomposition suggestion

- **SLICE-A** (autonomous_safe=true): cost-report → span backfill. No
  hooks touched. Run on completed slice cost reports, write
  `.claude/artifacts/crew/spans/<run_id>.jsonl`. Schema validation.
- **SLICE-B** (autonomous_safe=false): live hook bridge for
  PostToolUse + Stop + SubagentStop. OTLP HTTP exporter. Config loader.
  Local Langfuse via docker-compose validated by reviewer.
- **SLICE-C** (autonomous_safe=false): PII scrub + redaction tests +
  CI gate that runs bridge in dry-run against fixture hooks.

### Out of scope

- Metrics + logs exporters (OTel signals beyond traces). Future FEAT
  if Langfuse trace coverage proves insufficient.
- Production-hosted Langfuse SaaS — self-host only for v1.
- Cross-repo trace correlation (companion plugins) — single repo.

## Notes

- Related: FEAT-159 (rolling stats aggregator) — complementary. Stats
  artifact can be emitted as a Langfuse score on the slice root span
  once both ship.
- Memory: [[project-obs-evals-workflow-plan]] captures sequencing.
- Reference: Langfuse OTel docs at langfuse.com/docs/integrations/opentelemetry.
