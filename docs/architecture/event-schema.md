# Crew Event Schema

## Purpose

Crew writes append-only JSONL events so runs are inspectable and future tooling can replay them.

Current primary log:

- `.claude/logs/events.jsonl`

Current payload directory:

- `.claude/logs/payloads/`

## Current Event Shape

Each line in `events.jsonl` is a JSON object with this shape:

```json
{
  "schemaVersion": "1.0",
  "source": "crew",
  "timestamp": "2026-04-04T20:08:10Z",
  "event": "session_start",
  "repoPath": "/absolute/path/to/repo",
  "payloadPath": "/absolute/path/to/repo/.claude/logs/payloads/20260404T200810Z-60312-session_start.json"
}
```

## Current Required Fields

- `schemaVersion`
- `source`
- `timestamp`
- `event`
- `repoPath`
- `payloadPath`

## Event Names In Use

- `session_start`
- `task_created`
- `task_completed`
- `subagent_start`
- `subagent_stop`
- `teammate_idle`

The exact set depends on which hooks are configured and which events Claude Code emits during a run.

## Payload Files

Each event may also have a payload file under `.claude/logs/payloads/`.

These payloads are:

- raw hook input when available
- useful for debugging edge cases
- not the primary human-facing status surface

## Planned Optional Fields

As Crew evolves, later schema versions may add:

- `sessionId`
- `runId`
- `taskId`
- `role`
- `summary`
- `artifactPath`
- `owner`
- `status`

These are intentionally not required yet because the current prototype does not consistently produce them.

## Design Principles

1. Logs should be append-only.
2. Event objects should stay small.
3. Human-readable state belongs in artifacts and summaries, not only in low-level logs.
4. The schema should be stable enough for future visualization or replay tooling.
5. Repo path should be explicit so logs remain understandable outside the live session.
