// tests/model-tiers-parity.test.ts — crew-architecture-review review follow-up
//
// evals/lib/model-profile.ts hand-duplicates the model-tier list because the
// evals/ package boundary forbids importing scripts/lib (and evals/ carries no
// zod dependency). The duplication is a considered tradeoff; this test is the
// enforcement that the two lists never drift.
import { test } from "bun:test";
import assert from "node:assert/strict";
import { MODEL_TIERS } from "../scripts/lib/models/schema.ts";
import { TIERS } from "../evals/lib/model-profile.ts";

test("evals TIERS stays identical to scripts MODEL_TIERS (order included)", () => {
  assert.deepEqual([...TIERS], [...MODEL_TIERS]);
});
