# `.claude/loop.json` schema

Consumer repos declare workflow integration details in `.claude/loop.json`.

## Integration keys (FEAT-E)

```json
{
  "stack": {
    "run": {
      "fe": {
        "command": "npm run dev",
        "port": 5173,
        "ready_url": "http://localhost:5173",
        "disable_mocks_env": "VITE_USE_MSW",
        "timeout_ms": 30000
      },
      "be": {
        "command": "dotnet run --project apps/api",
        "port": 5000,
        "health_url": "http://localhost:5000/health",
        "compose_file": null,
        "timeout_ms": 30000
      }
    },
    "integration": {
      "env_required": ["DATABASE_URL", "JWT_SIGNING_KEY"]
    }
  }
}
```

| Key | Purpose |
|---|---|
| `stack.run.fe.command` | Process command for FE dev server. Integrator spawns this. Required when SPLIT_BUILD. |
| `stack.run.fe.port` | Port FE binds. Used for pre-flight free-port check. Required. |
| `stack.run.fe.ready_url` | URL integrator probes for FE readiness. Optional; TCP port check used otherwise. |
| `stack.run.fe.disable_mocks_env` | Env var the integrator sets to false to disable MSW. Optional; defaults to `VITE_USE_MSW`. |
| `stack.run.fe.timeout_ms` | Readiness timeout. Optional; defaults to 30000. |
| `stack.run.be.command` | Process command for BE. Required when SPLIT_BUILD. |
| `stack.run.be.port` | Port BE binds. Required. |
| `stack.run.be.health_url` | URL integrator probes for BE readiness. Required. |
| `stack.run.be.compose_file` | Docker compose file path if BE needs containerized services. Integrator does NOT auto-down. |
| `stack.run.be.timeout_ms` | Readiness timeout. Optional; defaults to 30000. |
| `stack.integration.env_required` | Array of env var names. Pre-flight fails if any are unset. |
