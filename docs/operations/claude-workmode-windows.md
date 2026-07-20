# Claude Work Mode On Windows

This profile is for running 3-4 Claude sessions on a 32 GB Windows machine without letting helper processes, Docker, or stale search jobs consume the machine.

## Resource Budget

Keep this budget when running 3-4 Claude sessions:

| Component | Recommended cap |
| --- | --- |
| Claude sessions | 3 active, 4 only when Docker is idle |
| Docker/WSL | 6 GB RAM, 4 CPUs |
| Dev servers/watchers | 1-2 active |
| Local LLM servers | Off |
| Available RAM target | 5-6 GB free |
| Paging threshold | `Pages/sec` under 500 sustained |

## WSL Settings

Use this in `C:\Users\milas\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
swap=4GB
autoMemoryReclaim=gradual
networkingMode=mirrored
```

Apply it with:

```powershell
wsl --shutdown
```

Use `memory=8GB` and `processors=6` only when Docker is the main workload.

## Process Priority Profile

Recommended priorities:

| Process | Priority | Reason |
| --- | --- | --- |
| `claude` | Normal | Keep agent sessions responsive |
| `codex` | Normal | Keep the active assistant responsive |
| `node`, `dotnet`, `bun`, `java`, `python` | BelowNormal | Prevent watchers/builds from starving sessions |
| `Docker Desktop`, `com.docker.backend` | BelowNormal | Keep Docker useful but bounded |
| `chrome`, `msedgewebview2`, `Slack`, `warp` | BelowNormal | Reduce background UI contention |
| `llama-server` | BelowNormal or off | Local inference competes directly with agents |

Run a dry-run first:

```powershell
.\scripts\windows\apply-claude-workmode.ps1
```

Apply priorities:

```powershell
.\scripts\windows\apply-claude-workmode.ps1 -Apply
```

Apply priorities and kill stale runaway `find`/`grep` jobs:

```powershell
.\scripts\windows\apply-claude-workmode.ps1 -Apply -KillStaleSearch
```

The cleanup only targets `find` and `grep` processes older than 30 minutes with more than 100,000 handles.

## Health Check

Before starting the 3rd or 4th Claude session:

```powershell
.\scripts\windows\claude-workmode-report.ps1
```

Rules:

- Available RAM above 6 GB: safe to add another Claude session.
- Available RAM between 3 and 6 GB: avoid Docker, builds, and local LLMs.
- Available RAM below 3 GB: do not add a session.
- `Pages/sec` above 500 sustained: close workloads before continuing.
- `find` or `grep` with huge CPU time or handle count: stop it.

## Daily Routine

1. Start fresh terminal sessions.
2. Run the health report.
3. Start Claude sessions.
4. Apply the process profile.
5. Keep Docker stopped unless needed.
6. Re-run the report after heavy builds or long searches.
