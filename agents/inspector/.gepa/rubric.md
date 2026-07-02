# Inspector Eval Rubric

Loaded by `loadRubric("agents/inspector/.gepa/rubric.md")` in gepa-core.
Each section is a scoring criterion used by `rubricScorer`.
Anchors are written so any LLM (not just Claude) can apply them — they
reference observable output properties, not subjective style preferences.

---

## verdict-accuracy

Measures whether the inspector's verdict (approve / approve_with_notes / reject)
matches the expected verdict for the input diff.

- **3**: Verdict exactly matches expected AND the inspector's stated rationale
  is consistent with the verdict (no contradictory hedging that would reverse
  a reasonable reader's interpretation).
- **2**: Verdict matches expected but rationale is thin, generic, or partially
  inconsistent — the right call was made but for a weak reason.
- **1**: Verdict does not match expected but the inspector identified the
  correct class of concern (e.g., flagged a real bug but only as "LOW" when
  expected verdict was "reject" for a CRITICAL bug).
- **0**: Verdict contradicts expected AND the inspector either missed the bug
  entirely or mis-classified it in a way that would let a dangerous change
  through (false negative on a rejection-class bug).

---

## evidence-citation-correctness

Measures whether the inspector cited concrete, accurate evidence from the
diff to support its findings (e.g., file name, line reference, code snippet).

- **3**: All major findings reference specific lines, function names, or code
  snippets from the diff that can be verified by reading the diff. No
  fabricated references.
- **2**: Most findings have specific citations; one finding is vague or uses
  a generic description ("somewhere in the code") without a line reference.
- **1**: Findings present but most lack specific citations; the inspector
  describes symptoms without tying them to observable diff locations.
- **0**: No concrete citations, or the inspector invents evidence not present
  in the diff (hallucinated file names, fabricated line numbers).

---

## risk-class-named

Measures whether the inspector names the correct risk category for each
finding. Risk classes: logic-error, integration-failure, data-corruption,
timeout, permission, resource-exhaustion, external-dep, security, perf, race.

- **3**: The dominant risk class is named explicitly (or a clear functional
  equivalent) and matches the case's `notes.bug_class` field.
- **2**: A related or overlapping risk class is named (e.g., "null dereference"
  for a logic-error case) without using the canonical term — the concern is
  present but the classification vocabulary is imprecise.
- **1**: Risk class is implied but not named; the response describes the
  symptom ("this could fail") without categorizing it.
- **0**: Wrong risk class named, or no risk class present at all despite a
  clearly classifiable finding.

---

## rationale-actionability

Measures whether the inspector's rationale gives the author enough information
to fix the issue — not just that something is wrong, but what to do.

- **3**: Rationale names the fix (e.g., "restore the null guard removed at
  line 8", "add a circuit-breaker for the external call") or describes a
  concrete alternative pattern. Author does not need to ask a follow-up.
- **2**: Rationale explains the root cause clearly but leaves the specific
  fix unspecified — "the null guard is missing" without saying where to
  add it.
- **1**: Rationale states that a problem exists but is circular or unhelpful
  ("this is wrong because it is incorrect"). Author must investigate
  independently.
- **0**: No rationale, or rationale is a restatement of the diff without
  any analysis of what is wrong.

---

## escalation-appropriateness

Measures whether the inspector's severity tag matches the risk profile of
the finding. Severity tags: [CRITICAL], [HIGH], [MEDIUM], [LOW].

- **3**: Severity tag matches the expected severity in the eval case
  exactly, OR the inspector uses a tag within one tier of the expected
  severity AND the rationale justifies the choice.
- **2**: Severity is one tier off from expected in a non-dangerous direction
  (e.g., tagged [MEDIUM] when [HIGH] was expected — conservative but not
  reckless). Rationale does not justify the lower severity.
- **1**: Severity is one tier off in the dangerous direction (e.g., [LOW]
  when [HIGH] was expected), indicating under-weighting of a real risk.
- **0**: Severity is two or more tiers off in the dangerous direction,
  or no severity tag present when the bug class requires one.

---

## false-positive-rate

Measures whether the inspector avoids raising findings on safe changes
(clean refactors, renames, doc-only edits). Only meaningful on "clean"
eval cases where the expected verdict is approve or approve_with_notes.

- **3**: No blocking finding raised on a clean change. Notes or LOW findings
  are acceptable.
- **2**: One MEDIUM finding raised on a clean change that is a genuine
  stretch or interpretation question — not reckless, but not clearly
  justified either.
- **1**: One HIGH finding raised on a clean change (false positive at
  blocking severity — incorrect escalation).
- **0**: CRITICAL finding raised on a clean change, OR inspector rejects
  a diff that should have been approved, with no substantive rationale.
