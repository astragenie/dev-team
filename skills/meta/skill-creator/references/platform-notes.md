# Platform-Specific Notes

## Claude.ai-Specific Instructions

The core workflow is the same (draft → test → review → improve → repeat), but because Claude.ai doesn't have subagents, some mechanics change.

**Running test cases**: No subagents means no parallel execution. For each test case, read the skill's SKILL.md, then follow its instructions to accomplish the test prompt yourself. Do them one at a time. Skip baseline runs.

**Reviewing results**: If you can't open a browser, skip the browser reviewer entirely. Present results directly in the conversation. For file outputs (like .docx or .xlsx), save to the filesystem and tell users where to find them. Ask for feedback inline.

**Benchmarking**: Skip quantitative benchmarking — it relies on baseline comparisons which aren't meaningful without subagents.

**The iteration loop**: Same as main workflow — improve the skill, rerun the test cases, ask for feedback — just without the browser reviewer.

**Description optimization**: Requires `claude -p` via CLI. Skip if on Claude.ai.

**Blind comparison**: Requires subagents. Skip.

**Packaging**: `package_skill.py` works anywhere with Python and a filesystem.

**Updating an existing skill**: 
- Preserve the original name — note the directory name and `name` frontmatter field and use them unchanged.
- Copy to a writeable location before editing (`/tmp/skill-name/`), edit there, and package from the copy.
- If packaging manually, stage in `/tmp/` first, then copy to the output directory.

## Cowork-Specific Instructions

The main things to know:

- You have subagents, so the main workflow (spawn test cases in parallel, run baselines, grade, etc.) all works. If you run into severe timeout problems, run test prompts in series rather than parallel.
- No browser or display — when generating the eval viewer, use `--static <output_path>` to write a standalone HTML file, then provide a link for the user to open in their browser.
- After running tests, always generate the eval viewer for the human to look at examples before revising the skill yourself. Use `generate_review.py` — not custom HTML. **GENERATE THE EVAL VIEWER BEFORE evaluating inputs yourself.**
- Feedback works differently: since there's no running server, the viewer's "Submit All Reviews" button downloads `feedback.json` as a file. Read it from there (may need to request access first).
- Packaging works — `package_skill.py` just needs Python and a filesystem.
- Description optimization (`run_loop.py` / `run_eval.py`) works fine in Cowork since it uses `claude -p` via subprocess.
- **Updating an existing skill**: Follow the update guidance in the Claude.ai section above.
