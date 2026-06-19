/**
 * PII scrub for FEAT-165 SLICE-B.
 *
 * Redacts span attrs based on deny-list keys, value length cap, and path globs.
 * When scrub_pii is false: passes through unchanged (one branch, no mutation).
 */

// ---------------------------------------------------------------------------
// Deny-list — keys always redacted regardless of value length
// ---------------------------------------------------------------------------

const DENY_LIST_KEYS = new Set([
  "input.prompt",
  "input.diff",
  "input.content",
  "input.code",
  "input.text",
  "tool_input.content",
  "tool_input.code",
  "tool_input.text",
  "tool_input.prompt",
  "tool_input.file_text",
  "tool_input.new_string",
  "tool_input.old_string",
  "tool_response",
  "last_assistant_message"
]);

// ---------------------------------------------------------------------------
// Glob matcher — no external dep; supports **, *, ?, literal segments
// ---------------------------------------------------------------------------

function translateGlobChar(glob: string, i: number): { chunk: string; advance: number } {
  const ch = glob[i] ?? "";
  if (ch === "*" && glob[i + 1] === "*") {
    // Consume optional trailing slash after **
    const advance = glob[i + 2] === "/" ? 3 : 2;
    return { chunk: ".*", advance };
  }
  if (ch === "*") return { chunk: "[^/]*", advance: 1 };
  if (ch === "?") return { chunk: "[^/]", advance: 1 };
  if (ch === "") return { chunk: "", advance: 1 };
  return { chunk: ch.replace(/[.+^${}()|[\]\\]/g, "\\$&"), advance: 1 };
}

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  let i = 0;
  while (i < glob.length) {
    const { chunk, advance } = translateGlobChar(glob, i);
    pattern += chunk;
    i += advance;
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesRedactPath(filePath: string, globs: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((glob) => globToRegExp(glob).test(normalized));
}

// ---------------------------------------------------------------------------
// Main scrub function
// ---------------------------------------------------------------------------

type AttrValue = string | number | boolean;

export function scrubAttrs(
  attrs: Record<string, AttrValue>,
  cfg: { scrub_pii: boolean; redact_paths: string[]; redact_attr_max_chars: number }
): Record<string, AttrValue> {
  if (!cfg.scrub_pii) return attrs;

  const result: Record<string, AttrValue> = {};
  for (const [key, value] of Object.entries(attrs)) {
    // Numeric and boolean pass through
    if (typeof value !== "string") {
      result[key] = value;
      continue;
    }
    // Deny-list key check (unconditional)
    if (DENY_LIST_KEYS.has(key)) {
      result[key] = "<redacted:key>";
      continue;
    }
    // Path glob match on value
    if (matchesRedactPath(value, cfg.redact_paths)) {
      result[key] = "<redacted:path>";
      continue;
    }
    // Length cap
    if (value.length > cfg.redact_attr_max_chars) {
      result[key] = `<redacted:length=${value.length}>`;
      continue;
    }
    result[key] = value;
  }
  return result;
}
