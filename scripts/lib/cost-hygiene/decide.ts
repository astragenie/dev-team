// scripts/lib/cost-hygiene/decide.ts

export interface StoredEntry {
  read_count: number;
  first_read_at: string;
  last_read_at: string;
  mtime_at_last_read: string;
  size_at_last_read: number;
  content_bytes: number;
  content: string | null;
}

export interface DecideInput {
  path: string;
  storedEntry: StoredEntry | null;
  currentMtime: string;
  currentSize: number;
  now: string;
}

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

export function decide(input: DecideInput): DecideResult {
  const { path, storedEntry, currentMtime } = input;
  if (storedEntry === null) {
    return { action: "pass", message: null };
  }
  if (Date.parse(currentMtime) > Date.parse(storedEntry.mtime_at_last_read)) {
    return { action: "pass", message: null };
  }
  return { action: "warn", message: formatWarning(storedEntry, path) };
}
