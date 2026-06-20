# Langfuse OTel Bridge — Usage and Opt-in Guide (FEAT-165)

## What this is

The Crew OTel bridge converts Claude Code hook payloads (PostToolUse, Stop,
SubagentStop) into OpenTelemetry spans and exports them to a self-hosted
Langfuse instance via OTLP HTTP. This gives you a unified trace view across
slice runs: which agents fired, how long each tool call took, and where cost
went. Langfuse ingests OTLP natively and adds an LLM-trace UI with
generation-level token breakdowns.

The bridge is subscription-only — it reshapes data from existing cost
reports and hook payloads. It never calls `api.anthropic.com`.

## Default safety posture

- **Default OFF.** Two-key opt-in required (see below). Neither key alone
  activates the bridge. An accidental `cp telemetry.example.yaml telemetry.yaml`
  without setting `enabled: true` is safe — `enabled: false` is the file default.
- **PII scrub on.** `scrub_pii: true` by default. Tool inputs, diffs, long
  strings (>2048 chars), and file paths matching `redact_paths` globs are
  redacted before export. See "What gets scrubbed" below.
- **Subscription-only.** The bridge endpoint MUST be a localhost or self-hosted
  Langfuse. It never calls `api.anthropic.com`.

## One-shot self-host setup

Run the setup helper to generate a docker-compose.yml and print instructions:

```sh
node ./scripts/setup-langfuse-self-host.ts
```

By default writes `./langfuse/docker-compose.yml`. Override with `--out <path>`.

The helper prints:
1. `docker compose -f ./langfuse/docker-compose.yml up -d`
2. First-run URL: `http://localhost:3000`
3. How to create a project + API key pair in the Langfuse UI
4. The exact env vars to export
5. How to copy and enable the config template

## Two-key opt-in flow

Both keys must be set. Either alone is insufficient.

**Key 1 — config file:**

```sh
cp .claude/crew/telemetry.example.yaml .claude/crew/telemetry.yaml
# Edit .claude/crew/telemetry.yaml and set: enabled: true
```

**Key 2 — environment variable:**

```sh
export LANGFUSE_AUTH_B64=$(echo -n "pk-lf-YOUR_KEY:sk-lf-YOUR_SECRET" | base64)
export CREW_OTEL_ENABLED=1
```

Verify both are active:

```sh
grep '^enabled:' .claude/crew/telemetry.yaml   # must print: enabled: true
echo "$CREW_OTEL_ENABLED"                       # must print: 1
```

## What gets emitted

Span names and key attributes:

| Span name | Hook | Key attributes |
|---|---|---|
| `tool_call` | PostToolUse | `tool.name`, `session.id`, `cwd`, scrubbed `tool_input.*` |
| `session.stop` | Stop | `session.id`, `reason` |
| `agent.dispatch` | SubagentStop | `agent`, `session.id` |

All spans use `kind: INTERNAL`. Spans ship with resource attrs
`service.name: "crew-plugin"` and `service.version: "<package version>"`.

Source: [`scripts/lib/telemetry/span.ts`](../../scripts/lib/telemetry/span.ts)

## What gets scrubbed

When `scrub_pii: true` (default), these attr keys are unconditionally
redacted to `<redacted:key>` regardless of length:

- `input.prompt`, `input.diff`, `input.content`, `input.code`, `input.text`
- `tool_input.content`, `tool_input.code`, `tool_input.text`, `tool_input.prompt`
- `tool_input.file_text`, `tool_input.new_string`, `tool_input.old_string`
- `tool_response`
- `last_assistant_message`

Additionally:
- String values longer than `redact_attr_max_chars` (default 2048) →
  `<redacted:length=N>` (length preserved so you know data existed)
- String values whose path matches a `redact_paths` glob →
  `<redacted:path>`

## Disabling

Either of the following alone is sufficient to disable the bridge:

```sh
# Option A — unset the env var (survives until next shell)
unset CREW_OTEL_ENABLED

# Option B — set enabled: false in config
# Edit .claude/crew/telemetry.yaml: enabled: false
```

The bridge checks both keys on every hook invocation. No restart needed.

## Subscription-only guarantee

The bridge only POSTs to the `endpoint` you configure (default:
`http://localhost:3000/api/public/otel/v1/traces`). It never calls
`api.anthropic.com`. Reviewer can confirm with:

```sh
grep -rn 'api.anthropic.com' scripts/lib/telemetry/ hooks/otel-*.ts
# Expected: zero matches
```

## Plugin-cache constraint — NO top-level `@opentelemetry/*` imports in the hook graph

Claude Code installs plugins to `~/.claude/plugins/cache/astra/crew/<version>/`.
The plugin loader does NOT guarantee `npm install` runs against the cache, and
in practice some consumer installs ship with `node_modules/` populated for
`yaml` + `zod` but missing `@opentelemetry/*` entirely. A top-level static
`import "@opentelemetry/api"` (or any other `@opentelemetry/*` package) in any
file statically reachable from `hooks/otel-*.ts` will then ENOENT on every
hook invocation — even on the disabled-telemetry path, because the import
resolves at module load before any runtime gate fires.

**Rule for contributors touching telemetry:**

- All `@opentelemetry/*` imports — including the `api` package — MUST be lazy
  (`await import("@opentelemetry/...")`) and MUST be gated behind
  `bridgeEnabled(cfg)` so the disabled path never resolves them.
- The `api` module is cached at module scope inside `otel-bridge.ts` as
  `cachedOtelApi` so the synchronous `emit*` functions can call into it without
  awaiting per-call. If `cachedOtelApi` is `null` (init never ran or deps
  missing), the emitters silently no-op.
- The lazy-import block wraps all dynamic imports in `try/catch`. On
  `MODULE_NOT_FOUND` it writes a one-shot friendly stderr line
  (`crew-otel: telemetry deps not installed, bridge disabled. Run \`npm i ...\`
  in this repo to enable.`) and returns `null`.

**Regression gate**: `tests/telemetry-plugin-cache-smoke.test.ts` copies the
hook + telemetry source tree to a temp dir, mirrors the repo `node_modules`
MINUS `@opentelemetry/*`, then spawns each hook subprocess on the default
disabled-telemetry path. Any stderr containing `@opentelemetry`, `ENOENT`, or
`MODULE_NOT_FOUND` fails the test. This catches any future top-level
`@opentelemetry/*` import in the hook graph before release.

This constraint exists because of the v0.37.1 → v0.37.2 hotfix
(commit `938df50`); see `CHANGELOG.md` v0.37.2 entry for the original incident.
