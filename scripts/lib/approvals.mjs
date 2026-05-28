import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const STATE_DIR = [".claude", "state", "crew"];
const APPROVALS_PATH = [...STATE_DIR, "approvals.jsonl"];

const USER_APPROVAL_KINDS = new Set([
  "destructive_action",
  "wide_scope_change",
  "policy_change",
  "architecture_decision"
]);

function nowIso() {
  return new Date().toISOString();
}

/** @param {string} dirPath */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
async function ensureFile(filePath, contents) {
  try {
    await fs.access(filePath);
  } catch {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents);
  }
}

/** @param {string} repoPath */
async function ensureApprovalLog(repoPath) {
  await ensureFile(path.join(repoPath, ...APPROVALS_PATH), "");
}

/** @param {string} repoPath */
async function approvalLogExists(repoPath) {
  try {
    await fs.access(path.join(repoPath, ...APPROVALS_PATH));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} kind */
function defaultApprover(kind) {
  return USER_APPROVAL_KINDS.has(kind) ? "user" : "lead";
}

/** @param {string} [status] */
function normalizeStatusFilter(status) {
  if (!status || status === "open") {
    return "open";
  }
  if (status === "resolved" || status === "all") {
    return status;
  }
  throw new Error(`Unsupported approval status filter: ${status}`);
}

function buildApprovalId() {
  return `apr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * @param {string} repoPath
 * @param {Record<string, unknown>} event
 */
async function appendApprovalEvent(repoPath, event) {
  await ensureApprovalLog(repoPath);
  const approvalsPath = path.join(repoPath, ...APPROVALS_PATH);
  await fs.appendFile(approvalsPath, `${JSON.stringify({ timestamp: nowIso(), ...event })}\n`);
}

/**
 * @param {string} repoPath
 * @param {{createIfMissing?: boolean}} [options]
 */
async function readApprovalEvents(repoPath, options = {}) {
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
    .map((line) => JSON.parse(line));
}

/** @param {Array<Record<string, unknown>>} events */
function replayApprovals(events) {
  const approvals = new Map();

  for (const event of events) {
    if (event.event === "approval_requested") {
      approvals.set(event.id, {
        id: event.id,
        status: "open",
        kind: event.kind,
        severity: event.severity,
        summary: event.summary,
        reason: event.reason,
        requester: event.requester,
        approver: event.approver,
        requestedAt: event.timestamp
      });
      continue;
    }

    if (event.event === "approval_resolved" && approvals.has(event.id)) {
      const current = approvals.get(event.id);
      approvals.set(event.id, {
        ...current,
        status: event.decision,
        decision: event.decision,
        resolver: event.resolver,
        resolutionNote: event.note || "",
        resolvedAt: event.timestamp
      });
    }
  }

  return [...approvals.values()].sort((left, right) =>
    left.requestedAt.localeCompare(right.requestedAt)
  );
}

/**
 * @param {string} repoPath
 * @param {{kind?: string, severity?: string, summary?: string, reason?: string, requester?: string, approver?: string}} [options]
 */
export async function requestApproval(repoPath, options = {}) {
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
    status: "open"
  };
}

/**
 * @param {string} repoPath
 * @param {{status?: string, approver?: string | null, createIfMissing?: boolean}} [options]
 */
export async function listApprovals(repoPath, options = {}) {
  const status = normalizeStatusFilter(options.status);
  const approver = options.approver || null;
  const events = await readApprovalEvents(repoPath, { createIfMissing: options.createIfMissing });
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

/**
 * @param {string} repoPath
 * @param {{id?: string, decision?: string, resolver?: string, note?: string}} [options]
 */
export async function resolveApproval(repoPath, options = {}) {
  const id = options.id;
  const decision = options.decision;
  if (!id) {
    throw new Error("Approval id is required.");
  }
  if (!["approved", "rejected", "canceled"].includes(decision)) {
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
    decision,
    resolver: options.resolver || "lead-session",
    note: options.note || ""
  };

  await appendApprovalEvent(repoPath, {
    event: "approval_resolved",
    ...resolution
  });

  return {
    ...approval,
    ...resolution,
    status: decision
  };
}
