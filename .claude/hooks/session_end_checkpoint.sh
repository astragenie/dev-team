#!/usr/bin/env bash
# Crew session-end checkpoint — fires only when action is needed.
# Replaces the unconditional Stop prompt hook that fired every turn.
#
# Fires (exit 2) when:
#   1. Working tree is dirty (uncommitted changes)
#   2. Active workflow run has pending badges (gates explicitly required but unresolved)
#   3. Active workflow run has a run-brief but no final-synthesis and handoffs exist
#
# Per-session fire cap: a single Stop condition produces at most MAX_FIRES messages
# per Claude Code session (keyed on the latest session_start event in events.jsonl).
# Beyond the cap, this hook stays silent (exit 0) so the user is not spammed with
# the same checkpoint reminder repeatedly.
#
# Silent (exit 0) when none of the above apply, or when the per-session cap is hit.

REPO="${PWD}"
WF_STATE="$REPO/.claude/state/workflow-state.json"
MAX_FIRES=3

# Returns exit 0 when the hook should still fire (under the cap), exit 1 when capped.
# Side effect: increments the per-session counter, keyed on the latest session_start
# timestamp in events.jsonl. Paths are resolved via node's process.cwd() rather than
# bash interpolation because git-bash POSIX paths (/c/work/...) mis-resolve on
# Windows node (to C:\c\work\...).
under_fire_cap() {
  MAX_FIRES=$MAX_FIRES node --input-type=module 2>/dev/null <<'EOF'
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const cwd = process.cwd();
const eventsLog = join(cwd, '.claude', 'logs', 'events.jsonl');
const counterFile = join(cwd, '.claude', 'state', 'crew', 'stop-checkpoint.json');
const maxFires = Number(process.env.MAX_FIRES ?? 3);

let sessionTs = '';
try {
  const lines = readFileSync(eventsLog, 'utf8').trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(lines[i]);
      if (o.event === 'session_start') { sessionTs = o.timestamp; break; }
    } catch {}
  }
} catch {}

let state = { session: '', count: 0 };
try { state = JSON.parse(readFileSync(counterFile, 'utf8')); } catch {}

if (state.session !== sessionTs) state = { session: sessionTs, count: 0 };
state.count += 1;

try { mkdirSync(dirname(counterFile), { recursive: true }); } catch {}
try { writeFileSync(counterFile, JSON.stringify(state)); } catch {}

process.exit(state.count > maxFires ? 1 : 0);
EOF
}

emit() {
  if under_fire_cap; then
    echo "$1" >&2
    echo "$2" >&2
    exit 2
  fi
  exit 0
}

# 1. Dirty working tree?
DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null)
if [ -n "$DIRTY" ]; then
  emit "CREW SESSION-END CHECKPOINT [uncommitted changes]" \
       "Run 'git status --short'. Commit or note as intentional WIP."
fi

# 2. Pending badges in workflow state?
if [ -f "$WF_STATE" ]; then
  PENDING=$(node --input-type=module <<EOF 2>/dev/null
import { readFileSync } from 'fs';
try {
  const s = JSON.parse(readFileSync('$WF_STATE', 'utf8'));
  const badges = s.currentRun?.pendingBadges ?? [];
  if (badges.length > 0) process.stdout.write(badges.join(', '));
} catch {}
EOF
)
  if [ -n "$PENDING" ]; then
    emit "CREW SESSION-END CHECKPOINT [pending gates: $PENDING]" \
         "Resolve or skip via mark-badge before stopping."
  fi

  # 3. Substantial run in flight: run-brief exists, handoffs written, no final-synthesis?
  SUBSTANTIAL=$(node --input-type=module <<EOF 2>/dev/null
import { readFileSync } from 'fs';
try {
  const s = JSON.parse(readFileSync('$WF_STATE', 'utf8'));
  const r = s.currentRun;
  if (!r || r.status === 'completed') process.exit(0);
  const hasRunBrief = Boolean(r.artifacts?.runBrief);
  const hasHandoffs = (r.artifacts?.handoffs ?? []).length > 0;
  const noSynthesis = !r.artifacts?.finalSynthesis;
  if (hasRunBrief && hasHandoffs && noSynthesis) process.stdout.write('yes');
} catch {}
EOF
)
  if [ "$SUBSTANTIAL" = "yes" ]; then
    emit "CREW SESSION-END CHECKPOINT [synthesis missing]" \
         "Active run has run-brief + handoffs but no final-synthesis. Write one or note as intentional WIP."
  fi
fi

# All clear — silent stop
exit 0
