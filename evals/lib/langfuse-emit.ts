/**
 * Langfuse dataset emission — raw fetch, no SDK dependency.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Posts each eval run as a Langfuse dataset run with one item per test:
 *   1. POST /api/public/datasets          (idempotent by name)
 *   2. POST /api/public/dataset-runs      (one run per eval invocation)
 *   3. POST /api/public/dataset-items     (one item per test)
 *
 * Auth: HTTP Basic with LANGFUSE_PUBLIC_KEY:LANGFUSE_SECRET_KEY
 * Host: LANGFUSE_HOST env (default https://cloud.langfuse.com)
 * Graceful skip: if either key absent, logs one stderr warning, all functions return null/void.
 *
 * SLICE-90 (FEAT-169 SLICE-B3).
 */

export type DatasetId = string;
export type RunId = string;

export interface LangfuseRunOpts {
  datasetId: DatasetId;
  promptId: string;
  judgeId: string;
  runName?: string;
  metadata?: Record<string, unknown>;
}

export interface LangfuseItemPayload {
  runId: RunId;
  testName: string;
  pass: boolean;
  durationMs: number;
  asserts: Array<{ type: string; pass: boolean; message: string }>;
  validations?: Array<{ judge: string; verdict: string; rationale: string }>;
  disagreement?: boolean;
}

const DEFAULT_HOST = "https://cloud.langfuse.com";
let warnedMissingKeys = false;

function getAuth(): { publicKey: string; secretKey: string } | null {
  const pub = process.env["LANGFUSE_PUBLIC_KEY"] ?? "";
  const sec = process.env["LANGFUSE_SECRET_KEY"] ?? "";
  if (!pub || !sec) {
    if (!warnedMissingKeys) {
      warnedMissingKeys = true;
      process.stderr.write("langfuse: skipping — keys not set (LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY required)\n");
    }
    return null;
  }
  return { publicKey: pub, secretKey: sec };
}

function getHost(): string { return (process.env["LANGFUSE_HOST"] ?? DEFAULT_HOST).replace(/\/$/, ""); }

function basicHeader(pub: string, sec: string): string {
  return `Basic ${Buffer.from(`${pub}:${sec}`).toString("base64")}`;
}

async function post(host: string, pub: string, sec: string, endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${host}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicHeader(pub, sec) },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`langfuse POST ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Ensure a dataset exists. Idempotent by name. Returns dataset id or null when keys absent. */
export async function ensureDataset(promptId: string): Promise<DatasetId | null> {
  const auth = getAuth();
  if (!auth) return null;
  const data = await post(getHost(), auth.publicKey, auth.secretKey, "/api/public/datasets",
    { name: promptId, description: `Agent eval dataset for prompt_id: ${promptId}` });
  const id = data["id"] ?? data["name"];
  return typeof id === "string" ? id : promptId;
}

/** Record a dataset run. Returns run id or null when keys absent. */
export async function recordRun(opts: LangfuseRunOpts): Promise<RunId | null> {
  const auth = getAuth();
  if (!auth) return null;
  const runName = opts.runName ?? `${opts.promptId}-${opts.judgeId}-${new Date().toISOString()}`;
  const data = await post(getHost(), auth.publicKey, auth.secretKey, "/api/public/dataset-runs",
    { datasetName: opts.datasetId, name: runName,
      metadata: { promptId: opts.promptId, judgeId: opts.judgeId, ...opts.metadata } });
  const id = data["id"] ?? data["name"];
  return typeof id === "string" ? id : runName;
}

/** Record a single test item in a dataset run. Silently swallows errors after logging. */
export async function recordItem(item: LangfuseItemPayload): Promise<void> {
  const auth = getAuth();
  if (!auth) return;
  try {
    await post(getHost(), auth.publicKey, auth.secretKey, "/api/public/dataset-items", {
      datasetRunName: item.runId,
      input: { testName: item.testName, asserts: item.asserts },
      expectedOutput: { pass: true },
      output: { pass: item.pass, durationMs: item.durationMs,
        validations: item.validations ?? [], disagreement: item.disagreement ?? false },
      metadata: { disagreement: item.disagreement ?? false, validationCount: item.validations?.length ?? 0 }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`langfuse: recordItem failed for "${item.testName}": ${msg}\n`);
  }
}
