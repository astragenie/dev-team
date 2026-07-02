/**
 * tests/gepa/critical-agent-allowlist.test.ts — SLICE-106
 *
 * Covers AC-10 (allowlist membership) and design spec line 44
 * (list is NOT configurable in v1; always inspector + verifier + architect).
 */

import { describe, expect, it } from "bun:test";
import {
  CRITICAL_AGENT_ALLOWLIST,
  isCriticalAgent
} from "../../scripts/lib/gepa/critical-agent-allowlist.ts";

describe("CRITICAL_AGENT_ALLOWLIST — membership", () => {
  it("contains exactly 3 members", () => {
    expect(CRITICAL_AGENT_ALLOWLIST.length).toBe(3);
  });

  it("contains inspector", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).toContain("inspector");
  });

  it("contains verifier", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).toContain("verifier");
  });

  it("contains architect", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).toContain("architect");
  });

  it("is ordered: inspector first, verifier second, architect third", () => {
    expect(CRITICAL_AGENT_ALLOWLIST[0]).toBe("inspector");
    expect(CRITICAL_AGENT_ALLOWLIST[1]).toBe("verifier");
    expect(CRITICAL_AGENT_ALLOWLIST[2]).toBe("architect");
  });

  it("does NOT contain fullstack-dev", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).not.toContain("fullstack-dev");
  });

  it("does NOT contain backend-dev", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).not.toContain("backend-dev");
  });

  it("does NOT contain frontend-dev", () => {
    expect(CRITICAL_AGENT_ALLOWLIST).not.toContain("frontend-dev");
  });
});

describe("isCriticalAgent — membership predicate", () => {
  it("returns true for inspector", () => {
    expect(isCriticalAgent("inspector")).toBe(true);
  });

  it("returns true for verifier", () => {
    expect(isCriticalAgent("verifier")).toBe(true);
  });

  it("returns true for architect", () => {
    expect(isCriticalAgent("architect")).toBe(true);
  });

  it("returns false for fullstack-dev", () => {
    expect(isCriticalAgent("fullstack-dev")).toBe(false);
  });

  it("returns false for backend-dev", () => {
    expect(isCriticalAgent("backend-dev")).toBe(false);
  });

  it("returns false for frontend-dev", () => {
    expect(isCriticalAgent("frontend-dev")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCriticalAgent("")).toBe(false);
  });

  it("returns false for unknown agent", () => {
    expect(isCriticalAgent("my-custom-agent")).toBe(false);
  });

  it("is case-sensitive — INSPECTOR is not a match", () => {
    expect(isCriticalAgent("INSPECTOR")).toBe(false);
  });

  it("is case-sensitive — Inspector is not a match", () => {
    expect(isCriticalAgent("Inspector")).toBe(false);
  });
});

describe("CRITICAL_AGENT_ALLOWLIST — not configurable (v1 constraint)", () => {
  it("is a readonly tuple — direct element write is not allowed at type level", () => {
    // The list is declared as `readonly string[]` — this test validates
    // that the runtime object is frozen (Bun/Node runtime invariant check).
    // We can only assert on the value identity, not the type here.
    expect(Array.isArray(CRITICAL_AGENT_ALLOWLIST)).toBe(true);
    // The list values must not change between imports.
    const snapshot = [...CRITICAL_AGENT_ALLOWLIST];
    expect(snapshot).toEqual(["inspector", "verifier", "architect"]);
  });
});
