import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { type Result, ok, err } from "./result.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalRecord {
  id: string;
  status: string;
  kind: string;
  severity: string;
  summary: string;
  reason: string;
  requester: string;
  approver: string;
  requestedAt: string;
  decision?: string;
  resolver?: string;
  resolutionNote?: string;
  resolvedAt?: string;
}

export interface RequestApprovalOptions {
  kind?: string;
  severity?: string;
  summary?: string;
  reason?: string;
  requester?: string;
  approver?: string;
}

export interface ListApprovalsOptions {
  status?: string;
  approver?: string | null;
  createIfMissing?: boolean;
}

export interface ResolveApprovalOptions {
  id?: string;
  decision?: string;
  resolver?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_DIR = [".claude", "state", "crew"] as const;
const APPROVALS_PATH = [...STATE_DIR, "approvals.jsonl"] as const;

const USER_APPROVAL_KINDS = new Set([
  "destructive_action",
  "wide_scope_change",
  "policy_change",
  "architecture_decision"
]);

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureFile(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

async function ensureApprovalLog(repoPath: string): Promise<void> {
  await ensureFile(path.join(repoPath, ...APPROVALS_PATH), "");
}

async function approvalLogExists(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoPath, ...APPROVALS_PATH));
    return true;
  } catch {
    return false;
  }
}

function defaultApprover(kind: string): string {
  return USER_APPROVAL_KINDS.has(kind) ? "user" : "lead";
}

function normalizeStatusFilter(status: string | undefined): string {
  if (!status || status === "open") {
    return "open";
  }
  if (status === "resolved" || status === "all") {
    return status;
  }
  throw new Error(`Unsupported approval status filter: ${status}`);
}

function buildApprovalId(): string {
  return `apr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

async function appendApprovalEvent(
  repoPath: string,
  event: Record<string, unknown>
): Promise<void> {
  await ensureApprovalLog(repoPath);
  const approvalsPath = path.join(repoPath, ...APPROVALS_PATH);
  await fs.appendFile(approvalsPath, `${JSON.stringify({ timestamp: nowIso(), ...event })}\n`);
}

async function readApprovalEvents(
  repoPath: string,
  options: { createIfMissing?: boolean } = {}
): Promise<Record<string, unknown>[]> {
  if (options.createIfMissing === false && !(await approvalLogExists(repoPath))) {
    return [];
  }
  await ensureApprovalLog(repoPath);
  const approvalsPath = path.join(repoPath, ...APPROVALS_PATH);
  const raw = await fs.readFile(approvalsPath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Event replay
// ---------------------------------------------------------------------------

function replayApprovals(events: Record<string, unknown>[]): ApprovalRecord[] {
  const approvals = new Map<string, ApprovalRecord>();

  for (const event of events) {
    if (event["event"] === "approval_requested") {
      const id = event["id"] as string;
      approvals.set(id, {
        id,
        status: "open",
        kind: event["kind"] as string,
        severity: event["severity"] as string,
        summary: event["summary"] as string,
        reason: event["reason"] as string,
        requester: event["requester"] as string,
        approver: event["approver"] as string,
        requestedAt: event["timestamp"] as string
      });
      continue;
    }

    if (event["event"] === "approval_resolved") {
      const id = event["id"] as string;
      const current = approvals.get(id);
      if (current) {
        const decision = event["decision"] as string;
        approvals.set(id, {
          ...current,
          status: decision,
          decision,
          resolver: event["resolver"] as string,
          resolutionNote: (event["note"] as string) || "",
          resolvedAt: event["timestamp"] as string
        });
      }
    }
  }

  return [...approvals.values()].sort((left, right) =>
    left.requestedAt.localeCompare(right.requestedAt)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function requestApproval(
  repoPath: string,
  options: RequestApprovalOptions = {}
): Promise<ApprovalRecord> {
  const kind = options.kind || "scope_change";
  const approval = {
    id: buildApprovalId(),
    kind,
    severity: options.severity || "medium",
    summary: options.summary || "Approval requested",
    reason: options.reason || "",
    requester: options.requester || "lead-session",
    approver: options.approver || defaultApprover(kind)
  };

  await appendApprovalEvent(repoPath, {
    event: "approval_requested",
    ...approval
  });

  return {
    ...approval,
    status: "open",
    requestedAt: nowIso()
  };
}

export async function listApprovals(
  repoPath: string,
  options: ListApprovalsOptions = {}
): Promise<ApprovalRecord[]> {
  const status = normalizeStatusFilter(options.status);
  const approver = options.approver ?? null;
  const events = await readApprovalEvents(repoPath, {
    ...(options.createIfMissing !== undefined ? { createIfMissing: options.createIfMissing } : {})
  });
  const approvals = replayApprovals(events);

  return approvals.filter((approval) => {
    if (approver && approval.approver !== approver) {
      return false;
    }
    if (status === "all") {
      return true;
    }
    if (status === "resolved") {
      return approval.status !== "open";
    }
    return approval.status === "open";
  });
}

export async function resolveApproval(
  repoPath: string,
  options: ResolveApprovalOptions = {}
): Promise<Result<ApprovalRecord, Error>> {
  try {
    const id = options.id;
    const decision = options.decision;
    if (!id) {
      throw new Error("Approval id is required.");
    }
    if (!["approved", "rejected", "canceled"].includes(decision ?? "")) {
      throw new Error("Approval decision must be one of: approved, rejected, canceled.");
    }

    const events = await readApprovalEvents(repoPath);
    const approvals = replayApprovals(events);
    const approval = approvals.find((item) => item.id === id);
    if (!approval) {
      throw new Error(`Unknown approval id: ${id}`);
    }
    if (approval.status !== "open") {
      throw new Error(`Approval ${id} is already resolved with status ${approval.status}.`);
    }

    const resolution = {
      id,
      decision: decision as string,
      resolver: options.resolver || "lead-session",
      note: options.note || ""
    };

    await appendApprovalEvent(repoPath, {
      event: "approval_resolved",
      ...resolution
    });

    return ok({
      ...approval,
      ...resolution,
      status: decision as string
    });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
