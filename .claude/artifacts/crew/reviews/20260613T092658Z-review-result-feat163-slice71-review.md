---
findings: "🔴:0,🟡:1,❓:0"
status: completed
---
# Review Result: FEAT163 SLICE71 review

- Created: 2026-06-13T09:29:19.116Z
- Reviewer: inspector
- Decision: approved_with_notes
- Status: completed
- Summary: All 6 ACs pass; one validator gap found (whitelist regex fires false-positive on blacklist-only backtick bullets) — low risk for SLICE-A since both agents have real whitelists, but must be fixed before SLICE-B/C expand the allowlist.
- Evidence Checked:
  - Whitelist entries confirmed in both agents matching FEAT-163 dispatch graph (doc-writer: architect+researcher+investigator; refactor: investigator only). Blacklist enumerates all 8+ stay-isolated agents including gates and caveman:*/3rdparty:*. Dispatch budget
  - purity
  - and final-tool-call invariant subsections present with FEAT-163 cite-back. checkPeerDispatchSection wired at validate-agents.ts:279. PEER_DISPATCH_ALLOWLIST scoped to document-writer+refactor only. 8 tests cover positive (2)
  - negative (4 sub-cases)
  - and exempt (2) paths. Constitution/dev.stable amendments flagged OOS in slice doc line 36 (SLICE-D deferred). VALIDATOR GAP: hasWhitelistEntry regex (/\n- backtick[^backtick]+backtick/) matches blacklist backtick-bullet items — an agent with only a backtick-formatted blacklist and no whitelist would pass the check. Test fixture avoids the gap by using non-backtick blacklist text
  - so the gap is not caught by the test suite.
- Files Reviewed:
  - agents/document-writer.md
  - agents/refactor.md
  - scripts/validate-agents.ts
  - tests/validate-agents-peer-dispatch.test.ts
- Test Adequacy: 8 new tests in tests/validate-agents-peer-dispatch.test.ts: 2 positive (allowlisted agent with correct section passes), 4 negative (missing heading / missing whitelist / missing blacklist / missing budget each fails with correct error message), 2 exempt (non-allowlisted agent with Agent tool passes; allowlisted agent without Agent tool passes). All failure modes map to real validator checks. Coverage gap: no test for the whitelist-regex false-positive (backtick blacklist without real whitelist). TDD: test file written alongside validator — naming describes behavior not implementation.
- Risks: Validator gap (hasWhitelistEntry regex false-positive on backtick blacklist bullets) is LOW risk in SLICE-A because both document-writer and refactor have real whitelist entries that satisfy the check independently. Risk escalates to MEDIUM at SLICE-B/C when 8 more agents are added to the allowlist — a copy-paste error that omits the whitelist but retains the backtick blacklist would silently pass. Dispatch prompt purity is advisory text, not runtime-enforced; identity-anchor leak risk (FEAT-163 risk #7) remains theoretical and acknowledged in FEAT body.
- Required Follow-up: Fix hasWhitelistEntry regex before SLICE-B: require that at least one whitelist bullet precedes the 'MUST NOT dispatch' line, or use a named-capture pattern that distinguishes the whitelist paragraph from the blacklist paragraph. Add a test that provides a backtick-only blacklist with no whitelist and asserts it fails.

