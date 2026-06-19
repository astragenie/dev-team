/**
 * JSONL serializer for OTel span records.
 *
 * Each line is one JSON-encoded SpanRecord. Every line (including the last)
 * ends with a newline character — standard JSONL convention.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { type SpanRecord } from "./span.ts";

/**
 * Serialize spans to a JSONL string.
 * Each span occupies exactly one line, terminated by '\n'.
 */
export function serializeSpansToJsonl(spans: SpanRecord[]): string {
  return spans.map((span) => JSON.stringify(span)).join("\n") + "\n";
}

/**
 * Write spans to a JSONL file at outPath.
 * Parent directory is created if it does not exist.
 * Overwrites any existing file — re-runs are idempotent because
 * spanIds + traceIds are deterministic from run_id.
 */
export async function writeSpansToFile(spans: SpanRecord[], outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, serializeSpansToJsonl(spans), "utf8");
}
