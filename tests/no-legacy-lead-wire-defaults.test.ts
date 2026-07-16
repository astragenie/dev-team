import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Slice B (lead -> dispatcher wire rename) regression guard.
//
// scripts/validate-agents.ts's NO_LEAD_REF_REQUIRED gate (see
// tests/agent-prompt-content.test.ts) only scans agent *prompt prose* in
// agents/*.md — it has no visibility into TypeScript wire-value defaults.
// This is the sibling gate for the source surfaces Slice B migrated: it
// pins the post-rename literal so a future edit can't silently regress a
// wire default back to "lead"/"lead-session" without a test failing.
//
// Each entry's forbidden pattern targets the specific default-producing
// expression (`?? "lead"`, `|| "lead-session"`, the role-classification
// return), not the bare substring "lead" — legacy-alias comments and the
// dual-read normalization helpers themselves legitimately mention "lead".
//
// Uses bun:test (not node:test): CI runs `bun test`, and generating test()
// calls from a loop under node:test's compat shim trips Bun's "test()
// inside another test()" NotImplementedError (bun#5090). describe()/test()
// from bun:test handle this correctly — see the same loop-of-it() pattern
// in tests/gepa/auto-merge-gate-five-conditions.test.ts:218-219.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const GUARDED_SURFACES: Array<{ file: string; forbidden: RegExp; label: string }> = [
  {
    file: "scripts/crew.ts",
    forbidden: /flags\.to\s*\?\?\s*"lead"/,
    label: "write-handoff `to:` default"
  },
  {
    file: "scripts/crew.ts",
    forbidden: /\|\|\s*"lead-session"/,
    label: "crew.ts actor/owner defaults"
  },
  {
    file: "scripts/lib/approvals.ts",
    forbidden: /USER_APPROVAL_KINDS\.has\(kind\)\s*\?\s*"user"\s*:\s*"lead"/,
    label: "defaultApprover role classification"
  },
  {
    file: "scripts/lib/approvals.ts",
    forbidden: /\|\|\s*"lead-session"/,
    label: "approvals.ts requester/resolver defaults"
  },
  {
    file: "scripts/lib/claims.ts",
    forbidden: /\|\|\s*"lead-session"/,
    label: "claimFiles owner default"
  },
  {
    file: "scripts/lib/deployment-guidance/write.ts",
    forbidden: /\|\|\s*"lead-session"/,
    label: "deployment guidance Owner default"
  },
  {
    file: "scripts/validate-routing-table.ts",
    forbidden: /^\s*"lead",?\s*$/m,
    label: "KNOWN_CREW_ROLES / CREW_ROLE_IN_CELL_RE dead 'lead' token"
  }
];

describe("Slice B: no regression of migrated wire defaults back to 'lead'", () => {
  for (const { file, forbidden, label } of GUARDED_SURFACES) {
    test(`${file}: ${label}`, async () => {
      const content = await fs.readFile(path.join(repoRoot, file), "utf8");
      expect(
        content,
        `${file} appears to have regressed ${label} back to a "lead"-based default (Slice B rename)`
      ).not.toMatch(forbidden);
    });
  }
});

describe("Slice B: dual-read alias normalization stays in place", () => {
  test("claims.ts keeps the lead-session/dispatcher-session alias normalization", async () => {
    const claims = await fs.readFile(path.join(repoRoot, "scripts/lib/claims.ts"), "utf8");
    expect(claims).toMatch(/normalizeOwnerAlias/);
  });

  test("approvals.ts keeps the lead/dispatcher approver alias normalization", async () => {
    const approvals = await fs.readFile(path.join(repoRoot, "scripts/lib/approvals.ts"), "utf8");
    expect(approvals).toMatch(/normalizeApprover/);
  });
});
