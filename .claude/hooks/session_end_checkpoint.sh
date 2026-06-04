#!/usr/bin/env bash
# Crew session-end checkpoint — fires only when action is needed.
# Replaces the unconditional Stop prompt hook that fired every turn.
#
# Fires (exit 2) when:
#   1. Working tree is dirty (uncommitted changes)
#   2. Active workflow run has pending badges (gates explicitly required but unresolved)
#   3. Active workflow run has a run-brief but no final-synthesis and handoffs exist
#
# Silent (exit 0) when none of the above apply.

REPO="${PWD}"
WF_STATE="$REPO/.claude/state/workflow-state.json"

# 1. Dirty working tree?
DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null)
if [ -n "$DIRTY" ]; then
  echo "CREW SESSION-END CHECKPOINT [uncommitted changes]"
  echo "Run 'git status --short'. Commit or note as intentional WIP."
  exit 2
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
    echo "CREW SESSION-END CHECKPOINT [pending gates: $PENDING]"
    echo "Resolve or skip via mark-badge before stopping."
    exit 2
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
    echo "CREW SESSION-END CHECKPOINT [synthesis missing]"
    echo "Active run has run-brief + handoffs but no final-synthesis. Write one or note as intentional WIP."
    exit 2
  fi
fi

# All clear — silent stop
exit 0
