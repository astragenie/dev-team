# Improving the Skill

This is the heart of the loop. You've run the test cases, the user has reviewed the results, and now you need to make the skill better based on their feedback.

## How to think about improvements

1. **Generalize from the feedback.** We're creating skills that will be used across many different prompts. The user is iterating on a few examples because it helps move faster, but the skill must work broadly — not just for those examples. Avoid fiddly, overfitty changes or oppressively constrictive MUSTs. If some issue is stubborn, try different metaphors or different working patterns.

2. **Keep the prompt lean.** Remove things that aren't pulling their weight. Read the transcripts (not just final outputs) — if the skill is making the model waste time on unproductive things, try removing those parts.

3. **Explain the why.** Try hard to explain the *why* behind everything you're asking the model to do. LLMs are smart. When given a good harness, they can go beyond rote instructions. If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a yellow flag — reframe and explain the reasoning instead.

4. **Look for repeated work across test cases.** Read the transcripts and notice if all subagents independently wrote similar helper scripts. If all 3 test cases resulted in the subagent writing a `create_docx.py` or `build_chart.py`, that's a strong signal the skill should bundle that script. Write it once, put it in `scripts/`, and tell the skill to use it.

## The iteration loop

After improving the skill:

1. Apply improvements to the skill.
2. Rerun all test cases into a new `iteration-<N+1>/` directory, including baseline runs. If creating a new skill, the baseline is always `without_skill`. If improving an existing skill, use judgment on what makes sense as the baseline.
3. Launch the reviewer with `--previous-workspace` pointing at the previous iteration.
4. Wait for the user to review and tell you they're done.
5. Read the new feedback, improve again, repeat.

Keep going until:
- The user says they're happy.
- The feedback is all empty (everything looks good).
- You're not making meaningful progress.

## Advanced: Blind comparison

For situations where you want a more rigorous comparison between two versions (e.g., "is the new version actually better?"), there's a blind comparison system. Read `agents/comparator.md` and `agents/analyzer.md` for the details. The basic idea: give two outputs to an independent agent without telling it which is which, and let it judge quality. Then analyze why the winner won.

This is optional, requires subagents, and most users won't need it. The human review loop is usually sufficient.
