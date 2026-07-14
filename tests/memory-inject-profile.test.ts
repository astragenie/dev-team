import test from "node:test";
import assert from "node:assert/strict";
import { formatProfileBlock } from "../scripts/lib/memory/inject-profile.ts";
import type { AgentProfile } from "../scripts/lib/memory/profile-types.ts";

function emptyProfile(agent: string): AgentProfile {
  return { agent, counts: {}, total: 0, first_seen: null, last_active: null,
    top_lessons: [], recent_decisions: [], corrections: [] };
}

test("formatProfileBlock returns '' when profile has no lessons/decisions/corrections", () => {
  assert.equal(formatProfileBlock(emptyProfile("crew:reviewer"), { agent: "crew:reviewer", maxChars: 1600, usefulnessWarm: true }), "");
});

test("formatProfileBlock orders corrections, then decisions, then lessons; each line carries an atom marker", () => {
  const p = emptyProfile("crew:reviewer");
  p.corrections = [{ id: "c1", type: "lesson", text: "Missed a null check", action: "superseded", reason: null, superseded_by: null, superseding_text: null, corrected_at: 1 }];
  p.recent_decisions = [{ id: "d1", text: "Use single-id feedback", importance: 0.7, created_at: 2 }];
  p.top_lessons = [{ id: "l1", text: "Prefer fail-silent recall", importance: 0.8, usefulness: 0.9, created_at: 3 }];
  const out = formatProfileBlock(p, { agent: "crew:reviewer", maxChars: 1600, usefulnessWarm: true });
  assert.match(out, /^## Your track record \(crew:reviewer\)/);
  const iC = out.indexOf("Missed a null check"), iD = out.indexOf("Use single-id feedback"), iL = out.indexOf("Prefer fail-silent recall");
  assert.ok(iC < iD && iD < iL, "corrections < decisions < lessons");
  assert.match(out, /<!--atom:c1-->/);
  assert.match(out, /<!--atom:l1-->/);
});

test("formatProfileBlock labels lessons 'importance-ranked' when usefulness signal is cold", () => {
  const p = emptyProfile("crew:reviewer");
  p.top_lessons = [{ id: "l1", text: "x".repeat(20), importance: 0.8, usefulness: 0.5, created_at: 3 }];
  const warm = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: true });
  const cold = formatProfileBlock(p, { agent: "a", maxChars: 1600, usefulnessWarm: false });
  assert.match(cold, /importance-ranked/i);
  assert.doesNotMatch(warm, /importance-ranked/i);
});

test("formatProfileBlock truncates to maxChars deterministically (keeps corrections first)", () => {
  const p = emptyProfile("a");
  p.corrections = [{ id: "c1", type: "lesson", text: "KEEP-CORRECTION", action: "invalidated", reason: null, superseded_by: null, superseding_text: null, corrected_at: 1 }];
  p.top_lessons = Array.from({ length: 10 }, (_, i) => ({ id: `l${i}`, text: `DROP-LESSON-${i}-${"y".repeat(60)}`, importance: 0.5, usefulness: 0.5, created_at: i }));
  const out = formatProfileBlock(p, { agent: "a", maxChars: 120, usefulnessWarm: false });
  assert.ok(out.length <= 120, `len ${out.length}`);
  assert.match(out, /KEEP-CORRECTION/);
});
