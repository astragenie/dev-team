// Parse a slice file's `## Acceptance criteria` block.
// Returns an array of { id, text } for top-level `- [ ] AC-N: text` lines.
// Nested checkboxes (indented) and content after the next `##` header are
// ignored.

const HEADER_RE = /^##\s+Acceptance\s+criteria\s*$/i;
const NEXT_HEADER_RE = /^##\s+/;
const AC_LINE_RE = /^- \[ \] (AC-\d+):\s*(.+)$/;

export function extractACs(sliceContent) {
  if (!sliceContent) return [];
  const lines = sliceContent.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => HEADER_RE.test(l));
  if (startIdx === -1) return [];
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (NEXT_HEADER_RE.test(line)) break;
    const m = AC_LINE_RE.exec(line);
    if (m) out.push({ id: m[1], text: m[2].trim() });
  }
  return out;
}
