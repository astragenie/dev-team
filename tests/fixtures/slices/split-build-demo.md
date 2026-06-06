---
slice: SLICE-901
feat: FEAT-DEMO
tags:
  - surface:ui
  - surface:api
  - stack:react
  - stack:csharp
needs_contract: true
needs_ux: true
---

# SLICE-901 — Split build demo

## Acceptance Criteria

- POST /things creates a Thing and returns 201 with the created object
- UI button "Save" triggers the create and shows "Saved!" toast
- a11y: focus ring visible on Save button
