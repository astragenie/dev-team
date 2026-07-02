/**
 * tests/gepa/observability-event-emission.test.ts — SLICE-106
 *
 * Covers AC-9: every event fires exactly once per trigger.
 * Covers all 21+ canonical events defined in observability-events.ts.
 *
 * Strategy: call each typed emitter, read events.jsonl, verify the event
 * appears exactly once with the correct fields.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  emitGepaEvent,
  emitCaptureDropEvent,
  emitEvalStartEvent,
  emitEvalCompleteEvent,
  emitOptCycleStartEvent,
  emitOptNoWinnerEvent,
  emitOptPromoteEvent,
  emitSoakStartEvent,
  emitSoakPromoteEvent,
  emitSoakRevertEvent,
  emitSoakRevertEarlyEvent,
  emitSoakInsufficientTrafficEvent,
  emitBudgetExceededEvent,
  emitTailRiskBlockEvent,
  emitOversizedCandidateEvent,
  emitJudgeUnreachableEvent,
  emitJudgeMalformedEvent,
  emitLockCollisionEvent,
  emitBranchProtectionMissingEvent,
  emitNoWinnerStreakEvent,
  emitChampionFrozenEvent,
  emitCriticalAgentDraftPrEvent
} from "../../scripts/lib/gepa/observability-events.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

let repoPath: string;
let eventsPath: string;

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), "gepa-obs-test-"));
  const logsDir = join(repoPath, ".claude", "logs");
  mkdirSync(logsDir, { recursive: true });
  eventsPath = join(logsDir, "events.jsonl");
});

afterEach(() => {
  rmSync(repoPath, { recursive: true, force: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function readEvents(): Array<Record<string, unknown>> {
  if (!existsSync(eventsPath)) return [];
  const raw = readFileSync(eventsPath, "utf8");
  return raw
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

function countEventsByName(name: string): number {
  return readEvents().filter((e) => e.event === name).length;
}

function lastEventByName(name: string): Record<string, unknown> | undefined {
  const events = readEvents().filter((e) => e.event === name);
  return events[events.length - 1];
}

// ── Core emitter tests ────────────────────────────────────────────────────────

describe("emitGepaEvent — base emitter", () => {
  it("writes exactly 1 line to events.jsonl", () => {
    emitGepaEvent(repoPath, { event: "gepa_test_event", agent: "fullstack-dev" });
    expect(readEvents()).toHaveLength(1);
  });

  it("written line is valid JSON with ts field", () => {
    emitGepaEvent(repoPath, { event: "gepa_test_event" });
    const events = readEvents();
    expect(events[0]).toHaveProperty("ts");
    expect(events[0]).toHaveProperty("event", "gepa_test_event");
  });

  it("deduplicates on event_id — emitting twice with same event_id writes only 1 line", () => {
    const id = "dedup-test-id-001";
    emitGepaEvent(repoPath, { event: "gepa_test", event_id: id });
    emitGepaEvent(repoPath, { event: "gepa_test", event_id: id });
    expect(countEventsByName("gepa_test")).toBe(1);
  });

  it("does NOT deduplicate when event_id differs", () => {
    emitGepaEvent(repoPath, { event: "gepa_test", event_id: "id-a" });
    emitGepaEvent(repoPath, { event: "gepa_test", event_id: "id-b" });
    expect(countEventsByName("gepa_test")).toBe(2);
  });

  it("does NOT deduplicate when event_id is absent", () => {
    emitGepaEvent(repoPath, { event: "gepa_test" });
    emitGepaEvent(repoPath, { event: "gepa_test" });
    expect(countEventsByName("gepa_test")).toBe(2);
  });

  it("never throws even when logs dir is not pre-created", () => {
    const noLogRepo = join(repoPath, "no-log-repo");
    mkdirSync(noLogRepo, { recursive: true });
    // No logs subdir — emitter should create it.
    expect(() => emitGepaEvent(noLogRepo, { event: "gepa_test" })).not.toThrow();
  });
});

// ── Typed event emitters — each fires exactly once ────────────────────────────

describe("emitCaptureDropEvent", () => {
  it("fires gepa_capture_drop once with required fields", () => {
    emitCaptureDropEvent(repoPath, { agent: "fullstack-dev", reason: "walltime_exceeded" });
    expect(countEventsByName("gepa_capture_drop")).toBe(1);
    const e = lastEventByName("gepa_capture_drop")!;
    expect(e.agent).toBe("fullstack-dev");
    expect(e.reason).toBe("walltime_exceeded");
  });
});

describe("emitEvalStartEvent", () => {
  it("fires gepa_eval_start once with required fields", () => {
    emitEvalStartEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-1234"
    });
    expect(countEventsByName("gepa_eval_start")).toBe(1);
    const e = lastEventByName("gepa_eval_start")!;
    expect(e.cycle_id).toBe("cccc-1234");
  });
});

describe("emitEvalCompleteEvent", () => {
  it("fires gepa_eval_complete once with required fields", () => {
    emitEvalCompleteEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-1234",
      trial_id: "tttt-0001",
      pass: true,
      score: 0.85,
      cost_usd: 0.002
    });
    expect(countEventsByName("gepa_eval_complete")).toBe(1);
    const e = lastEventByName("gepa_eval_complete")!;
    expect(e.trial_id).toBe("tttt-0001");
    expect(e.pass).toBe(true);
  });
});

describe("emitOptCycleStartEvent", () => {
  it("fires gepa_opt_cycle_start once with required fields", () => {
    emitOptCycleStartEvent(repoPath, { agent: "fullstack-dev", cycle_id: "cccc-5678", k: 5 });
    expect(countEventsByName("gepa_opt_cycle_start")).toBe(1);
    const e = lastEventByName("gepa_opt_cycle_start")!;
    expect(e.k).toBe(5);
  });
});

describe("emitOptNoWinnerEvent", () => {
  it("fires gepa_opt_no_winner once with required fields", () => {
    emitOptNoWinnerEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-9999",
      run_id: "rrrr-0001",
      streak: 2
    });
    expect(countEventsByName("gepa_opt_no_winner")).toBe(1);
    const e = lastEventByName("gepa_opt_no_winner")!;
    expect(e.streak).toBe(2);
  });
});

describe("emitOptPromoteEvent", () => {
  it("fires gepa_opt_promote once with required fields", () => {
    emitOptPromoteEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-aaaa",
      trial_id: "tttt-0002",
      pr_url: "https://github.com/test/repo/pull/1"
    });
    expect(countEventsByName("gepa_opt_promote")).toBe(1);
    const e = lastEventByName("gepa_opt_promote")!;
    expect(e.pr_url).toContain("/pull/1");
  });
});

describe("emitSoakStartEvent", () => {
  it("fires gepa_soak_start once with required fields", () => {
    emitSoakStartEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-bbbb",
      trial_id: "tttt-0003",
      soak_percent: 0.1
    });
    expect(countEventsByName("gepa_soak_start")).toBe(1);
    const e = lastEventByName("gepa_soak_start")!;
    expect(e.soak_percent).toBe(0.1);
  });
});

describe("emitSoakPromoteEvent", () => {
  it("fires gepa_soak_promote once with required fields", () => {
    emitSoakPromoteEvent(repoPath, {
      agent: "fullstack-dev",
      cycle_id: "cccc-cccc",
      trial_id: "tttt-0004",
      elapsed_days: 7.5
    });
    expect(countEventsByName("gepa_soak_promote")).toBe(1);
    const e = lastEventByName("gepa_soak_promote")!;
    expect(e.elapsed_days).toBe(7.5);
  });
});

describe("emitSoakRevertEvent", () => {
  it("fires gepa_soak_revert once with required fields", () => {
    emitSoakRevertEvent(repoPath, {
      agent: "fullstack-dev",
      reason: "manual kill-switch",
      revert_commit: "abc1234"
    });
    expect(countEventsByName("gepa_soak_revert")).toBe(1);
    const e = lastEventByName("gepa_soak_revert")!;
    expect(e.reason).toContain("kill-switch");
    expect(e.revert_commit).toBe("abc1234");
  });
});

describe("emitSoakRevertEarlyEvent", () => {
  it("fires gepa_soak_revert_early once with required fields", () => {
    emitSoakRevertEarlyEvent(repoPath, {
      agent: "fullstack-dev",
      pass_rate_delta: -0.05,
      elapsed_days: 3.2
    });
    expect(countEventsByName("gepa_soak_revert_early")).toBe(1);
    const e = lastEventByName("gepa_soak_revert_early")!;
    expect(e.pass_rate_delta).toBe(-0.05);
  });
});

describe("emitSoakInsufficientTrafficEvent", () => {
  it("fires gepa_soak_insufficient_traffic once with required fields", () => {
    emitSoakInsufficientTrafficEvent(repoPath, {
      agent: "fullstack-dev",
      elapsed_days: 21,
      sample_count: 12,
      min_soak_trials: 20
    });
    expect(countEventsByName("gepa_soak_insufficient_traffic")).toBe(1);
    const e = lastEventByName("gepa_soak_insufficient_traffic")!;
    expect(e.sample_count).toBe(12);
  });
});

describe("emitBudgetExceededEvent", () => {
  it("fires gepa_budget_exceeded once with required fields", () => {
    emitBudgetExceededEvent(repoPath, {
      agent: "fullstack-dev",
      spent_usd: 50.01,
      daily_cap_usd: 50
    });
    expect(countEventsByName("gepa_budget_exceeded")).toBe(1);
    const e = lastEventByName("gepa_budget_exceeded")!;
    expect(e.daily_cap_usd).toBe(50);
  });
});

describe("emitTailRiskBlockEvent", () => {
  it("fires gepa_tail_risk_block once with required fields", () => {
    emitTailRiskBlockEvent(repoPath, {
      agent: "fullstack-dev",
      min_held_out_case_score: 0.55,
      floor: 0.6
    });
    expect(countEventsByName("gepa_tail_risk_block")).toBe(1);
    const e = lastEventByName("gepa_tail_risk_block")!;
    expect(e.floor).toBe(0.6);
  });
});

describe("emitOversizedCandidateEvent", () => {
  it("fires gepa_oversized_candidate once with required fields", () => {
    emitOversizedCandidateEvent(repoPath, {
      agent: "fullstack-dev",
      candidate_id: "cand-001",
      lines: 400,
      cap: 350
    });
    expect(countEventsByName("gepa_oversized_candidate")).toBe(1);
    const e = lastEventByName("gepa_oversized_candidate")!;
    expect(e.lines).toBe(400);
    expect(e.cap).toBe(350);
  });
});

describe("emitJudgeUnreachableEvent", () => {
  it("fires gepa_judge_unreachable once with required fields", () => {
    emitJudgeUnreachableEvent(repoPath, {
      agent: "fullstack-dev",
      provider: "ollama",
      error: "ECONNREFUSED"
    });
    expect(countEventsByName("gepa_judge_unreachable")).toBe(1);
    const e = lastEventByName("gepa_judge_unreachable")!;
    expect(e.provider).toBe("ollama");
  });
});

describe("emitJudgeMalformedEvent", () => {
  it("fires gepa_judge_malformed once with required fields", () => {
    emitJudgeMalformedEvent(repoPath, {
      agent: "fullstack-dev",
      provider: "gemini",
      raw: { unexpected: "response" }
    });
    expect(countEventsByName("gepa_judge_malformed")).toBe(1);
  });
});

describe("emitLockCollisionEvent", () => {
  it("fires gepa_lock_collision once with required fields", () => {
    emitLockCollisionEvent(repoPath, { agent: "fullstack-dev", op: "optimize" });
    expect(countEventsByName("gepa_lock_collision")).toBe(1);
    const e = lastEventByName("gepa_lock_collision")!;
    expect(e.op).toBe("optimize");
  });
});

describe("emitBranchProtectionMissingEvent", () => {
  it("fires gepa_branch_protection_missing once with required fields", () => {
    emitBranchProtectionMissingEvent(repoPath, {
      agent: "fullstack-dev",
      branch: "gepa/fullstack-dev/trial-abc",
      pr_url: "https://github.com/test/repo/pull/2"
    });
    expect(countEventsByName("gepa_branch_protection_missing")).toBe(1);
  });
});

describe("emitNoWinnerStreakEvent", () => {
  it("fires gepa_no_winner_streak once with required fields", () => {
    emitNoWinnerStreakEvent(repoPath, { agent: "fullstack-dev", streak: 3 });
    expect(countEventsByName("gepa_no_winner_streak")).toBe(1);
    const e = lastEventByName("gepa_no_winner_streak")!;
    expect(e.streak).toBe(3);
  });
});

describe("emitChampionFrozenEvent", () => {
  it("fires gepa_champion_frozen once with required fields", () => {
    emitChampionFrozenEvent(repoPath, {
      agent: "inspector",
      frozen_list: ["inspector", "architect"]
    });
    expect(countEventsByName("gepa_champion_frozen")).toBe(1);
    const e = lastEventByName("gepa_champion_frozen")!;
    expect(Array.isArray(e.frozen_list)).toBe(true);
  });
});

describe("emitCriticalAgentDraftPrEvent — SLICE-106 new event", () => {
  it("fires gepa_critical_agent_draft_pr once with required fields", () => {
    emitCriticalAgentDraftPrEvent(repoPath, {
      agent: "inspector",
      cycle_id: "cccc-dddd",
      trial_id: "tttt-0005",
      pr_url: "https://github.com/test/repo/pull/3",
      pr_draft: true
    });
    expect(countEventsByName("gepa_critical_agent_draft_pr")).toBe(1);
    const e = lastEventByName("gepa_critical_agent_draft_pr")!;
    expect(e.agent).toBe("inspector");
    expect(e.pr_draft).toBe(true);
    expect(e.pr_url).toContain("/pull/3");
  });

  it("fires for verifier as well", () => {
    emitCriticalAgentDraftPrEvent(repoPath, {
      agent: "verifier",
      pr_draft: true
    });
    expect(countEventsByName("gepa_critical_agent_draft_pr")).toBe(1);
    const e = lastEventByName("gepa_critical_agent_draft_pr")!;
    expect(e.agent).toBe("verifier");
  });

  it("fires for architect as well", () => {
    emitCriticalAgentDraftPrEvent(repoPath, {
      agent: "architect",
      pr_draft: true
    });
    expect(countEventsByName("gepa_critical_agent_draft_pr")).toBe(1);
  });
});

// ── All 21+ events fired in sequence: each appears exactly once ───────────────

describe("observability — full event set emission test (AC-9)", () => {
  it("all 21 canonical events appear exactly once when emitted once", () => {
    const CYCLE = "cccc-full";
    const TRIAL = "tttt-full";

    emitCaptureDropEvent(repoPath, { agent: "a", reason: "r" });
    emitEvalStartEvent(repoPath, { agent: "a", cycle_id: CYCLE });
    emitEvalCompleteEvent(repoPath, {
      agent: "a",
      cycle_id: CYCLE,
      trial_id: TRIAL,
      pass: true,
      score: 0.9,
      cost_usd: 0.001
    });
    emitOptCycleStartEvent(repoPath, { agent: "a", cycle_id: CYCLE, k: 5 });
    emitOptNoWinnerEvent(repoPath, {
      agent: "a",
      cycle_id: CYCLE,
      run_id: "rrrr",
      streak: 1
    });
    emitOptPromoteEvent(repoPath, { agent: "a", cycle_id: CYCLE, trial_id: TRIAL });
    emitSoakStartEvent(repoPath, {
      agent: "a",
      cycle_id: CYCLE,
      trial_id: TRIAL,
      soak_percent: 0.1
    });
    emitSoakPromoteEvent(repoPath, {
      agent: "a",
      cycle_id: CYCLE,
      trial_id: TRIAL,
      elapsed_days: 7
    });
    emitSoakRevertEvent(repoPath, { agent: "a", reason: "test" });
    emitSoakRevertEarlyEvent(repoPath, {
      agent: "a",
      pass_rate_delta: -0.03,
      elapsed_days: 2
    });
    emitSoakInsufficientTrafficEvent(repoPath, {
      agent: "a",
      elapsed_days: 21,
      sample_count: 5,
      min_soak_trials: 20
    });
    emitBudgetExceededEvent(repoPath, { agent: "a", spent_usd: 51, daily_cap_usd: 50 });
    emitTailRiskBlockEvent(repoPath, {
      agent: "a",
      min_held_out_case_score: 0.5,
      floor: 0.6
    });
    emitOversizedCandidateEvent(repoPath, {
      agent: "a",
      candidate_id: "c",
      lines: 360,
      cap: 350
    });
    emitJudgeUnreachableEvent(repoPath, { agent: "a", provider: "ollama", error: "timeout" });
    emitJudgeMalformedEvent(repoPath, { agent: "a", provider: "gemini" });
    emitLockCollisionEvent(repoPath, { agent: "a", op: "eval" });
    emitBranchProtectionMissingEvent(repoPath, { agent: "a", branch: "gepa/a/t" });
    emitNoWinnerStreakEvent(repoPath, { agent: "a", streak: 3 });
    emitChampionFrozenEvent(repoPath, { agent: "a", frozen_list: ["a"] });
    emitCriticalAgentDraftPrEvent(repoPath, { agent: "inspector", pr_draft: true });

    const canonicalEvents = [
      "gepa_capture_drop",
      "gepa_eval_start",
      "gepa_eval_complete",
      "gepa_opt_cycle_start",
      "gepa_opt_no_winner",
      "gepa_opt_promote",
      "gepa_soak_start",
      "gepa_soak_promote",
      "gepa_soak_revert",
      "gepa_soak_revert_early",
      "gepa_soak_insufficient_traffic",
      "gepa_budget_exceeded",
      "gepa_tail_risk_block",
      "gepa_oversized_candidate",
      "gepa_judge_unreachable",
      "gepa_judge_malformed",
      "gepa_lock_collision",
      "gepa_branch_protection_missing",
      "gepa_no_winner_streak",
      "gepa_champion_frozen",
      "gepa_critical_agent_draft_pr"
    ];

    for (const eventName of canonicalEvents) {
      expect(countEventsByName(eventName)).toBe(1);
    }

    // Total lines = exactly 21.
    expect(readEvents()).toHaveLength(21);
  });
});
