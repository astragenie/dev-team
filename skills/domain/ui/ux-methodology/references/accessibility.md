# Accessibility — WCAG 2.1 and 2.2 AA

Non-negotiable baseline, common sins, and WCAG 2.2-specific additions.

## Non-negotiables (WCAG 2.1 AA)

| Criterion | Requirement |
|---|---|
| Keyboard navigation | All interactive elements reachable and operable via Tab / Enter / Esc |
| Color contrast (text) | 4.5:1 minimum for normal text; 3:1 for large text (18pt+ or 14pt+ bold) |
| Color contrast (UI components) | 3:1 for UI components and graphical objects |
| Screen reader compatibility | Semantic HTML elements; ARIA labels where native semantics are absent |
| Touch targets | 44×44px design target (WCAG 2.2 SC 2.5.8: 24×24px minimum with adequate spacing) |
| Reduced motion | `prefers-reduced-motion` media query; disable or reduce all animations |
| Alt text | All meaningful images have descriptive `alt` attributes; decorative images use `alt=""` |
| Autoplay | No autoplay video or audio without user controls; provide pause/stop |

## WCAG 2.2 additions (AA — required for modern compliance)

### SC 2.4.11 — Focus Not Obscured (Minimum)

Focused elements must not be fully hidden by sticky headers, cookie banners, scroll-snap
containers, or chat widgets. Test with Tab key while the page is scrolled to various positions.

```css
/* Ensure sticky headers do not cover focused elements */
:target {
  scroll-margin-top: 80px; /* match sticky header height */
}
```

### SC 2.5.7 — Dragging Movements

Any drag interaction (list reorder, resize handle, carousel swipe) must have a non-drag
alternative — buttons, inputs, or arrow-key support. Never rely solely on drag for a primary
workflow.

### SC 3.3.8 — Accessible Authentication

Authentication flows must not require cognitive-function tests (puzzles, image matching)
without a non-cognitive alternative. If CAPTCHA is used:
- Provide an audio CAPTCHA alternative.
- Allow password managers to autofill (do not block paste in password fields).

### SC 3.3.7 — Redundant Entry

Data entered in earlier steps of a multi-step form must be auto-populated in later steps.
Never ask users to re-enter information already provided in the same session.

## Common accessibility sins

| Sin | Fix |
|---|---|
| Color as sole status indicator | Add icon, text label, or pattern alongside color |
| No focus indicator or custom focus removed | `outline: 2px solid; outline-offset: 2px` minimum |
| Missing or generic ARIA labels (`aria-label="button"`) | Describe the action: `aria-label="Close dialog"` |
| Contrast ratio <3:1 on placeholder text | Use `color: #767676` minimum on white backgrounds |
| Autoplay media | `autoplay` only with `muted`; always provide pause control |
| Form validation via color only | Show error message text adjacent to the field |

## Motion and animation

All animations must respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Do not rely on JS-based animation detection alone — always implement the CSS media query
as the primary accessibility control.

## Testing checklist

- [ ] Keyboard-only navigation: tab through every interactive element; verify focus is visible
- [ ] Screen reader testing: NVDA/VoiceOver reads page structure logically; no "click here" links
- [ ] Color contrast: checked with browser DevTools or axe-core automated scan
- [ ] Touch targets: inspect sizing on mobile viewport; verify 44×44px for all primary actions
- [ ] Reduced motion: toggle OS setting; verify no rapid animation remains
- [ ] Focus not obscured: scroll page; tab through sticky-header area; focused element visible
- [ ] Authentication: password manager paste not blocked; no CAPTCHA without audio alternative
- [ ] Multi-step forms: data from step 1 auto-populated in step 3+
