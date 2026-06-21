# Information Architecture and Interaction Design

Navigation structures, layout decisions, usability heuristics, and AI interface patterns.

## Information architecture

### Navigation design

- **Left-aligned navigation** outperforms centered or right-aligned: users spend 69% more
  time on the left half of screens (NN Group, 2024).
  Source: https://www.nngroup.com/articles/horizontal-attention-leans-left/
- **Hamburger menu on desktop** adds an extra click and exploits banner blindness —
  important nav items get ignored when hidden. Keep primary nav visible on desktop.
- **Max 5–7 primary navigation items** — beyond this, apply progressive disclosure
  (mega-menus, secondary nav) rather than dumping all options at the top level.

### F-pattern and scanning behavior

- Eye-tracking studies (NN Group, 2006–2024) show 79% of users scan; only 16% read
  word-by-word. The F-shaped pattern means the first two lines of a content block and the
  left margin receive the most attention.
- **Application**: Front-load critical information; use meaningful subheadings; avoid
  burying key actions below the fold or on the right side.

### Progressive disclosure

- Show only what users need at each step; reveal complexity on demand.
- Applied to forms: multi-step flows reduce cognitive load vs. a single long form.
- Applied to navigation: secondary items visible only after primary selection.

## Usability heuristics (applied)

### Fitts's Law

Time to acquire a target = log2(2D/W), where D = distance, W = target width.
- **Minimum touch target**: 44×44px (design target); WCAG 2.2 SC 2.5.8 sets 24×24px legal
  minimum with adequate spacing.
- **Primary actions**: Large and close together; related actions proximal to trigger.
- **Anti-pattern**: Important actions in top screen corners (furthest from natural thumb reach).

### Hick's Law (choice overload)

Decision time increases logarithmically with the number of options.
- **Group related options** — organize options into categories; users process groups faster.
- **Progressive disclosure** — show the most common 5–7 options; reveal more on demand.
- **Anti-pattern**: Showing all 20 options in a dropdown when only 4 are frequently used.

### Recognition over recall (Jakob's Law)

- Users spend most time on other sites; they bring expectations from those experiences.
- Follow conventions for core patterns (nav, forms, checkout, search) unless strong
  evidence supports divergence.
- Novel patterns cost the user learning time; that cost must be justified by clear benefit.

### Banner blindness

- Content positioned in typical ad areas (top banner, right sidebar) gets systematically
  ignored regardless of importance (Benway & Lane, 1998; ongoing NN Group studies).
- **Application**: Keep critical CTAs out of banner-like positions; avoid top-banner alerts
  for genuinely important messages.

## Mobile interaction design

### Thumb zones

- 49% of users hold their phone with one hand (Steven Hoober, 2013–2023).
- Users constantly shift grip — no single thumb zone covers all interactions.
- **Bottom navigation** is correct for primary actions (easy reach zone).
- **Top corners** are hardest to reach — do not place critical or frequent actions there.
- Design for variable grip patterns, not a single static thumb zone.

### Mobile-first rationale

54%+ of global web traffic is mobile (StatCounter, 2024). Mobile users have different
intent (quick tasks, browsing, context-switching). Desktop-first design treats mobile as
an afterthought; design for mobile constraints first, then enhance for larger screens.

## AI interface patterns

### Input UX

- **Auto-growing text areas** outperform fixed single-line inputs for multi-turn tasks.
- **Suggested prompts** (3–4 contextual examples at start) reduce blank-page friction
  and improve task success rate for first-time users.
- **Visual node editors** (flow diagrams) outperform prose prompts for complex AI workflows.
- **Anti-pattern**: Single-line chat input for complex multi-turn or multi-step tasks.

### Output UX

- **Progressive streaming** — never show a blank state while AI generates; stream output.
- **Skeleton loaders** shaped like the expected output reduce perceived wait time vs. spinners.
- **AI-generated label + edit affordance** — treat output as a draft, not a final answer;
  always surface a revision path.
- **Anti-pattern**: Treating AI output as final with no way to correct or iterate.

### Refinement UX

- Provide presets or sliders for common refinements (tone, length, formality).
- Highlighted text → contextual action menu (Notion AI pattern) outperforms global re-prompt.
- **Anti-pattern**: Full conversation restart as the only path to refine previous output.

### Loading states for AI

- AI responses typically take 5–30s; use animated skeletons + progress text
  ("Thinking… Searching… Writing…") to reduce perceived wait time.
- **Anti-pattern**: Static spinner for generation tasks longer than 2s.

### Transparency and trust

- Show confidence signals when AI is uncertain.
- Add subtle friction for high-stakes AI actions ("Please review before sending").
- Explain what the AI did, not just what it produced.
