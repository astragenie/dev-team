// scripts/lib/cost-hygiene/decide.ts

export interface StoredEntry {
  read_count: number;
  first_read_at: string;
  last_read_at: string;
  mtime_at_last_read: string;
  size_at_last_read: number;
  content_bytes: number;
  content: string | null;
  // FEAT-156: edit verify-loop tracking.
  last_edit_at?: string;
  mtime_at_last_edit?: string;
}

export interface DecideInput {
  path: string;
  storedEntry: StoredEntry | null;
  currentMtime: string;
  currentSize: number;
  now: string;
  force?: boolean;
}

// FEAT-156: window after a successful Edit/Write during which a Read of the same
// file (with unchanged mtime) is treated as a wasted verify-Read. 30s ≈ 5 tool
// calls per cost-advisor baseline.
const EDIT_VERIFY_LOOP_WINDOW_MS = 30_000;

export interface DecideResult {
  action: "pass" | "warn";
  message: string | null;
}

function formatWarning(entry: StoredEntry, path: string): string {
  const count = entry.read_count;
  const countLabel = count === 1 ? "1 time" : `${count} times`;
  const mtime = entry.mtime_at_last_read;
  const contentBlock =
    entry.content !== null
      ? `Prior content:\n\n${entry.content}\n\n`
      : `Prior content: (content omitted, file size ${Math.round(entry.size_at_last_read / 1000)} KB)\n\n`;
  return (
    `<system-reminder>You already loaded ${path} ${countLabel} this session. ` +
    `Content unchanged (mtime ${mtime}). ${contentBlock}` +
    `Do not re-issue the Read.</system-reminder>`
  );
}

function formatEditVerifyLoopWarning(entry: StoredEntry, path: string): string {
  return (
    `<system-reminder>You just successfully Edit/Write'd ${path} ` +
    `(${entry.last_edit_at}) and the file is unchanged since. The harness ` +
    `errors on FAILED Edits — a successful Edit means the file already matches ` +
    `your new_string. Re-Reading is wasted token cost. ` +
    `Override via {"force": true} in Read args if you genuinely need to ` +
    `re-verify, or wait ${EDIT_VERIFY_LOOP_WINDOW_MS / 1000}s.</system-reminder>`
  );
}

function isVerifyLoopRead(entry: StoredEntry, currentMtime: string, nowIso: string): boolean {
  if (entry.last_edit_at === undefined || entry.mtime_at_last_edit === undefined) return false;
  const elapsed = Date.parse(nowIso) - Date.parse(entry.last_edit_at);
  if (Number.isNaN(elapsed) || elapsed < 0 || elapsed > EDIT_VERIFY_LOOP_WINDOW_MS) return false;
  return Date.parse(currentMtime) <= Date.parse(entry.mtime_at_last_edit);
}

export function decide(input: DecideInput): DecideResult {
  const { path, storedEntry, currentMtime, now, force } = input;
  if (storedEntry === null) {
    return { action: "pass", message: null };
  }
  if (force === true) {
    return { action: "pass", message: null };
  }
  // FEAT-156: edit verify-loop check — fires before the redundant-read check
  // because it's a more specific anti-pattern.
  if (isVerifyLoopRead(storedEntry, currentMtime, now)) {
    return { action: "warn", message: formatEditVerifyLoopWarning(storedEntry, path) };
  }
  if (Date.parse(currentMtime) > Date.parse(storedEntry.mtime_at_last_read)) {
    return { action: "pass", message: null };
  }
  if (storedEntry.read_count === 0) {
    // Entry exists only because of a prior recordEdit; no read warning yet.
    return { action: "pass", message: null };
  }
  return { action: "warn", message: formatWarning(storedEntry, path) };
}
