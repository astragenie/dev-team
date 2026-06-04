# Description Optimization

The description field in SKILL.md frontmatter is the primary mechanism that determines whether Claude invokes a skill. After creating or improving a skill, offer to optimize the description for better triggering accuracy.

## Step 1: Generate trigger eval queries

Create 20 eval queries — a mix of should-trigger and should-not-trigger. Save as JSON:

```json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
```

Queries must be realistic and concrete — not abstract, but specific with detail. Include file paths, personal context, column names, company names, URLs, a little backstory. Use a mix of lengths. Focus on edge cases rather than clear-cut cases.

**Bad:** `"Format this data"`, `"Extract text from PDF"`, `"Create a chart"`

**Good:** `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage"`

For **should-trigger** queries (8-10): cover different phrasings of the same intent — some formal, some casual. Include cases where the user doesn't explicitly name the skill but clearly needs it. Include uncommon use cases and cases where this skill competes with another but should win.

For **should-not-trigger** queries (8-10): the most valuable are near-misses — queries sharing keywords or concepts with the skill but actually needing something different. Think adjacent domains, ambiguous phrasing where a naive keyword match would trigger but shouldn't.

## Step 2: Review with user

Present the eval set using the HTML template:

1. Read the template from `assets/eval_review.html`
2. Replace placeholders:
   - `__EVAL_DATA_PLACEHOLDER__` → the JSON array (no quotes — it's a JS variable assignment)
   - `__SKILL_NAME_PLACEHOLDER__` → skill's name
   - `__SKILL_DESCRIPTION_PLACEHOLDER__` → skill's current description
3. Write to a temp file and open it.
4. User can edit queries, toggle should-trigger, add/remove entries, then click "Export Eval Set".
5. The file downloads to `~/Downloads/eval_set.json`.

## Step 3: Run the optimization loop

Tell the user: "This will take some time — I'll run the optimization loop in the background and check on it periodically."

Save the eval set to the workspace, then run:

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id-powering-this-session> \
  --max-iterations 5 \
  --verbose
```

Use the model ID from your system prompt so the triggering test matches what the user actually experiences.

This handles the full optimization loop automatically: splits eval into 60% train / 40% held-out test, evaluates current description (running each query 3 times), calls Claude to propose improvements based on failures, re-evaluates each new description. Returns `best_description` selected by test score to avoid overfitting.

### How skill triggering works

Skills appear in Claude's `available_skills` list with name + description. Claude only consults skills for tasks it can't easily handle on its own — simple one-step queries may not trigger a skill even if the description matches. Complex, multi-step, or specialized queries reliably trigger skills when the description matches. Eval queries should be substantive enough that Claude would benefit from consulting a skill.

## Step 4: Apply the result

Take `best_description` from the JSON output and update the skill's SKILL.md frontmatter. Show the user before/after and report the scores.

## Package and Present (only if `present_files` tool is available)

Check whether you have access to the `present_files` tool. If you don't, skip this step. If you do:

```bash
python -m scripts.package_skill <path/to/skill-folder>
```

Direct the user to the resulting `.skill` file path so they can install it.
