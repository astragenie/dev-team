---
name: integration-smoke
prompt_id: integration-smoke
version: 1.0.0
tier: workflow
description: Procedure for live wire-up smoke test. Spin up BE, spin up FE, exercise one happy-path AC against real wire, validate responses against OpenAPI schema, tear down, write PASS/FAIL artifact.
owner: hero-crew
last_reviewed: 2026-06-06
triggers: ["integrator agent dispatched after builder-fe + builder-be self-verify PASS in SPLIT_BUILD slice"]
---

# Integration smoke

## When to Use

You are `crew:integrator`. The lead has dispatched you because `SPLIT_BUILD = true`, both builders self-verified, and the slice has a happy-path AC that needs live wire-up proof. Run this procedure, then write the artifact.

## Inputs (from dispatch prompt)

- OpenAPI YAML path
- contracts.md path
- builder-fe handoff path
- builder-be handoff path
- slice file path
- happy_path_ac: the one AC text to exercise live

## Procedure

### 1. Pre-flight

Read `.claude/loop.json` `stack.integration.env_required` (array of env var names). For each:

- Check `process.env[<var>]` is set. If missing, write a `help_request` badge with `note "env var <var> not set"` + a `--confidence low` handoff. STOP.

Check `stack.run.fe.port` and `stack.run.be.port` are free. On occupied port, write `help_request` + STOP.

Check the OpenAPI YAML's `info.version` matches what the builders consumed (both handoffs should cite the same version). On mismatch, write `help_request` with note `"version drift: <fe-version> vs <be-version>"`. STOP.

### 2. Start BE

Read `.claude/loop.json` `stack.run.be.command`. Fallback: package.json `scripts.start:be`, `dotnet run`, `python -m uvicorn`, `go run ./...`.

Spawn in background. Wait for health check (`stack.run.be.health_url`, default `http://localhost:<port>/health`) to return 200 within 30s (configurable via `stack.run.be.timeout_ms`).

On timeout, capture the last 50 lines of stdout/stderr, write a FAIL artifact, STOP.

### 3. Start FE

Read `stack.run.fe.command`. Fallback: package.json `scripts.start:fe`, `vite`, `next dev`.

Set `VITE_USE_MSW=false` (or the consumer-repo equivalent declared in `stack.run.fe.disable_mocks_env`). Spawn in background. Wait for ready signal: TCP port reachable + optional `stack.run.fe.ready_url` returns 200.

On timeout, capture logs, write FAIL artifact, STOP.

### 4. Exercise the happy-path AC

The AC names operations (via the UX spec's `## API touchpoints` or directly in the AC text). For each operation involved:

- **For `surface:ui` slices**: drive Playwright (or `@playwright/test`) headless against the FE URL. Use the operation's example payload as form input where applicable. Capture a DOM snapshot at the success state.
- **For `surface:api`-only slices**: execute the operation directly via `fetch` against the BE URL. Request body = operation's example payload.

For every HTTP response observed, run a runtime OpenAPI validator against the operation's schema:

- Node: `openapi-response-validator` package, OR `ajv` configured against `components.schemas` extracted from the YAML.
- Use the YAML parsed via the `yaml` library (already a dep).

Shape mismatch fails the smoke even if status code is correct. Record exact mismatch.

### 5. Tear down

Send SIGTERM to FE process; wait up to 5s; SIGKILL if still alive.
Send SIGTERM to BE process; wait up to 10s (DB connection close); SIGKILL.

If the BE depends on Docker services (declared in `stack.run.be.compose_file`), don't auto-`docker compose down` — that may belong to other test runs. Leave it. Note in the artifact.

### 6. Write the artifact

Path: `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`

Content includes: Outcome PASS/FAIL, Happy-path AC text, Versions, Evidence (BE/FE startup, HTTP trace, UI snapshot, BE log tail), Drift detected, Next.

## Done when

- Artifact written with PASS or FAIL
- Both processes torn down
- Either runtime-validator confirms all responses match schemas, OR drift documented with exact field paths
