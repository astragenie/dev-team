#!/usr/bin/env bash
set -euo pipefail

event_name="${1:-unknown}"
project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
log_dir="${project_dir}/.claude/logs"
payload_dir="${log_dir}/payloads"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
payload_path="${payload_dir}/${stamp}-$$-${event_name}.json"
events_path="${log_dir}/events.jsonl"

mkdir -p "$payload_dir"

# Capture stdin synchronously so the caller's pipe is drained.
if [ -t 0 ]; then
  stdin_payload='{}'
else
  stdin_payload="$(cat)"
fi

# Async-fire the disk writes — foreground returns in <20ms.
(
  printf '%s\n' "$stdin_payload" > "$payload_path"
  printf '{"schemaVersion":"1.0","source":"crew","timestamp":"%s","event":"%s","repoPath":"%s","payloadPath":"%s"}\n' \
    "$timestamp" \
    "$event_name" \
    "$project_dir" \
    "$payload_path" >> "$events_path"
) &
disown 2>/dev/null || true
