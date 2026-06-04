#!/usr/bin/env bash
# SubagentStop handoff verifier — replaces unconditional prompt injection.
# Reads JSON payload from stdin, warns only when a substantial subagent
# stopped without writing a handoff artifact.
#
# Silent (exit 0) when:
#   - last_assistant_message is short (<150 chars) — trivial/lookup agent
#   - last_assistant_message contains a handoff artifact path
#   - last_assistant_message contains "handoff" keyword
#
# Warns (stdout + exit 0, non-blocking) when:
#   - substantial message with no handoff path detected

PAYLOAD=$(cat)

MSG=$(echo "$PAYLOAD" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(chunks.join(''));
    process.stdout.write(d.last_assistant_message ?? '');
  } catch {}
});
" 2>/dev/null)

# Empty message — trivial agent
if [ -z "$MSG" ]; then exit 0; fi

MSG_LEN=${#MSG}

# Short message — trivial lookup/skill-loader agent
if [ "$MSG_LEN" -lt 150 ]; then exit 0; fi

# Handoff artifact path present
if echo "$MSG" | grep -q '\.claude/artifacts/crew/handoffs/'; then exit 0; fi

# Handoff keyword present
if echo "$MSG" | grep -qi 'handoff'; then exit 0; fi

# Substantial work with no handoff detected — warn non-blocking
echo "CREW HANDOFF CHECK: Subagent returned substantial output (${MSG_LEN} chars) with no handoff artifact path detected. If this was a crew:builder/reviewer/researcher, verify handoff was written."
exit 0
