---
name: frontend-design
tier: domain
description: Create distinctive, production-grade frontend interfaces with high design quality — use when building web components, pages, dashboards, landing pages, or any web UI that needs creative, polished aesthetics beyond generic AI output.
source: davila7/claude-code-templates/cli-tool/components/skills/creative-design/frontend-design
source_version: 2026-06-08
last_reviewed: 2026-06-08
owner: hero-crew
triggers: ["frontend", "UI design", "web component", "landing page", "dashboard", "HTML/CSS", "stylesheet", "visual design", "aesthetics", "layout", "typography", "color palette", "animation", "React component", "page design", "web app"]
---

# Frontend Design

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics.
Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build.
They may include context about the purpose, audience, or technical constraints.

## When to use

Consult this skill when:
- Building web components, pages, or complete UI applications
- Designing landing pages, dashboards, portfolios, or marketing sites
- Styling or beautifying any web UI with creative intent
- Authoring HTML/CSS layouts or React/Vue components with design emphasis
- The user asks for something "beautiful," "polished," or "visually distinctive"
- Producing posters, artifacts, or any frontend with aesthetic requirements

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural,
  luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric,
  soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE?

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like
  Arial and Inter; opt for distinctive choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant
  colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML.
  Use the Motion library for React when available. One well-orchestrated page load with staggered
  reveals creates more delight than scattered micro-interactions.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking
  elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth — gradient meshes, noise textures,
  geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays.

**NEVER** use generic AI-generated aesthetics: overused font families (Inter, Roboto, Arial),
cliched color schemes (purple gradients on white), or predictable component patterns.

Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code.
Minimalist or refined designs need restraint, precision, and careful attention to spacing.

## Done / Acceptance

A frontend design deliverable is ready when:
- Working code executes in the target framework (HTML/CSS/JS, React, Vue, etc.)
- A clear, intentional aesthetic direction is executed with precision (not generic AI defaults)
- Typography and color choices are distinctive and context-appropriate
- Interactive elements have appropriate motion and micro-interactions
- Layout avoids symmetric, predictable grid patterns where possible
- Accessibility basics present: semantic HTML, sufficient color contrast, keyboard-navigable
- No inline `style=` conflicts with CSS variables; CSS custom properties used for theming
